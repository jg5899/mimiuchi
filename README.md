<p align="center">
  <img src="https://mimiuchi.com/logo-256x256.png" width="100">
</p>

# mimiuchi: speech-to-text

mimiuchi is a free, customizable desktop speech-to-text application with real-time translation and streaming capabilities. Stream transcriptions and translations to any device on your network via WebSocket, HTTP server, or webhooks. UI supports 11 languages: English, Spanish, Japanese, Chinese, Romanian, Ukrainian, Russian, French, German, Portuguese, and Italian!

### Features

- **Speech-to-Text** - Web Speech API (free), Deepgram, or Whisper (OpenAI)
- **Text-to-Speech** - TikTok, Web Speech API, or Yukumo
- **Real-time Translation** - On-device (Transformers.js) or OpenAI API with contextual translation support
- **Speaker Profiles** - Custom vocabulary and context prompts for specialized domains
- **HTTP Display Server** - Built-in server streams transcriptions to any browser on port 8080 (configurable)
- **WebSocket Streaming** - Stream transcriptions to any device on your network
- **Webhooks** - POST transcriptions to custom endpoints
- **Connection Info with QR Codes** - Easy setup for mobile devices with auto-generated QR codes
- **Customizable UI** - Extensive text appearance and behavior settings

## How to use

1. **Download** the desktop application from the [releases page](https://github.com/naeruru/mimiuchi/releases/)
2. **Configure** your STT engine (Web Speech API is free and requires no setup)
3. **Optional**: Add API keys for advanced features (Deepgram, Whisper, OpenAI Translation)
4. **Click** the MIC button to start transcription
5. **Stream** transcriptions to other devices by enabling broadcast and connecting to the displayed WebSocket URL

# Additional info

### Why?

I support the idea of people having many ways to communicate and do things. It is important to give people those tools and make them easily accessible. This app provides powerful speech-to-text with translation capabilities that can be streamed to any application or device. It's free, focused on privacy, and designed to be flexible for various use cases - from accessibility tools to live streaming, church services, or presentations.

## STT Engines

mimiuchi supports multiple speech-to-text engines:

- **Web Speech API (Free)**: Built-in browser STT, requires no API keys. Chrome uses Google's servers, Edge uses Azure.
- **Deepgram**: Professional-grade STT with custom vocabulary support. Requires API key.
- **Whisper (OpenAI)**: High-accuracy STT with GPT-4o post-processing option. Requires API key.

Each engine has trade-offs between cost, accuracy, latency, and privacy. Choose based on your needs.

## Todo

in no particular order...

- more customization for text window
- ~~better intermediate text results~~ ✅
- ~~text-to-speech~~ ✅
- more TTS/STT options
- ~~add ability to export settings/transcripts~~✅
- ~~better webkit/safari support~~✅
- ~~translation support~~✅
- ~~webhook/websocket customization to connect to other apps~~✅
- ~~speaker profiles with custom vocabulary~~✅
- ~~built-in HTTP server for display clients~~✅
- ~~connection info UI with QR codes~~✅
- documentation
- integration tests
- locally run whisper c++ bindings / WebGPU based inference
  - this point is really important to me, because I want a truly low latency private STT system. but.. I want to make sure I do it the right way, such that it can work entirely in the browser, utilizing the full power of your GPU or CPU, completely local and with minimal latency. A lot of this is very new, so it may take some time to iron it out. the first versions of it may differ greatly from the end goal.

## Download

See the [release page](https://github.com/naeruru/mimiuchi/releases) to install the latest version of the desktop app.

## Building it yourself

### Requirements

- [NodeJS 22.x+](https://nodejs.org/en/)

### Setup

Use `npm install` to install dependencies.

Use `npm run dev` to run the application. It will run an electron version and web version.

Or you can use `npm run build` to build the application. It will create an exe file in `release/`.

## Special Thanks

- [@fuwako](https://github.com/fuwako) who has done a ton of work in adding a lot of great features, updating parts of the UI, and many QOL improvements.
- [@jeremio](https://github.com/jeremio) who has done a lot of work in standardizing and formatting the code, as well as working on some of the Transformers.js code.
- [@gujimy](https://github.com/gujimy) for the bulk of the Chinese translations
- [@adrianpaniagualeon](https://github.com/adrianpaniagualeon) for the bulk of the Spanish translations
- [@fuopy](https://github.com/fuopy) for the name, mimiuchi, which lends the name from a project they made long ago!

## License

This project is licensed under GNU General Public License v3.0 - see the [LICENSE.txt](LICENSE.txt) file for details.
