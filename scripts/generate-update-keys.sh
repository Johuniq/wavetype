#!/bin/bash

# WaveType Update Key Generation Script
# This script generates the signing keys needed for Tauri auto-updates

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Project root is one level up from scripts/
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔐 WaveType Update Key Generator"
echo "================================"
echo ""
echo "📁 Project root: $PROJECT_ROOT"
echo ""

# Check if Tauri CLI is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed"
    exit 1
fi

# Check for existing keys
KEYS_DIR="$PROJECT_ROOT/keys"
if [ -d "$KEYS_DIR" ]; then
    echo "⚠️  Keys directory already exists!"
    echo "   Location: $KEYS_DIR"
    read -p "   Overwrite existing keys? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "   Aborted."
        exit 0
    fi
    rm -rf "$KEYS_DIR"
fi

mkdir -p "$KEYS_DIR"

echo "📝 Generating signing keys..."
echo "   Note: You will be prompted for a password."
echo "   This password is used to encrypt the private key."
echo ""

# Generate the keys using Tauri CLI
cd "$PROJECT_ROOT/src-tauri"
pnpm tauri signer generate -w "$KEYS_DIR/wavetype.key"
cd "$PROJECT_ROOT"

echo ""
echo "✅ Keys generated successfully!"
echo ""
echo "📁 Files created:"
echo "   - $KEYS_DIR/wavetype.key (PRIVATE - keep secure!)"
echo "   - $KEYS_DIR/wavetype.key.pub (PUBLIC - put in tauri.conf.json)"
echo ""

# Read and display the public key
if [ -f "$KEYS_DIR/wavetype.key.pub" ]; then
    PUBKEY=$(cat "$KEYS_DIR/wavetype.key.pub")
    echo "🔑 Your public key (copy this to tauri.conf.json):"
    echo "   $PUBKEY"
    echo ""
fi

echo "📋 Next steps:"
echo "   1. Copy the public key above into tauri.conf.json:"
echo '      "updater": { "pubkey": "YOUR_PUBLIC_KEY_HERE" }'
echo ""
echo "   2. Add these GitHub secrets for CI/CD:"
echo "      - TAURI_SIGNING_PRIVATE_KEY: contents of $KEYS_DIR/wavetype.key"
echo "      - TAURI_SIGNING_PRIVATE_KEY_PASSWORD: the password you entered"
echo ""
echo "   3. Add the private key to your secure backup!"
echo ""
echo "⚠️  SECURITY WARNING:"
echo "   - NEVER commit the private key to git"
echo "   - Add '$KEYS_DIR/' to your .gitignore"
echo ""
