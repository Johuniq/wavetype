# WaveType

WaveType is a desktop voice-to-text application that runs locally on Windows, macOS, and Linux. It provides fast, private transcription using local AI models, keyboard shortcuts for quick capture, and tools for managing transcription history. The project focuses on privacy, offline processing, and a streamlined user experience.

License: MIT

Key technologies: Tauri, Rust, React, whisper-rs

---

## Features

- Local AI transcription (no cloud uploads)
- Global hotkeys for push-to-talk and toggle recording
- File transcription for common audio formats (WAV, MP3, M4A, OGG, FLAC)
- History and export/import of transcriptions and settings
- Configurable models, language, and hotkey behavior

## Supported Platforms

- Linux (AppImage, .deb)
- Windows (NSIS, MSI)
- macOS (DMG, .app)

## Quick Start

Requirements

- Node.js 18+ and `pnpm`
- Rust toolchain (stable, recent version)
- Platform dependencies (see details below)

Development

```bash
git clone https://github.com/johuniq/WaveType.git
cd WaveType
pnpm install
pnpm tauri dev
```

Production build

```bash
pnpm tauri build
# Or use the helper script
./scripts/build-production.sh
```

Build artifacts are written to `src-tauri/target/release/bundle/`.

## Usage

1. Launch the application.
2. Complete the setup to choose a default model and language.
3. Use the configured hotkey to record and transcribe speech.
4. View previous transcriptions in the History view; copy or export entries as needed.

Recording modes

| Mode         | Hotkey                                 | Behavior                                      |
| ------------ | -------------------------------------- | --------------------------------------------- |
| Push-to-talk | configurable (default: `Ctrl+Shift+R`) | Hold to record, release to transcribe         |
| Toggle       | configurable (default: `Ctrl+Shift+T`) | Press to start recording, press again to stop |

## Project structure

Top-level layout:

```
WaveType/
├── src/           # React frontend (components, hooks, store, assets)
├── src-tauri/     # Rust backend (audio, transcription, database)
└── scripts/       # Build and packaging helpers
```

## Configuration and data location

Settings and history are stored locally in an SQLite database in the platform's application data directory. Example locations:

- Linux: `~/.local/share/com.johuniq.WaveType/`
- Windows: `%APPDATA%/com.johuniq.WaveType/`
- macOS: `~/Library/Application Support/com.johuniq.WaveType/`

## Security and privacy

- All transcription is performed locally; audio is not uploaded to remote services by default.
- The backend validates and sanitizes IPC inputs to reduce risk from malformed data.

## Contributing

Contributions are welcome. Suggested workflow:

1. Fork the repository
2. Create a feature branch
3. Open a pull request describing your change

Please run tests and linters where applicable before submitting a PR.

## License

This project is distributed under the MIT License. See the `LICENSE` file for details.

## Acknowledgements

- Whisper and related projects for transcription research
- Tauri for the cross-platform application framework

For bug reports and feature requests, open an issue on the project's GitHub repository.
