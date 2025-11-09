# Docker Deployment Guide

This guide explains how to deploy mimiuchi as a containerized web service using Docker for real-time church translation services.

## Overview

The Docker deployment provides:
- **Web-based interface** accessible from any browser on your network
- **Real-time multi-language translation** for church services
- **WebSocket server** for broadcasting translations to multiple devices
- **No Electron required** - runs as a standalone Node.js server
- **Easy updates** - rebuild and restart the container
- **Portable** - move between machines easily
- **Network-ready** - perfect for church settings with multiple display devices

## Architecture

```
┌─────────────────────────────────────┐
│         Docker Container            │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   HTTP Server (Port 3000)    │  │
│  │   - Serves Vue.js frontend   │  │
│  │   - Static file serving      │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ WebSocket Server (Port 7714) │  │
│  │   - Real-time translations   │  │
│  │   - Client connections       │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Translation Worker         │  │
│  │   - OpenAI GPT-4o-mini       │  │
│  │   - Church-specific context  │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Prerequisites

- Docker Engine 20.10+ or Docker Desktop
- Docker Compose 2.0+
- At least 2GB RAM available
- Ports 3000 and 7714 available

## Quick Start

### 1. Build the Docker Image

```bash
# Using npm script (recommended)
npm run docker:build

# Or using docker-compose
docker-compose build

# Or using docker directly
docker build -t mimiuchi:latest .
```

### 2. Start the Container

```bash
# Using docker-compose (recommended)
npm run docker:run

# Or manually
docker-compose up -d
```

### 3. Access the Application

- **Web Interface**: http://localhost:3000
- **Network Access**: http://[your-server-ip]:3000
- **WebSocket**: ws://localhost:7714

### 4. View Logs

```bash
# Using npm script
npm run docker:logs

# Or docker-compose directly
docker-compose logs -f
```

### 5. Stop the Container

```bash
# Using npm script
npm run docker:stop

# Or docker-compose directly
docker-compose down
```

## Configuration

### Environment Variables

Customize the deployment by editing `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000          # HTTP server port
  - WS_PORT=7714       # WebSocket server port
```

### Port Mapping

To use different host ports, edit `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"   # Access web interface on port 8080
  - "7715:7714"   # WebSocket on port 7715
```

### Resource Limits

Adjust CPU and memory limits in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'        # Max 2 CPU cores
      memory: 2G       # Max 2GB RAM
    reservations:
      cpus: '0.5'      # Minimum 0.5 CPU cores
      memory: 512M     # Minimum 512MB RAM
```

## Setup Instructions

### Initial Setup

1. **Access the web interface** at http://localhost:3000

2. **Configure OpenAI API Key**:
   - Go to Settings → Translation
   - Enter your OpenAI API key
   - The key is stored in browser localStorage

3. **Enable Multi-Language Streams**:
   - Go to Settings → Multi-Language Streams
   - Enable desired languages (Spanish, Ukrainian, Russian, etc.)
   - Each language gets its own page (e.g., `/spanish`, `/ukrainian`)

4. **Configure Speech-to-Text**:
   - Go to Settings → STT
   - Options:
     - **Deepgram** (requires API key, best quality)
     - **OpenAI Whisper** (requires API key, good quality)
     - **Web Speech API** (free, browser-based, limited browser support)

### Multi-Device Setup for Church Services

#### Main Operator Device (Sound Booth/Tech Area)
- Access: http://[server-ip]:3000
- Shows English transcription
- Controls all settings
- Start/stop transcription
- Monitors translation quality

#### Language Display Devices (Congregation Areas)
- Spanish: http://[server-ip]:3000/#/spanish
- Ukrainian: http://[server-ip]:3000/#/ukrainian
- Russian: http://[server-ip]:3000/#/russian
- Portuguese: http://[server-ip]:3000/#/portuguese
- French: http://[server-ip]:3000/#/french
- (And other enabled languages)

Each language page shows:
- Real-time translated text in large, readable font
- Auto-scrolling display
- Optimized for mobile/tablet viewing
- Clean interface ideal for projection or personal devices
- No distracting controls or buttons

**Typical Setup**:
- Main operator uses laptop/desktop to control the system
- Tablets/phones placed in pews showing different language streams
- Optional: Project translations on screens in different areas of the church

## Best Practices for Church Services

### Pre-Service Checklist

1. **Test 15-30 minutes before service**:
   - Start Docker container
   - Verify web interface loads
   - Test microphone input
   - Check all language display devices
   - Run a test translation

2. **Audio Setup**:
   - Use a dedicated microphone for the speaker
   - Position mic 6-12 inches from speaker's mouth
   - Test audio levels (not too loud, not too quiet)
   - Minimize background noise during speaking segments

3. **Network Verification**:
   - Ensure stable internet connection (for API calls)
   - Verify all display devices are connected to WiFi
   - Test WebSocket connections from each device

4. **Display Device Positioning**:
   - Place tablets/phones in accessible locations
   - For projection, ensure text is readable from back rows
   - Set screens to stay awake (disable auto-lock)

### During Service

- Keep main operator interface open to monitor status
- Watch for connection errors or API issues
- Have backup plan ready (printed translations, interpreter)
- Start transcription at beginning of speaking segment
- Stop transcription during music or non-translated portions

### After Service

- Stop transcription
- Review any errors in logs
- Note any improvements for next service
- Keep Docker container running or stop to save resources

## Updates and Maintenance

### Update to Latest Code

```bash
# 1. Pull latest code
git pull

# 2. Rebuild the container
npm run docker:build

# 3. Restart with new image
npm run docker:stop
npm run docker:run
```

### Backup Configuration

Browser settings are stored in localStorage. To backup:
1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Export the settings you need

### View Container Status

```bash
# Check if container is running
docker ps

# View resource usage
docker stats mimiuchi-server

# Inspect container
docker inspect mimiuchi-server
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker-compose logs

# Verify ports are available
lsof -i :3000
lsof -i :7714

# Check if image built successfully
docker images | grep mimiuchi
```

### Can't Access from Other Devices

1. **Check firewall**:
   ```bash
   # Linux
   sudo ufw allow 3000
   sudo ufw allow 7714

   # macOS
   # System Preferences → Security & Privacy → Firewall → Firewall Options
   ```

2. **Verify server IP**:
   ```bash
   # Linux/macOS
   ifconfig
   # or
   ip addr show
   ```

3. **Test connectivity**:
   ```bash
   # From another device
   curl http://[server-ip]:3000
   ```

### WebSocket Connection Fails

1. **Check WebSocket server is running**:
   ```bash
   docker-compose logs | grep WebSocket
   ```

2. **Verify port 7714 is accessible**:
   ```bash
   telnet [server-ip] 7714
   ```

3. **Browser console errors**:
   - Open DevTools (F12) → Console
   - Look for WebSocket errors
   - Ensure you're using `ws://` not `wss://` (unless you've configured SSL)

### Translation Not Working

1. **Verify API key is set**:
   - Settings → Translation → OpenAI API Key
   - Key is stored per-device in localStorage

2. **Check worker logs**:
   ```bash
   docker-compose logs | grep "Translation worker"
   ```

3. **Test API key**:
   - Run a test translation
   - Check logs for "Translation error" or "API key not configured"

### Church-Specific Issues

**Audio Quality Problems**:
- Position microphone closer to speaker
- Use a quality microphone (lavalier mic recommended)
- Reduce background noise (HVAC, music during translation segments)
- Test audio levels before service starts

**Translation Delay**:
- Normal delay is 2-5 seconds (speech recognition + translation)
- Check internet connection speed
- Verify API services are responding quickly
- Consider using Deepgram for faster speech recognition

**Display Devices Not Updating**:
- Check WebSocket connection in browser console
- Verify all devices are on the same network
- Ensure firewall allows WebSocket connections (port 7714)
- Try refreshing the language page on the display device

**Text Too Small/Large on Display**:
- Use browser zoom (Ctrl/Cmd + or -)
- Adjust display device settings
- For projection, test visibility from back of room before service

## Production Deployment

### Reverse Proxy (nginx)

For production, use nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name mimiuchi.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:7714;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### SSL/TLS (HTTPS)

Use Let's Encrypt for free SSL:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d mimiuchi.yourdomain.com

# Auto-renewal is configured automatically
```

Update WebSocket connections to use `wss://` instead of `ws://`.

### Cloud Deployment

The Docker container can be deployed to:
- **AWS ECS** - Elastic Container Service
- **Google Cloud Run** - Serverless containers
- **Azure Container Instances** - Managed containers
- **DigitalOcean App Platform** - Simple deployment
- **Any VPS** with Docker support

#### Deployment Recommendations for Churches

**On-Premises (Recommended)**:
- Deploy on a church-owned computer/server
- Full control over data and costs
- No monthly hosting fees
- Works entirely on local network
- Best for: Churches with existing tech infrastructure

**Cloud-Based**:
- Deploy to a VPS or cloud service
- Accessible from anywhere (useful for online services)
- Requires monthly hosting fee ($5-20/month)
- Best for: Churches doing hybrid in-person/online services

**Hybrid**:
- Run locally during services
- Optionally use cloud for remote monitoring/testing
- Best for: Maximum flexibility

## Cost Considerations

### API Costs (Church Budget Friendly)

**Deepgram STT**: $0.0043/minute
- 1-hour service: ~$0.26
- Monthly (4 services): ~$1.04
- Yearly (52 services): ~$13.52

**OpenAI Whisper**: $0.006/minute
- 1-hour service: ~$0.36
- Monthly (4 services): ~$1.44
- Yearly (52 services): ~$18.72

**OpenAI GPT-4o-mini Translation**:
- Input: $0.150 per 1M tokens (~$0.01-0.02 per service)
- Output: $0.600 per 1M tokens (~$0.04-0.06 per service)
- 1-hour service: ~$0.05-0.08
- Monthly (4 services): ~$0.20-0.32
- Yearly (52 services): ~$2.60-4.16

**Total Estimates**:
- Per service (1 hour): ~$0.31-0.44
- Monthly (4 services): ~$1.50-2.00
- Yearly (52 services): ~$19.50-26.00

**Note**: Costs scale linearly with the number of languages enabled. The estimates above are per language stream.

### Free Alternatives

- **Web Speech API** (STT): Free, browser-based
  - Limited browser support (Chrome, Edge)
  - Requires manual enable in browser settings
  - Good option for churches with tight budgets
  - Quality may vary depending on speaker accent and audio quality

## Support

For issues or questions:
- GitHub Issues: https://github.com/naeruru/mimiuchi/issues
- Documentation: https://github.com/naeruru/mimiuchi

## License

GPL-3.0 License - See LICENSE file for details
