# Rule: GT tmux Interaction

GT runs as `gtuser`, not `root`. Always use send-keys/capture-pane for GT interaction.

## Required Pattern

```bash
# Send command
sudo -u gtuser tmux send-keys -t gt-user:main.0 '<command>' Enter

# Wait for output
sleep 2

# Capture output (last 20 lines of scrollback)
sudo -u gtuser tmux capture-pane -t gt-user:main.0 -p -S -20
```

## Never

- Run GT commands directly as root (appears to work but doesn't)
- Use `sudo -u gtuser bash -c '...'` for interactive commands (use send-keys)
- Forget the `Enter` at the end of send-keys

## Cancel Hung Commands

```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 C-c
```

## Clear Orphaned Input

When mystery text appears in prompt (from crashed sessions):

```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 Escape C-u
```

## Dismiss Popups/Overlays

```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 Escape
sudo -u gtuser tmux send-keys -t gt-user:main.0 q
```

## Verify Session Exists

```bash
sudo -u gtuser tmux list-sessions
sudo -u gtuser tmux list-panes -t gt-user:main
```
