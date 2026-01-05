# WaveType

WaveType is a desktop voice-to-text application that runs locally on Windows, macOS, and Linux. It provides fast, private transcription using local AI models, keyboard shortcuts for quick capture, and tools for managing transcription history. The project focuses on privacy, offline processing, and a streamlined user experience.

## 🐧 Free Forever on Linux!

**WaveType is completely free for Linux users** — no license required, no trial limits, no restrictions. This is our way of giving back to the open-source community that makes projects like this possible. Thank you for your support! ❤️

License: Proprietary (All rights reserved) | **Free for Linux users**

---

## Features

- Local AI transcription (no cloud uploads)
- Global hotkeys for push-to-talk and toggle recording
- File transcription for common audio formats (WAV, MP3, M4A, OGG, FLAC)
- History and export/import of transcriptions and settings
- Configurable models, language, and hotkey behavior
- 🍎 **macOS**: Parakeet support (Apple's on-device speech recognition)

## Supported Platforms

| Platform | Formats | License |
|----------|---------|---------|
| 🐧 Linux | AppImage, DEB, RPM | **Free Forever** |
| 🪟 Windows | NSIS, MSI | Paid (with trial) |
| 🍎 macOS | DMG, .app | Paid (with trial) |

**Note:** See [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) for detailed installation instructions, including how to handle security warnings on macOS and Windows.

## Usage

1. Launch the application.
2. Complete the setup to choose a default model and language.
3. Use the configured hotkey to record and transcribe speech.
4. View previous transcriptions in the History view; copy or export entries as needed.

Recording modes

| Mode         | Hotkey                                 | Behavior                                      |
| ------------ | -------------------------------------- | --------------------------------------------- |
| Push-to-talk | configurable (default: `Alt+Shift+S`) | Hold to record, release to transcribe         |
| Toggle       | configurable (default: `Alt+Shift+D`) | Press to start recording, press again to stop |

## Configuration and data location

Settings and history are stored locally in an SQLite database in the platform's application data directory. Example locations:

- Linux: `~/.local/share/com.johuniq.WaveType/`
- Windows: `%APPDATA%/com.johuniq.WaveType/`
- macOS: `~/Library/Application Support/com.johuniq.WaveType/`

## Security and privacy

- All transcription is performed locally; audio is not uploaded to remote services by default.
- The backend validates and sanitizes IPC inputs to reduce risk from malformed data.
- Strong encryption (AES-256-GCM) for sensitive data storage.
- Open-source code for transparency and security auditing.

## Installation

⚠️ **First-time installation?** See [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) for detailed instructions, including how to handle security warnings on macOS and Windows.

**Quick install:**
1. Download the latest release for your platform from [Releases](https://github.com/your-repo/WaveType/releases)
2. Follow the installation steps in the guide above
3. On first launch, you may need to bypass a security warning (one-time only)

**Why security warnings?** As a solo developer project, we distribute without code signing certificates ($299-599/year) to keep the project sustainable. The code is open-source and auditable - see our [Security Policy](SECURITY.md) for details.

## License

This project is proprietary software. See the `LICENSE` file for licensing terms and contact information to obtain a commercial license.

## Acknowledgements

- Whisper and related projects for transcription research
- Tauri for the cross-platform application framework

For bug reports and feature requests, open an issue on the project's GitHub repository.
