#!/bin/bash
set -e

# Swift Parakeet Sidecar Build Script
# Builds the Swift sidecar binary for WaveType following Tauri v2 sidecar conventions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"

echo "🔨 Building Swift Parakeet Sidecar..."

# Determine build configuration
BUILD_CONFIG="release"
echo "📦 Build configuration: $BUILD_CONFIG"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "$SCRIPT_DIR/.build"

# Build Swift package
echo "🏗️  Compiling Swift package..."
cd "$SCRIPT_DIR"
swift build -c "$BUILD_CONFIG"

# Create dist directory
mkdir -p "$DIST_DIR"

# Determine Rust target triple (Tauri expects this format)
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    ARCH="aarch64"
fi

# Map to Rust target triple
case "$(uname -s)" in
    Darwin)
        TARGET_TRIPLE="${ARCH}-apple-darwin"
        ;;
    *)
        echo "❌ Unsupported platform: $(uname -s). Parakeet sidecar is macOS only."
        exit 1
        ;;
esac

echo "🖥️  Target triple: $TARGET_TRIPLE"

# Copy binary with correct name for Tauri
BUILD_PATH=".build/release/ParakeetSidecar"

if [ ! -f "$BUILD_PATH" ]; then
    echo "❌ Error: Binary not found at $BUILD_PATH"
    exit 1
fi

# Copy with Tauri-expected naming: parakeet-sidecar-$TARGET_TRIPLE
OUTPUT_PATH="$DIST_DIR/parakeet-sidecar-$TARGET_TRIPLE"
cp "$BUILD_PATH" "$OUTPUT_PATH"
echo "✅ Binary copied to: $OUTPUT_PATH"

# Make executable
chmod +x "$OUTPUT_PATH"

# Create symlink for Tauri's externalBin configuration
# Tauri expects to find "parakeet-sidecar" during bundling, but at runtime
# it will automatically append the target triple and look for the full name
SYMLINK_PATH="$DIST_DIR/parakeet-sidecar"
ln -sf "$(basename "$OUTPUT_PATH")" "$SYMLINK_PATH"
echo "🔗 Symlink created: parakeet-sidecar -> $(basename "$OUTPUT_PATH")"

echo "🎉 Swift sidecar build complete!"
