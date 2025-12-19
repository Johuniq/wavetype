#!/bin/bash
# Sign release files for Tauri updater
# Run this script to generate signatures for your release files

set -e

RELEASE_DIR="./release-signing"
PRIVATE_KEY="$HOME/.tauri/wavetype.key"

# Check if private key exists
if [ ! -f "$PRIVATE_KEY" ]; then
    echo "Error: Private key not found at $PRIVATE_KEY"
    echo "Generate one with: pnpm tauri signer generate -w ~/.tauri/wavetype.key"
    exit 1
fi

# Create directory for signing
mkdir -p "$RELEASE_DIR"
cd "$RELEASE_DIR"

echo "=== WaveType Release Signing Script ==="
echo ""

# Download release files
echo "Downloading release files from GitHub..."

# macOS x64
curl -L -o "WaveType_x64.app.tar.gz" \
    "https://github.com/Johuniq/wavetype/releases/download/v1.0.0/WaveType_x64.app.tar.gz"

# macOS ARM64
curl -L -o "WaveType_aarch64.app.tar.gz" \
    "https://github.com/Johuniq/wavetype/releases/download/v1.0.0/WaveType_aarch64.app.tar.gz"

# Windows x64
curl -L -o "WaveType_1.0.0_x64-setup.exe" \
    "https://github.com/Johuniq/wavetype/releases/download/v1.0.0/WaveType_1.0.0_x64-setup.exe"

echo ""
echo "Downloaded files:"
ls -la

echo ""
echo "=== Signing files ==="
echo "You'll be prompted for your private key password for each file."
echo ""

# Sign macOS x64
echo "Signing WaveType_x64.app.tar.gz..."
pnpm tauri signer sign -k "$PRIVATE_KEY" "WaveType_x64.app.tar.gz"

# Sign macOS ARM64
echo "Signing WaveType_aarch64.app.tar.gz..."
pnpm tauri signer sign -k "$PRIVATE_KEY" "WaveType_aarch64.app.tar.gz"

# Sign Windows x64
echo "Signing WaveType_1.0.0_x64-setup.exe..."
pnpm tauri signer sign -k "$PRIVATE_KEY" "WaveType_1.0.0_x64-setup.exe"

echo ""
echo "=== Signatures generated ==="
echo ""

# Read signatures
SIG_MACOS_X64=$(cat "WaveType_x64.app.tar.gz.sig")
SIG_MACOS_ARM64=$(cat "WaveType_aarch64.app.tar.gz.sig")
SIG_WINDOWS_X64=$(cat "WaveType_1.0.0_x64-setup.exe.sig")

# Generate latest.json
cat > latest.json << EOF
{
  "version": "1.0.0",
  "notes": "WaveType v1.0.0 - Voice to Text Desktop Application\\n\\n- Whisper AI powered voice-to-text\\n- Push-to-talk and toggle modes\\n- Multiple model options\\n- Transcription history",
  "pub_date": "2025-12-19T00:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "$SIG_MACOS_X64",
      "url": "https://github.com/Johuniq/wavetype/releases/download/v1.0.0/WaveType_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "$SIG_MACOS_ARM64",
      "url": "https://github.com/Johuniq/wavetype/releases/download/v1.0.0/WaveType_aarch64.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "$SIG_WINDOWS_X64",
      "url": "https://github.com/Johuniq/wavetype/releases/download/v1.0.0/WaveType_1.0.0_x64-setup.exe"
    }
  }
}
EOF

echo "Generated latest.json with signatures:"
cat latest.json

echo ""
echo "=== Next Steps ==="
echo "1. Upload 'latest.json' to your GitHub release v1.0.0"
echo "2. Go to: https://github.com/Johuniq/wavetype/releases/edit/v1.0.0"
echo "3. Attach the file: $RELEASE_DIR/latest.json"
echo ""
echo "Files are in: $RELEASE_DIR/"
