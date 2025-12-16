# WaveType

WaveType is a desktop voice-to-text application that runs locally on Windows, macOS, and Linux. It provides fast, private transcription using local AI models, keyboard shortcuts for quick capture, and tools for managing transcription history. The project focuses on privacy, offline processing, and a streamlined user experience.

License: Proprietary (All rights reserved)

---

## Features

- Local AI transcription (no cloud uploads)
- Global hotkeys for push-to-talk and toggle recording
- File transcription for common audio formats (WAV, MP3, M4A, OGG, FLAC)
- History and export/import of transcriptions and settings
- Configurable models, language, and hotkey behavior

## Supported Platforms

- Windows (NSIS, MSI)
- macOS (DMG, .app)

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

## Configuration and data location

Settings and history are stored locally in an SQLite database in the platform's application data directory. Example locations:

- Windows: `%APPDATA%/com.johuniq.WaveType/`
- macOS: `~/Library/Application Support/com.johuniq.WaveType/`

## Security and privacy

- All transcription is performed locally; audio is not uploaded to remote services by default.
- The backend validates and sanitizes IPC inputs to reduce risk from malformed data.

## License

This project is proprietary software. See the `LICENSE` file for licensing terms and contact information to obtain a commercial license.

## Acknowledgements

- Whisper and related projects for transcription research
- Tauri for the cross-platform application framework

For bug reports and feature requests, open an issue on the project's GitHub repository.
