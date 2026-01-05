# WaveType - Complete Feature Documentation

**WaveType** is a privacy-first desktop application for offline voice-to-text transcription. It enables users to record speech, transcribe it using local AI models, and inject the text directly into any application with advanced post-processing and keyboard automation.

---

## Table of Contents

1. [Core Features](#core-features)
2. [Voice Recording & Transcription](#voice-recording--transcription)
3. [Text Processing & Injection](#text-processing--injection)
4. [Hotkey & Keyboard Shortcuts](#hotkey--keyboard-shortcuts)
5. [Model Management](#model-management)
6. [History & Data Management](#history--data-management)
7. [Settings & Configuration](#settings--configuration)
8. [License Management](#license-management)
9. [Error Handling & Reporting](#error-handling--reporting)
10. [Platform Support](#platform-support)

---

## Core Features

### 1. **Local AI Transcription (Offline)**
- **No Cloud Uploads**: All audio processing happens locally on the user's device
- **Privacy by Design**: Audio data never leaves the machine
- **Powered by OpenAI Whisper**: Uses `whisper-rs` bindings for CPU-based inference
- **Fast Inference**: Multi-threaded processing optimized for Windows, macOS, and Linux
- **99+ Languages**: Supports automatic language detection or manual language selection

### 2. **Universal Text Injection**
- **Works Everywhere**: Inject transcribed text into any application (browsers, IDEs, chat apps, etc.)
- **Cross-Platform**: Windows (SendInput API via Enigo), macOS (Keyboard events), Linux
- **Multiple Input Methods**:
  - Direct text injection
  - Clipboard mode (copy to clipboard instead)
  - Voice commands for automation
- **Real-Time Cursor Insertion**: Text appears at the active cursor position

### 3. **Global Hotkey Support**
- **Push-to-Talk Mode**: Hold hotkey to record, release to transcribe and inject
- **Toggle Mode**: Press hotkey to start recording, press again to stop
- **Customizable Keys**: Users can configure their preferred hotkeys
- **Always-On**: Works even when app window is minimized or in background

### 4. **Desktop Integration**
- **System Tray**: Minimize to system tray with quick access
- **Tray Controls**: Start/stop recording from tray menu
- **Recording Overlay**: Optional fullscreen wave visualization during recording
- **Auto-Start on Boot**: Launch app automatically at system startup (configurable)

---

## Voice Recording & Transcription

### Audio Recording
- **Multiple Input Devices**: Select from available microphones on the system
- **Real-Time Level Monitoring**: Visual feedback during recording
- **Push-to-Talk / Toggle Modes**: Two recording strategies:
  - **Push-to-Talk** (default: `Alt+Shift+S`): Hold for recording, release to stop
  - **Toggle** (default: `Alt+Shift+D`): Press to start, press to stop

### Transcription Features
- **Direct Audio Transcription**: Transcribe microphone input in real-time
- **File Transcription**: Import and transcribe audio files
- **Supported Audio Formats**:
  - WAV, MP3, M4A, OGG, FLAC, AAC, WebM, MKV
  - Maximum file size: 500MB
- **Language Support**:
  - English (en)
  - Bangla (bn)
  - Auto-detection (empty selection)
  - 99+ additional languages via Whisper model

### Transcription Performance Optimization
- **Speed Settings**:
  - Greedy decoding for fastest results
  - Single-segment mode for short recordings (<30 seconds)
  - Configurable token limits (default: 128 tokens per utterance)
  - Multi-threaded processing (all available CPU cores)
- **Platform-Specific Optimizations**:
  - **Windows**: Uses all CPU cores, higher entropy threshold for speed
  - **macOS**: Capped at 8 threads, optimized for M1/M2 chips
  - **Linux**: Adaptive threading

### Recording Indicator
- **Visual Feedback**: Animated waveform during active recording
- **Optional Display**: Can be enabled/disabled in settings
- **Recording Overlay**: Fullscreen wave visualization (optional)

---

## Text Processing & Injection

### Automatic Post-Processing
Intelligent text formatting with the following capabilities:

#### 1. **Sentence & Grammar Correction**
- Automatic sentence case correction
- Capitalization of proper nouns
- Abbreviation expansion (e.g., "dr" → "Dr.")

#### 2. **Code-Specific Formatting**
- **File Path Recognition**: Converts `slash path to file slash` → `/path/to/file`
- **Variable Detection**: Identifies camelCase, snake_case, SCREAMING_SNAKE_CASE
- **Function Recognition**: Detects function names (e.g., `function name` → `functionName()`)
- **Class Names**: Converts class notation (e.g., `my class` → `MyClass`)
- **File Mentions**: Recognizes `@file` syntax for file references

#### 3. **Symbol & Punctuation Handling**
- Converts verbal punctuation (e.g., "dot", "dash", "underscore") to symbols
- Smart quote handling (straight vs. curly quotes)
- Bracket and parenthesis auto-completion

#### 4. **Whitespace Cleanup**
- Removes extra spaces and line breaks
- Normalizes whitespace around punctuation

#### 5. **Voice Commands Processing** (Highest Priority)
Commands can be embedded in speech and are automatically executed:

| Command | Action |
|---------|--------|
| `[[UNDO]]` | Ctrl+Z (Cmd+Z on macOS) |
| `[[REDO]]` | Ctrl+Y (Cmd+Shift+Z on macOS) |
| `[[COPY]]` | Copy selected text |
| `[[CUT]]` | Cut selected text |
| `[[PASTE]]` | Paste from clipboard |
| `[[SELECT_ALL]]` | Select all text |
| `[[BACKSPACE]]` | Delete character before cursor |
| `[[BACKSPACE_WORD]]` | Delete word before cursor |
| `[[DELETE_LINE]]` | Delete entire line |
| `[[ENTER]]` | Insert new line |
| `[[TAB]]` | Insert tab |
| `[[ESCAPE]]` | Press Escape key |
| `[[HOME]]` | Go to line start |
| `[[END]]` | Go to line end |
| `[[LEFT]]` | Move cursor left |
| `[[RIGHT]]` | Move cursor right |
| `[[UP]]` | Move cursor up |
| `[[DOWN]]` | Move cursor down |
| `[[WORD_LEFT]]` | Move cursor left by word (Ctrl+Left) |
| `[[WORD_RIGHT]]` | Move cursor right by word (Ctrl+Right) |

### Text Injection Methods
1. **Direct Injection** (Default): Text appears instantly at cursor
2. **Clipboard Mode**: Text copied to clipboard for manual pasting

### Keyboard Shortcuts
All keyboard shortcuts are accessible via command invocation:
- **Standard Editing**: Undo, Redo, Cut, Copy, Paste, Select All
- **Navigation**: Home, End, Page Up, Page Down, Arrow keys, Word navigation
- **Deletion**: Backspace, Delete, Delete word, Delete line
- **Text Control**: Tab, Enter, Escape

---

## Hotkey & Keyboard Shortcuts

### Hotkey Configuration
Users can customize hotkeys during setup or in settings:

| Setting | Options | Default |
|---------|---------|---------|
| Recording Hotkey | Any key combination | `Alt+Shift+S` (Windows/Linux), `Cmd+Shift+S` (macOS) |
| Recording Mode | Push-to-Talk / Toggle | Push-to-Talk |
| Alternate Hotkey | Any key combination | `Alt+Shift+D` |

### Hotkey Behavior
- **Global Registration**: Works even when app is in background
- **Platform Specific**: Uses native hotkey APIs (Windows Registry, Carbon Events on macOS)
- **Multi-Key Support**: Ctrl, Shift, Alt, Meta key combinations
- **Single Key Alternative**: Support for quick toggle hotkey

### Hotkey Events
- **Press Event**: Fired when hotkey is pressed down
- **Release Event**: Fired when hotkey is released
- **Tray Events**: Separate hotkey signals from system tray menu

---

## Model Management

### Whisper Models
Supports OpenAI Whisper models in multiple sizes:

| Model | Size | Accuracy | Speed | RAM Needed |
|-------|------|----------|-------|-----------|
| Tiny | 39 MB | Good | Very Fast | <1 GB |
| Base | 75 MB | Better | Fast | ~1 GB |
| Small | 244 MB | Good+ | Medium | ~2 GB |
| Medium | 769 MB | Very Good | Slower | ~5 GB |
| Large | 2.9 GB | Excellent | Slow | ~10 GB |

### Model Operations
- **Download Models**: Download from HuggingFace with progress tracking
- **Manage Downloads**: Cancel, pause, or delete model downloads
- **Load/Unload**: Switch between models without restarting
- **Language Selection**: Choose language per model load
- **Storage Management**: View model locations and sizes

### Download Features
- **Background Download**: Download while using other features
- **Progress Reporting**: Real-time download progress (percentage, speed, ETA)
- **Resume Support**: Can resume interrupted downloads
- **Smart Caching**: Models cached locally for fast reuse

---

## History & Data Management

### Transcription History
Every transcribed text is automatically saved with metadata:

**Stored Information**:
- **Text**: Full transcribed content
- **Model ID**: Which model was used
- **Language**: Language used for transcription
- **Duration**: Recording/transcription time in milliseconds
- **Timestamp**: Creation date and time

**History Features**:
- **Browse History**: View all past transcriptions
- **Pagination**: Load 20 items at a time
- **Search/Filter**: Find transcriptions by text content
- **Copy to Clipboard**: Quick copy of past transcriptions
- **Export**: Download history as JSON
- **Delete**: Remove individual entries
- **Clear All**: Delete entire history with confirmation

### Data Management
- **Database Location**:
  - Windows: `%APPDATA%/com.johuniq.WaveType/`
  - macOS: `~/Library/Application Support/com.johuniq.WaveType/`
  - Linux: `~/.config/com.johuniq.WaveType/`
- **SQLite Backend**: All data stored in local SQLite database
- **Encryption**: Sensitive data encrypted with AES-256-GCM
- **Backup**: Users can export/import settings and history

### Export/Import
**Export Format**: JSON with version metadata
```json
{
  "version": "1.0.0",
  "exportedAt": "2025-12-24T10:30:00Z",
  "history": [
    {
      "id": 1,
      "text": "Hello world",
      "model_id": "base",
      "language": "en",
      "duration_ms": 2500,
      "created_at": "2025-12-24T10:29:00Z"
    }
  ]
}
```

**Supported Operations**:
- Export all history
- Import previous exports
- Validate import data
- Merge with existing history

---

## Settings & Configuration

### User Settings

#### Recording Settings
```typescript
pushToTalkKey: string;      // Hotkey for push-to-talk
toggleKey: string;           // Hotkey for toggle mode
hotkeyMode: "push-to-talk" | "toggle";  // Default recording method
```

#### Language & Model
```typescript
language: "en" | "bn";       // Transcription language
selectedModelId: string;     // Currently active model
```

#### UI Preferences
```typescript
showRecordingIndicator: boolean;    // Show wave animation
playAudioFeedback: boolean;         // Play sound on record start/stop
showRecordingOverlay: boolean;      // Show fullscreen overlay during recording
```

#### Post-Processing
```typescript
postProcessingEnabled: boolean;     // Enable text formatting
```

#### Output Mode
```typescript
clipboardMode: boolean;     // false = inject, true = clipboard
```

#### Advanced Options
```typescript
autoStartOnBoot: boolean;   // Launch on system startup
minimizeToTray: boolean;    // Hide to tray when window closes
```

### Persistent Storage
- **Database**: SQLite
- **Encryption**: AES-256-GCM for sensitive fields
- **Automatic Save**: Settings saved on change
- **No Cloud Sync**: All data remains local

---

## License Management

### License System
WaveType uses a proprietary license management system:

**License Types**:
- **Trial**: Limited-time evaluation access (default)
- **Full License**: Unlimited usage after activation

### License Information
```typescript
interface License {
  licenseKey?: string;              // License activation key
  displayKey?: string;              // Truncated key for display
  activationId?: string;            // Unique activation ID
  status: "trial" | "active" | "expired" | "invalid";
  customerEmail?: string;           // Licensed to email
  customerName?: string;            // Licensee name
  benefitId?: string;               // License product ID
  expiresAt?: string;               // Expiration date (ISO 8601)
}
```

### License Operations
- **Get License**: Retrieve current license info
- **Activate**: Activate with license key
- **Validate**: Check license status
- **Deactivate**: Release license from device
- **Clear Cache**: Reset device authentication

### Trial Management
- **Trial Duration**: Configurable time limit
- **Device Binding**: License tied to specific device
- **Device ID**: Unique hardware identifier for activation
- **Activation ID**: Proof of license on current device

### License Features
- **Offline Validation**: License checked locally
- **Device Limit**: Number of devices per license
- **Cloud-Free**: License validation without cloud (optional)

---

## Error Handling & Reporting

### Error Categories
The application tracks errors across multiple categories:

| Category | Examples |
|----------|----------|
| **Recording** | Microphone unavailable, permission denied, buffer overflow |
| **Transcription** | Model not loaded, inference failure, invalid audio |
| **File Operations** | File not found, permission denied, invalid format |
| **Download** | Network error, corrupted download, storage full |
| **Text Injection** | Window unavailable, keyboard event failed |
| **License** | Invalid key, activation failed, aexpired license |
| **Settings** | Invalid configuration, database corruption |

### Error Reporting
- **Severity Levels**: Debug, Info, Warning, Error, Critical
- **Automatic Collection**: Errors logged with context
- **User Reports**: Users can submit detailed error reports
- **Statistics**: Track error frequency and patterns
- **Non-Invasive**: Errors don't crash the app

### Error Recovery
- **Graceful Degradation**: App continues with reduced functionality
- **User Feedback**: Clear error messages in UI
- **Retry Logic**: Automatic retry for transient failures
- **Fallback Modes**: Alternative methods when primary fails

### Error View
- **Error History**: View past errors with timestamps
- **Stack Traces**: Detailed technical information
- **Export**: Send error logs for debugging
- **Clear Logs**: Delete error history

---

## Platform Support

### Windows
- **OS Versions**: Windows 10 and later
- **Architecture**: x86_64 (64-bit)
- **Installation**: MSI installer or NSIS portable
- **Features**: All features fully supported
- **Hotkeys**: Global hotkey registration via Windows Registry
- **Audio**: Windows Audio Session API (WASAPI)
- **Text Injection**: SendInput API via Enigo library

### macOS
- **OS Versions**: macOS 10.13 and later
- **Architecture**: x86_64 and ARM64 (Apple Silicon)
- **Installation**: DMG package with .app bundle
- **Signing**: Code-signed for Gatekeeper compliance
- **Entitlements**: Audio recording, accessibility (optional for text injection)
- **Audio**: AVFoundation framework
- **Text Injection**: Carbon Events API

### Linux
- **OS Support**: Ubuntu 20.04+, Fedora 32+, Debian 11+
- **Architecture**: x86_64
- **Installation**: AppImage, deb (Ubuntu/Debian), rpm (Fedora)
- **Audio**: PulseAudio or ALSA
- **Text Injection**: X11/Wayland support (via Enigo)

### Minimum System Requirements
- **RAM**: 2 GB minimum, 4 GB recommended
- **Storage**: 500 MB for base model + app
- **CPU**: Dual-core processor minimum, quad-core recommended
- **Microphone**: Any system-compatible microphone

### Performance Characteristics
- **Idle Memory**: ~100-150 MB
- **Recording Memory**: ~150-200 MB
- **Transcription Memory**: Varies by model (see Model Management)
- **CPU Usage**: 20-100% during transcription (model dependent)
- **Startup Time**: 1-2 seconds (after setup)
- **Transcription Speed**: Real-time to 2x real-time (varies by model and hardware)

---

## Technical Architecture

### Backend (Rust with Tauri)
- **Framework**: Tauri 2.x
- **Audio Processing**: `cpal` for cross-platform audio capture
- **Transcription**: `whisper-rs` for OpenAI Whisper
- **Text Injection**: `enigo` library for keyboard/mouse control
- **Database**: SQLite3 with `rusqlite`
- **Encryption**: AES-256-GCM for sensitive data
- **Logging**: Structured logging with `tracing`
- **Download**: HTTP client for model downloads

### Frontend (React + TypeScript)
- **Framework**: React 18.x
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI (accessibility-first)
- **State Management**: Zustand
- **Type Safety**: Full TypeScript
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React

### IPC Communication
- **Tauri Commands**: Bidirectional command/response pattern
- **Event System**: Real-time events for downloads, transcription, errors
- **Error Serialization**: Type-safe error messages

---

## Security Considerations

### Privacy
- ✅ **Offline Processing**: No internet connection required
- ✅ **No Telemetry**: No user tracking or analytics
- ✅ **Local Storage**: All data stored locally
- ✅ **No Cloud Uploads**: Audio processed entirely locally

### Data Protection
- ✅ **Encryption**: AES-256-GCM for sensitive data
- ✅ **Input Validation**: All IPC inputs sanitized
- ✅ **Path Validation**: File paths validated and sanitized
- ✅ **Text Sanitization**: Limits on text length and control characters

### Code Security
- ✅ **Memory Safety**: Rust's memory safety guarantees
- ✅ **Type Safety**: Full TypeScript on frontend
- ✅ **Dependency Auditing**: Regular security audits
- ✅ **Open Source**: Code available for security review

---

## Future Roadmap

Potential features for future releases:
- [ ] Multi-language mixing in single recording
- [ ] Real-time transcription preview
- [ ] Custom post-processing rules
- [ ] Cloud model support (optional)
- [ ] Plugin system for extensions
- [ ] Advanced hotkey macros
- [ ] Transcription quality metrics
- [ ] Accessibility improvements

---

## Support & Resources

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Inline code documentation and README files
- **Installation Guide**: Platform-specific installation instructions
- **Configuration**: Help with settings and optimization

---

**Version**: 1.0.0  
**Last Updated**: December 2025  
**License**: Proprietary (All rights reserved)
