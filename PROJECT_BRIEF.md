Project Brief — MVP
Working Title

WaveType (placeholder)

One-line Description

A system-wide, hotkey-driven voice typing desktop app that transcribes speech and pastes clean text directly at the active cursor in any application.

Problem Statement

Typing is slow, tiring, and interrupts flow—especially for long messages, documentation, or rapid idea capture.
Existing voice dictation tools are:

tied to specific apps

cloud-dependent

slow to activate

intrusive to workflow

unreliable at cursor placement

Users want instant, private, universal voice input that behaves like a keyboard.

Target Users (MVP scope)

Developers

Writers

Knowledge workers

Power users who already use keyboard shortcuts heavily

Not targeting casual users yet.

Core Value Proposition

Press a hotkey, speak naturally, release the key—and the text appears exactly where the cursor is, in any app, with minimal latency and full privacy.

MVP Feature Set (strict)

1. System-Wide Voice Typing

Works in any focused application

Uses microphone input

No app switching required

Acceptance criteria

Text appears at the cursor in browsers, editors, IDEs, chat apps

2. Hotkey Control

Push-to-talk (hold key)

Toggle mode (press to start / press to stop)

User-configurable shortcuts

Acceptance criteria

Hotkeys work globally

No conflict with common system shortcuts

3. Offline Speech-to-Text

Local AI model downloaded during setup

No internet required after installation

Default language: English

Optional Bangla if model supports it well enough

Acceptance criteria

Transcription works fully offline

Clear indication when model is loading or unavailable

4. Cursor-Aware Text Injection

Text is inserted at the active cursor

Does not overwrite existing text

Clipboard is untouched (unless fallback required)

Acceptance criteria

Cursor position preserved

No visible copy-paste flicker

5. Basic Smart Formatting

Automatic punctuation

Sentence capitalization

New line detection from pauses

No advanced style rewriting.

6. Minimal UI

Tray/menu-bar icon

On/off indicator

Settings panel with:

hotkey configuration

language selection

model status (downloaded / loading)

No dashboards. No timelines. No chat UI.

7. Performance & Feedback

Audible or visual cue when recording starts/stops

Max transcription delay after release: ≤ 1.5 seconds on average hardware

Explicit Non-Goals (MVP)

Cloud transcription

User accounts or login

AI chat or prompt editing

Voice commands beyond dictation

Multi-speaker detection

App-specific modes

Text editing by voice

These are future concerns.

Technical Scope (suggested)

OS: Windows only (MVP)

Core engine: Rust or Go

UI: Tauri (lightweight)

Speech model: Faster-Whisper (CPU-first)

Hotkeys: Native OS hooks

Text injection: OS-level input simulation

Success Criteria (MVP validation)

The MVP is successful if:

A user can install and start dictating in under 5 minutes

The app works reliably across at least 5 different applications

Users prefer it over built-in OS dictation for speed and flow

Early users keep it installed after one week

MVP Timeline (realistic)

Week 1: audio capture + offline transcription

Week 2: hotkeys + cursor injection

Week 3: UI, settings, performance tuning

Week 4: internal testing + bug fixes

Core Philosophy

This is not a showcase of AI.
This is a replacement for typing.

If users forget the app exists—but keep using it—that’s success.
