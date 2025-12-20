#!/bin/bash

# Script to reset WaveType trial data
# This will clear your trial and license data, allowing you to start fresh

echo "WaveType Trial Reset Script"
echo "============================"
echo ""

# Find the app data directory based on OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    APP_DATA_DIR="$HOME/.local/share/com.johuniq.vox-ai"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    APP_DATA_DIR="$HOME/Library/Application Support/com.johuniq.vox-ai"
else
    echo "Unsupported OS. Please manually delete the database file."
    exit 1
fi

echo "App data directory: $APP_DATA_DIR"
echo ""

# Check if directory exists
if [ ! -d "$APP_DATA_DIR" ]; then
    echo "App data directory not found. Nothing to reset."
    exit 0
fi

# Backup first
BACKUP_DIR="${APP_DATA_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
echo "Creating backup at: $BACKUP_DIR"
cp -r "$APP_DATA_DIR" "$BACKUP_DIR"

# List files
echo ""
echo "Files in app data directory:"
ls -lh "$APP_DATA_DIR"
echo ""

# Ask for confirmation
read -p "Do you want to reset trial data? This will delete vox-ai.db (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    DB_FILE="$APP_DATA_DIR/vox-ai.db"
    
    if [ -f "$DB_FILE" ]; then
        echo "Deleting database: $DB_FILE"
        rm "$DB_FILE"
        echo "✓ Database deleted"
        echo ""
        echo "Your trial data has been reset."
        echo "Backup saved at: $BACKUP_DIR"
        echo ""
        echo "Next time you start WaveType, it will create a new database with a fresh 7-day trial."
    else
        echo "Database file not found: $DB_FILE"
    fi
else
    echo "Reset cancelled."
    rm -r "$BACKUP_DIR"
fi
