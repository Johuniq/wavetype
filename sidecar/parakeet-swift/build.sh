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

# Determine target architecture - can be overridden by TAURI_ENV_TARGET_TRIPLE
# or parsed from Rust's target triple format
if [ -n "$TAURI_ENV_TARGET_TRIPLE" ]; then
    # Extract arch from Tauri's target triple (e.g., x86_64-apple-darwin -> x86_64)
    TARGET_ARCH=$(echo "$TAURI_ENV_TARGET_TRIPLE" | cut -d'-' -f1)
    TARGET_TRIPLE="$TAURI_ENV_TARGET_TRIPLE"
    echo "🎯 Building for Tauri target: $TARGET_TRIPLE"
else
    # Default to host architecture
    TARGET_ARCH=$(uname -m)
    if [ "$TARGET_ARCH" = "arm64" ]; then
        TARGET_ARCH="aarch64"
    fi
    TARGET_TRIPLE="${TARGET_ARCH}-apple-darwin"
    echo "🖥️  Building for host: $TARGET_TRIPLE"
fi

# Map architecture to Swift's --arch flag
case "$TARGET_ARCH" in
    x86_64)
        SWIFT_ARCH="x86_64"
        ;;
    aarch64|arm64)
        SWIFT_ARCH="arm64"
        ;;
    *)
        echo "❌ Unsupported architecture: $TARGET_ARCH"
        exit 1
        ;;
esac

echo "🏗️  Target architecture: $SWIFT_ARCH"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "$SCRIPT_DIR/.build"

# Build Swift package with explicit architecture
echo "🏗️  Compiling Swift package for $SWIFT_ARCH..."
cd "$SCRIPT_DIR"
swift build -c "$BUILD_CONFIG" --arch "$SWIFT_ARCH"

# Create dist directory
mkdir -p "$DIST_DIR"

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
