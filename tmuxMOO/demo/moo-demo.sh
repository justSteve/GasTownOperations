#!/bin/bash
# moo-demo.sh - Launch the tmuxMOO demonstration
# ------------------------------------------------
# Creates a 4-pane layout simulating agents and human interaction

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_NAME="moo-demo"
TMUX_CONF="$SCRIPT_DIR/.tmux.conf"

# Kill existing session if present
tmux kill-session -t "$SESSION_NAME" 2>/dev/null

# Create new session with custom config
tmux -f "$TMUX_CONF" new-session -d -s "$SESSION_NAME" -x 120 -y 30

# Rename the first window
tmux rename-window -t "$SESSION_NAME:1" "workshop"

# Create the layout:
# +------------------+------------------+
# |     Deacon       |   Butterfly      |
# |   (narrator)     |   (scanner)      |
# +------------------+------------------+
# |     Narrative    |    Human Cmd     |
# |   (shared log)   |    (input)       |
# +------------------+------------------+

# Split into 4 panes
tmux split-window -h -t "$SESSION_NAME:1"
tmux split-window -v -t "$SESSION_NAME:1.1"
tmux split-window -v -t "$SESSION_NAME:1.2"

# Set pane titles (requires tmux 3.0+)
tmux select-pane -t "$SESSION_NAME:1.1" -T "Deacon"
tmux select-pane -t "$SESSION_NAME:1.2" -T "Narrative"
tmux select-pane -t "$SESSION_NAME:1.3" -T "Butterfly"
tmux select-pane -t "$SESSION_NAME:1.4" -T "Command"

# Start narrators in the agent panes
tmux send-keys -t "$SESSION_NAME:1.1" "clear && $SCRIPT_DIR/narrator.sh deacon" Enter
tmux send-keys -t "$SESSION_NAME:1.3" "clear && $SCRIPT_DIR/narrator.sh butterfly" Enter

# Start shared narrative log
tmux send-keys -t "$SESSION_NAME:1.2" "clear && echo '=== Shared Narrative ===' && tail -f /tmp/moo-narrative.log 2>/dev/null || echo 'Waiting for narrative...'" Enter

# Set up command pane with welcome message
tmux send-keys -t "$SESSION_NAME:1.4" "clear" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo ''" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo '  tmuxMOO Command Interface'" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo '  -------------------------'" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo '  /ask <agent> <question>   - Query an agent'" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo '  /scan <type> <params>     - Run a scan'" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo '  /status                   - Show agent status'" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo '  /help                     - Show commands'" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo ''" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo '  Navigation: Alt+Arrow to move between panes'" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo '  Detach: Ctrl+Space d'" Enter
tmux send-keys -t "$SESSION_NAME:1.4" "echo ''" Enter

# Select the command pane as starting point
tmux select-pane -t "$SESSION_NAME:1.4"

# Attach to the session
echo "Starting tmuxMOO demo..."
echo "Attaching to session: $SESSION_NAME"
tmux attach-session -t "$SESSION_NAME"
