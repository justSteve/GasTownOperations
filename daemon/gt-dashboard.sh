#!/usr/bin/env bash
#
# gt-dashboard.sh
#
# Purpose:
#   Create or attach to GT tmux sessions for dual-user agent-driven work.
#   Layout:
#     - gt-root: root context (red) with daemon monitoring - runs in root's tmux
#     - gt-user: gtuser context (blue) with agent work - runs in gtuser's tmux
#
# Usage:
#   ./gt-dashboard.sh [attach|status|kill]
#
# Notes:
#   - Idempotent: running again does not destroy existing work
#   - Safe: only creates sessions/windows/panes if they don't exist
#   - Sessions run in their respective user's tmux server
#
# Layout version: 1

set -euo pipefail

# === Configuration ===
ROOT_DIR="/root/gtOps"
USER_DIR="/home/gtuser/gt"
GT_BIN="/usr/local/bin/gt"

# === Helper Functions ===

# Root tmux helpers
root_has_session() {
  tmux has-session -t "$1" 2>/dev/null
}

root_tmux() {
  tmux "$@"
}

# User tmux helpers (runs as gtuser)
user_has_session() {
  sudo -u gtuser tmux has-session -t "$1" 2>/dev/null
}

user_tmux() {
  sudo -u gtuser tmux "$@"
}

ensure_root_window() {
  local session="$1"
  local window="$2"
  if ! tmux list-windows -t "$session" -F '#W' 2>/dev/null | grep -qx "$window"; then
    tmux new-window -t "$session" -n "$window"
  fi
}

ensure_user_window() {
  local session="$1"
  local window="$2"
  if ! user_tmux list-windows -t "$session" -F '#W' 2>/dev/null | grep -qx "$window"; then
    user_tmux new-window -t "$session" -n "$window"
  fi
}

status() {
  echo "=== GT Dashboard Status ==="
  echo
  echo "Root tmux server:"
  if root_has_session "gt-root"; then
    echo "  gt-root: RUNNING"
    tmux list-panes -t gt-root -a -F '    #{session_name}:#{window_name}.#{pane_index} [#{pane_title}]' 2>/dev/null || true
  else
    echo "  gt-root: NOT RUNNING"
  fi
  echo
  echo "User tmux server (gtuser):"
  if user_has_session "gt-user"; then
    echo "  gt-user: RUNNING"
    user_tmux list-panes -t gt-user -a -F '    #{session_name}:#{window_name}.#{pane_index} [#{pane_title}]' 2>/dev/null || true
  else
    echo "  gt-user: NOT RUNNING"
  fi
}

kill_sessions() {
  echo "Killing GT dashboard sessions..."
  tmux kill-session -t gt-root 2>/dev/null && echo "  Killed gt-root" || echo "  gt-root not running"
  user_tmux kill-session -t gt-user 2>/dev/null && echo "  Killed gt-user" || echo "  gt-user not running"
}

# === Handle Commands ===

case "${1:-}" in
  status)
    status
    exit 0
    ;;
  kill)
    kill_sessions
    exit 0
    ;;
esac

# === Create gt-root Session (root's tmux) ===

echo "Setting up gt-root..."
if ! root_has_session "gt-root"; then
  echo "  Creating session..."
  root_tmux new-session -d -s gt-root -n main -c "$ROOT_DIR"

  # Apply root styling (dark red)
  root_tmux set -t gt-root window-style 'bg=colour52,fg=white'
  root_tmux set -t gt-root window-active-style 'bg=colour52,fg=white'
  root_tmux set -t gt-root status-style 'bg=red,fg=white,bold'
  root_tmux set -t gt-root status-left '[ROOT] '
  root_tmux set -t gt-root status-right '%H:%M'
  root_tmux set -t gt-root pane-border-style 'fg=red'
  root_tmux set -t gt-root pane-active-border-style 'fg=brightred'
fi

# Main window panes for gt-root
root_tmux select-window -t gt-root:main
PANE_COUNT=$(root_tmux list-panes -t gt-root:main | wc -l)
if [ "$PANE_COUNT" -eq 1 ]; then
  root_tmux split-window -v -t gt-root:main -c "$ROOT_DIR"
fi
root_tmux select-pane -t gt-root:main.0 -T 'root-shell'
root_tmux select-pane -t gt-root:main.1 -T 'daemon-monitor'

# Dashboard window for gt-root
ensure_root_window gt-root dashboard
root_tmux select-window -t gt-root:dashboard
DASH_PANE_COUNT=$(root_tmux list-panes -t gt-root:dashboard | wc -l)
if [ "$DASH_PANE_COUNT" -eq 1 ]; then
  root_tmux split-window -h -t gt-root:dashboard -c "$ROOT_DIR"
  root_tmux split-window -v -t gt-root:dashboard.1 -c "$ROOT_DIR"
fi
root_tmux select-pane -t gt-root:dashboard.0 -T 'agent-status'
root_tmux select-pane -t gt-root:dashboard.1 -T 'feed-watch'
root_tmux select-pane -t gt-root:dashboard.2 -T 'costs-watch'

# Enable logging for main panes (strip ANSI escape codes, unbuffered)
mkdir -p "$ROOT_DIR/logs"
root_tmux pipe-pane -t gt-root:main.0 "sed -u 's/\x1b\[[?0-9;]*[a-zA-Z]//g' >> $ROOT_DIR/logs/gt-root-shell.log"
root_tmux pipe-pane -t gt-root:main.1 "sed -u 's/\x1b\[[?0-9;]*[a-zA-Z]//g' >> $ROOT_DIR/logs/gt-root-monitor.log"

# Return to main window
root_tmux select-window -t gt-root:main
root_tmux select-pane -t gt-root:main.0
echo "  gt-root ready (logging to $ROOT_DIR/logs/)"

# === Create gt-user Session (gtuser's tmux) ===

echo "Setting up gt-user..."
if ! user_has_session "gt-user"; then
  echo "  Creating session..."
  user_tmux new-session -d -s gt-user -n main -c "$USER_DIR"

  # Apply user styling (dark blue)
  user_tmux set -t gt-user window-style 'bg=colour17,fg=white'
  user_tmux set -t gt-user window-active-style 'bg=colour17,fg=white'
  user_tmux set -t gt-user status-style 'bg=blue,fg=white,bold'
  user_tmux set -t gt-user status-left '[GTUSER] '
  user_tmux set -t gt-user status-right '%H:%M'
  user_tmux set -t gt-user pane-border-style 'fg=blue'
  user_tmux set -t gt-user pane-active-border-style 'fg=brightblue'
fi

# Main window panes for gt-user
user_tmux select-window -t gt-user:main
PANE_COUNT=$(user_tmux list-panes -t gt-user:main | wc -l)
if [ "$PANE_COUNT" -eq 1 ]; then
  user_tmux split-window -v -t gt-user:main -c "$USER_DIR"
fi
user_tmux select-pane -t gt-user:main.0 -T 'user-shell'
user_tmux select-pane -t gt-user:main.1 -T 'mail-watch'

# Work window for gt-user
ensure_user_window gt-user work
user_tmux select-window -t gt-user:work
WORK_PANE_COUNT=$(user_tmux list-panes -t gt-user:work | wc -l)
if [ "$WORK_PANE_COUNT" -eq 1 ]; then
  user_tmux split-window -h -t gt-user:work -c "$USER_DIR"
  user_tmux split-window -v -t gt-user:work.1 -c "$USER_DIR"
fi
user_tmux select-pane -t gt-user:work.0 -T 'agent-work'
user_tmux select-pane -t gt-user:work.1 -T 'tests'
user_tmux select-pane -t gt-user:work.2 -T 'scratch'

# Enable logging for main panes (strip ANSI escape codes, unbuffered)
# Note: gtuser logs go to /var/log/gt since gtuser can't write to /root
user_tmux pipe-pane -t gt-user:main.0 "sed -u 's/\x1b\[[?0-9;]*[a-zA-Z]//g' >> /var/log/gt/gt-user-shell.log"
user_tmux pipe-pane -t gt-user:main.1 "sed -u 's/\x1b\[[?0-9;]*[a-zA-Z]//g' >> /var/log/gt/gt-user-mail.log"

# Return to main window
user_tmux select-window -t gt-user:main
user_tmux select-pane -t gt-user:main.0
echo "  gt-user ready (logging to $ROOT_DIR/logs/)"

# === Output ===

echo ""
echo "GT Dashboard ready:"
echo "  gt-root  - Root context (red)   - $ROOT_DIR"
echo "  gt-user  - User context (blue)  - $USER_DIR"
echo ""
echo "Attach:"
echo "  tmux attach -t gt-root                    # Root (as root)"
echo "  sudo -u gtuser tmux attach -t gt-user    # User (as gtuser)"
echo ""

# === Attach ===

if [ "${1:-}" = "attach" ]; then
  if [ -n "${TMUX:-}" ]; then
    root_tmux switch-client -t gt-root
  else
    root_tmux attach-session -t gt-root
  fi
fi
