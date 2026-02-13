#!/bin/bash
# Gas Town Presentations - Start the Claude API Proxy
# Loads API key from .env file or environment variable

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# Load .env if it exists
if [[ -f "$ENV_FILE" ]]; then
    echo "[proxy] Loading API key from $ENV_FILE"
    set -a
    source "$ENV_FILE"
    set +a
fi

# Check if key is available
if [[ -z "$ANTHROPIC_API_KEY" ]]; then
    echo ""
    echo "ERROR: ANTHROPIC_API_KEY not found"
    echo ""
    echo "Options:"
    echo "  1. Create .env file:"
    echo "     cp $SCRIPT_DIR/.env.example $ENV_FILE"
    echo "     # Edit $ENV_FILE with your key"
    echo ""
    echo "  2. Or set environment variable:"
    echo "     export ANTHROPIC_API_KEY=sk-ant-api03-..."
    echo ""
    echo "Get your API key from: https://console.anthropic.com/"
    exit 1
fi

echo "[proxy] Starting presentation widget proxy..."
exec node "$SCRIPT_DIR/proxy.mjs"
