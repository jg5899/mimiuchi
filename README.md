<p align="center">
  <img src="https://mimiuchi.com/logo-256x256.png" width="100">
</p>

# mimiuchi: Multi-Language Church Translation

mimiuchi is a free, accessible, real-time translation system designed for churches serving multi-language congregations. Whether you're a small church with immigrant families or a growing ministry reaching diverse communities, mimiuchi provides professional-quality live translation without expensive equipment or subscriptions.

Display live translations on screens throughout your sanctuary, provide hearing accessibility through real-time captions, or stream multiple language versions of your service simultaneously. UI supports English, Spanish (España), Japanese (日本語), and Chinese (简体中文).

Try it now at [mimiuchi.com](https://mimiuchi.com/) with Chrome, Safari, or Edge.

### Features

- Real-time speech-to-text transcription
- Multi-language translation powered by AI
- Separate display streams for each language
- Hearing accessibility through live captions
- Text-to-speech for vision accessibility
- WebSocket broadcasting to multiple devices
- Customizable text displays for projection
- Self-hosted deployment for privacy and reliability
- Zero recurring costs (when using free speech APIs)
- Browser-based - works on any device with Chrome, Safari, or Edge

## How to Use

### Basic Setup (Browser-Based)

1. Go to [mimiuchi.com](https://mimiuchi.com/) and press the mic button
2. Grant microphone access when prompted
3. Select your target languages from the settings
4. Open language-specific streams on display devices:
   - Spanish: `https://mimiuchi.com/#/spanish`
   - Ukrainian: `https://mimiuchi.com/#/ukrainian`
   - Russian: `https://mimiuchi.com/#/russian`
   - Add more languages as needed

### Church Service Workflow

1. **Main Sanctuary Screen**: Display original language captions for hearing accessibility
2. **Secondary Room Screens**: Show translated streams on tablets or displays
3. **Mobile Access**: Congregants can follow along on their own devices
4. **Recording**: Capture transcripts for sermon notes or accessibility archives

## Why mimiuchi?

### Accessibility for All

Every person deserves to understand and participate in worship. mimiuchi removes language barriers and provides hearing accessibility, ensuring your entire congregation can engage with services regardless of their native language or hearing ability.

### Built for Small Churches

Many translation systems cost thousands of dollars in equipment and hundreds per month in subscriptions. mimiuchi is completely free and runs on hardware you already have - laptops, tablets, and existing displays. Small churches with limited budgets can now offer the same accessibility as large ministries.

### Privacy-Focused

Your sermons and services remain private. When self-hosted using Docker, all translation processing happens through your chosen providers with enterprise-grade security. No data is stored or shared with third parties beyond the translation APIs you configure.

### Easy to Deploy

No IT expertise required. Our Docker deployment gets you running in minutes, and the browser-based interface works on any device without installing software.

## Docker Deployment (Recommended)

mimiuchi is designed to run as a self-hosted web service, perfect for churches. Deploy on a local server or cloud hosting for network-wide access.

### Benefits of Docker Deployment
- **Multi-device access** - Any device on your network can view streams
- **Reliable service** - Runs continuously without manual startup
- **Easy updates** - Pull latest features with simple commands
- **Cloud or local** - Deploy on-site or use affordable cloud hosting
- **Professional setup** - Looks and works like enterprise software

### Quick Start

```bash
# Clone the repository
git clone https://github.com/naeruru/mimiuchi.git
cd mimiuchi

# Build and start the container
npm run docker:build
npm run docker:run

# Access the application
# Main interface: http://localhost:3000
# Spanish stream: http://localhost:3000/#/spanish
# Ukrainian stream: http://localhost:3000/#/ukrainian
# Add more languages as needed
```

See [DOCKER.md](DOCKER.md) for complete deployment instructions, configuration options, API setup, and troubleshooting.

### Docker Features
- Real-time multi-language translation streams
- WebSocket broadcasting to all connected devices
- OpenAI GPT-4o-mini or other AI translation services
- Deepgram, Whisper, or browser-based speech-to-text
- Network accessible from any device
- Customizable translation languages

## Desktop App (Optional)

For advanced features or offline use, download the desktop Electron wrapper:

See the [release page](https://github.com/naeruru/mimiuchi/releases) to install the latest version.

The desktop version includes additional features like local OSC broadcasting for specialized setups, but most church uses are best served by the Docker deployment.

## Speech Recognition Technology

mimiuchi uses the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) for browser-based speech-to-text. This API is built into modern browsers (Chrome, Edge, Safari) and processes audio securely through Google Cloud Platform or Azure without the webpage accessing your audio directly. You can read about Chrome's privacy approach [here](https://www.google.com/chrome/privacy/whitepaper.html#speech).

We chose Web Speech API because it's completely free and requires no accounts, making it accessible to churches of any size. For self-hosted Docker deployments, you can also configure Deepgram or Whisper APIs for enhanced accuracy and additional language support.

## Roadmap

Planned improvements include:

- More customization options for text displays
- Additional speech-to-text provider options
- Locally-run Whisper for fully private operation
- Better translation model options
- Second control panel for quick setting adjustments
- Improved transcript export and archival
- Enhanced mobile display layouts
- WebGPU-based local inference (fully private, no cloud APIs needed)
- Continuous reliability improvements

## Building From Source

### Requirements

- [NodeJS 22.x+](https://nodejs.org/en/)

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build desktop application
npm run build  # Creates executable in release/
```

## Special Thanks

- [@fuwako](https://github.com/fuwako) for extensive feature work, UI updates, and quality-of-life improvements
- [@jeremio](https://github.com/jeremio) for code standardization and Transformers.js development
- [@gujimy](https://github.com/gujimy) for Chinese translations
- [@adrianpaniagualeon](https://github.com/adrianpaniagualeon) for Spanish translations
- [@fuopy](https://github.com/fuopy) for the name "mimiuchi"

## License

This project is licensed under GNU General Public License v3.0 - see the [LICENSE.txt](LICENSE.txt) file for details.
