import { spawn, ChildProcess, exec } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'
import * as fs from 'node:fs'

const execAsync = promisify(exec)

interface CloudflaredConfig {
  httpPort: number
  protocol?: 'http' | 'https'
  // For named tunnels with token
  token?: string
  // Custom hostname for display (when using token, URL is configured in dashboard)
  customHostname?: string
}

interface TunnelStatus {
  running: boolean
  tunnelUrl: string | null
  error: string | null
  mode: 'quick' | 'named'
}

class CloudflaredManager {
  private process: ChildProcess | null = null
  private tunnelUrl: string | null = null
  private isRunning: boolean = false
  private mode: 'quick' | 'named' = 'quick'
  // Watchdog state: auto-restart the tunnel if it dies unexpectedly mid-service.
  private stopping: boolean = false
  private lastConfig: CloudflaredConfig | null = null
  private lastError: string | null = null
  private restartAttempts: number = 0
  private restartTimer: ReturnType<typeof setTimeout> | null = null

  async start(config: CloudflaredConfig): Promise<TunnelStatus> {
    if (this.isRunning) {
      return { running: true, tunnelUrl: this.tunnelUrl, error: null, mode: this.mode }
    }

    // Remember config for the watchdog; clear prior stop/error state for this run.
    this.lastConfig = config
    this.stopping = false
    this.lastError = null

    console.log('[Cloudflared] start() called with config:', {
      httpPort: config.httpPort,
      hasToken: !!config.token,
      tokenLength: config.token?.length,
      customHostname: config.customHostname
    })

    try {
      const binary = await this.findBinary()

      // Determine if using quick tunnel or named tunnel with token
      if (config.token) {
        console.log('[Cloudflared] Using NAMED tunnel mode (token provided)')
        return await this.startNamedTunnel(binary, config)
      } else {
        console.log('[Cloudflared] Using QUICK tunnel mode (no token)')
        return await this.startQuickTunnel(binary, config)
      }

    } catch (error: any) {
      console.error('[Cloudflared] Failed to start tunnel:', error)
      await this.cleanup()
      return { running: false, tunnelUrl: null, error: error.message || String(error), mode: this.mode }
    }
  }

  private async startQuickTunnel(binary: string, config: CloudflaredConfig): Promise<TunnelStatus> {
    const protocol = config.protocol || 'http'
    const localUrl = `${protocol}://localhost:${config.httpPort}`

    console.log(`[Cloudflared] Starting quick tunnel for ${localUrl}`)
    this.mode = 'quick'

    this.process = spawn(binary, [
      'tunnel',
      '--url', localUrl,
      '--no-autoupdate'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    // Handle pipe errors to prevent EPIPE crashes
    this.process.stdout?.on('error', () => {})
    this.process.stderr?.on('error', () => {})
    this.process.stdin?.on('error', () => {})

    // Parse stdout/stderr for tunnel URL
    const urlPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for tunnel URL (30s)'))
      }, 30000)

      const handler = (data: Buffer) => {
        const output = data.toString()
        console.log('[Cloudflared] Output:', output)

        // Match the tunnel URL from cloudflared output
        const match = output.match(/https:\/\/[\w-]+\.trycloudflare\.com/)
        if (match) {
          clearTimeout(timeout)
          resolve(match[0])
        }

        // Check for errors
        if (output.includes('error') || output.includes('failed')) {
          const errorMatch = output.match(/error[:\s]+(.+)/i)
          if (errorMatch) {
            clearTimeout(timeout)
            reject(new Error(errorMatch[1].trim()))
          }
        }
      }

      this.process!.stdout?.on('data', handler)
      this.process!.stderr?.on('data', handler)

      this.process!.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      this.process!.on('exit', (code) => {
        if (code !== 0 && !this.tunnelUrl) {
          clearTimeout(timeout)
          reject(new Error(`cloudflared exited with code ${code}`))
        }
      })
    })

    this.tunnelUrl = await urlPromise
    this.isRunning = true
    this.restartAttempts = 0
    this.setupExitHandler()

    console.log(`[Cloudflared] Quick tunnel established: ${this.tunnelUrl}`)
    return { running: true, tunnelUrl: this.tunnelUrl, error: null, mode: 'quick' }
  }

  private async startNamedTunnel(binary: string, config: CloudflaredConfig): Promise<TunnelStatus> {
    console.log('[Cloudflared] Starting named tunnel with token')
    this.mode = 'named'

    this.process = spawn(binary, [
      'tunnel',
      '--no-autoupdate',
      'run',
      '--token', config.token!
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    // Handle pipe errors to prevent EPIPE crashes
    this.process.stdout?.on('error', () => {})
    this.process.stderr?.on('error', () => {})
    this.process.stdin?.on('error', () => {})

    // For named tunnels, we wait for successful connection message
    const connectedPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for tunnel connection (30s)'))
      }, 30000)

      const handler = (data: Buffer) => {
        const output = data.toString()
        console.log('[Cloudflared] Output:', output)

        // Check for successful connection indicators
        if (output.includes('Registered tunnel connection') ||
            output.includes('Connection registered') ||
            output.includes('INF')) {
          // Give it a moment to fully establish
          setTimeout(() => {
            clearTimeout(timeout)
            resolve()
          }, 1000)
        }

        // Check for errors
        if (output.includes('error') || output.includes('failed') || output.includes('ERR')) {
          const errorMatch = output.match(/(?:error|ERR)[:\s]+(.+)/i)
          if (errorMatch && !output.includes('INF')) {
            clearTimeout(timeout)
            reject(new Error(errorMatch[1].trim()))
          }
        }
      }

      this.process!.stdout?.on('data', handler)
      this.process!.stderr?.on('data', handler)

      this.process!.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      this.process!.on('exit', (code) => {
        if (code !== 0 && !this.isRunning) {
          clearTimeout(timeout)
          reject(new Error(`cloudflared exited with code ${code}`))
        }
      })
    })

    await connectedPromise

    // For named tunnels, the URL is configured in the Cloudflare dashboard
    // Use the custom hostname if provided
    this.tunnelUrl = config.customHostname || 'Configured in Cloudflare Dashboard'
    this.isRunning = true
    this.restartAttempts = 0
    this.setupExitHandler()

    console.log(`[Cloudflared] Named tunnel established`)
    return { running: true, tunnelUrl: this.tunnelUrl, error: null, mode: 'named' }
  }

  private setupExitHandler(): void {
    if (!this.process) return
    this.process.on('exit', (code) => {
      console.log(`[Cloudflared] Process exited with code ${code}`)
      this.isRunning = false
      this.tunnelUrl = null
      this.process = null
      if (!this.stopping) {
        // Unexpected death mid-service — record it and auto-restart so the public feed
        // recovers without operator intervention (it previously stayed down silently
        // while getStatus() still reported no error).
        this.lastError = `Tunnel process exited unexpectedly (code ${code})`
        this.scheduleRestart()
      }
    })
  }

  private scheduleRestart(): void {
    if (this.stopping || !this.lastConfig) return
    const MAX_RESTARTS = 5
    if (this.restartAttempts >= MAX_RESTARTS) {
      this.lastError = `Tunnel died and did not recover after ${MAX_RESTARTS} restart attempts`
      console.error('[Cloudflared] ' + this.lastError)
      return
    }
    this.restartAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.restartAttempts - 1), 30000)
    console.warn(`[Cloudflared] Tunnel died — auto-restart attempt ${this.restartAttempts}/${MAX_RESTARTS} in ${delay}ms`)
    this.restartTimer = setTimeout(async () => {
      this.restartTimer = null
      if (this.stopping || !this.lastConfig) return
      const result = await this.start(this.lastConfig)
      if (!result.running && !this.stopping) {
        this.lastError = result.error
        this.scheduleRestart()
      }
    }, delay)
  }

  async stop(): Promise<void> {
    // Mark intentional stop so the exit handler doesn't trigger the auto-restart watchdog.
    this.stopping = true
    this.restartAttempts = 0
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }

    if (!this.process) {
      this.isRunning = false
      this.tunnelUrl = null
      return
    }

    console.log('[Cloudflared] Stopping tunnel...')

    return new Promise((resolve) => {
      const forceKillTimeout = setTimeout(() => {
        console.log('[Cloudflared] Force killing process')
        if (this.process) {
          this.process.kill('SIGKILL')
        }
        this.cleanup()
        resolve()
      }, 5000)

      this.process!.on('exit', () => {
        clearTimeout(forceKillTimeout)
        this.cleanup()
        console.log('[Cloudflared] Tunnel stopped')
        resolve()
      })

      // Send SIGTERM for graceful shutdown
      this.process!.kill('SIGTERM')
    })
  }

  getStatus(): TunnelStatus {
    return {
      running: this.isRunning,
      tunnelUrl: this.tunnelUrl,
      error: this.lastError,
      mode: this.mode
    }
  }

  private cleanup(): void {
    this.process = null
    this.tunnelUrl = null
    this.isRunning = false
  }

  private async findBinary(): Promise<string> {
    const binaryName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'

    // 1. Check if bundled with app (future enhancement)
    if (process.resourcesPath) {
      const bundledPath = path.join(process.resourcesPath, 'bin', binaryName)
      if (fs.existsSync(bundledPath)) {
        console.log(`[Cloudflared] Found bundled binary at ${bundledPath}`)
        return bundledPath
      }
    }

    // 2. Check PATH using 'which' or 'where'. NOTE: when the app is launched via
    // launchd/Finder (not a terminal), PATH is the minimal /usr/bin:/bin:/usr/sbin:/sbin
    // and EXCLUDES Homebrew (/opt/homebrew/bin), so `which` fails even though cloudflared
    // is installed. We augment PATH and also probe well-known locations below.
    const extraPaths = process.platform === 'win32'
      ? []
      : ['/opt/homebrew/bin', '/usr/local/bin', '/opt/homebrew/sbin', '/usr/sbin', '/usr/bin', '/bin']
    try {
      const command = process.platform === 'win32' ? `where ${binaryName}` : `which ${binaryName}`
      const augmentedPath = [process.env.PATH, ...extraPaths].filter(Boolean).join(path.delimiter)
      const { stdout } = await execAsync(command, { env: { ...process.env, PATH: augmentedPath } })
      const binaryPath = stdout.trim().split('\n')[0]
      if (binaryPath) {
        console.log(`[Cloudflared] Found binary in PATH at ${binaryPath}`)
        return binaryPath
      }
    } catch {
      // fall through to explicit location probing
    }

    // 3. Probe well-known absolute install locations (covers launchd/Finder launches
    // where Homebrew's bin isn't on PATH).
    const candidates = process.platform === 'win32'
      ? []
      : [
          '/opt/homebrew/bin/cloudflared', // Apple Silicon Homebrew
          '/usr/local/bin/cloudflared',    // Intel Homebrew / manual install
          '/opt/homebrew/sbin/cloudflared',
        ]
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        console.log(`[Cloudflared] Found binary at well-known location ${candidate}`)
        return candidate
      }
    }

    throw new Error(
      'cloudflared not found. Please install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/'
    )
  }
}

export { CloudflaredManager, CloudflaredConfig, TunnelStatus }
