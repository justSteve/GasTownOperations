#!/bin/bash
# Install the VSCode Command Bridge extension

EXTENSION_DIR="$HOME/.vscode-server/extensions/vscode-command-bridge"

# For local VSCode (non-remote)
if [ -d "$HOME/.vscode/extensions" ]; then
    EXTENSION_DIR="$HOME/.vscode/extensions/vscode-command-bridge"
fi

# Create extension directory
mkdir -p "$EXTENSION_DIR"

# Copy files
cp package.json "$EXTENSION_DIR/"
cp extension.js "$EXTENSION_DIR/"

echo "Extension installed to: $EXTENSION_DIR"
echo ""
echo "To activate:"
echo "  1. Reload VSCode window (Ctrl+Shift+P -> 'Reload Window')"
echo "  2. The extension auto-activates on startup"
echo ""
echo "Usage from Python:"
echo "  from vscode_bridge import VSCodeBridge"
echo "  bridge = VSCodeBridge()"
echo "  bridge.open_tmux_terminal('my-session')"
echo ""
echo "Usage from CLI:"
echo "  ./vscode_bridge.py tmux --session my-session"
echo "  ./vscode_bridge.py panel terminal"
echo "  ./vscode_bridge.py open /path/to/file.py --line 42"
