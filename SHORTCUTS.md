# GT Shortcuts Reference

## VSCode Keybindings

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+G, R` | Open gt-root terminal (red, root context) |
| `Ctrl+Shift+G, U` | Open gt-user terminal (blue, gtuser context) |
| `Ctrl+Shift+G, M` | Move current terminal to new window |

**Workflow:** Open terminal → Move to window → Repeat for second terminal

## Terminal Profiles

| Profile | Context | Attaches To |
|---------|---------|-------------|
| gt-root | root | tmux session `gt-root` |
| gt-user | gtuser | tmux session `gt-user` |

## Dashboard Commands

```bash
# Initialize both tmux sessions
/root/projects/gtOps/daemon/gt-dashboard.sh

# Check status
/root/projects/gtOps/daemon/gt-dashboard.sh status

# Kill sessions
/root/projects/gtOps/daemon/gt-dashboard.sh kill

# Attach directly (from terminal)
tmux attach -t gt-root
sudo -u gtuser tmux attach -t gt-user
```

## Tmux Layout

**gt-root** (red theme):
- `main`: root-shell | daemon-monitor (horizontal split)
- `dashboard`: agent-status | feed-watch | costs-watch

**gt-user** (blue theme):
- `main`: user-shell | mail-watch (horizontal split)
- `work`: agent-work | tests | scratch

## Tmux Scrollback

| Method | Keys |
|--------|------|
| Mouse wheel | Just scroll (mouse enabled) |
| Enter copy mode | `Ctrl+B [` |
| Scroll in copy mode | `↑/↓` or `PgUp/PgDn` |
| Search in copy mode | `/` then type search term |
| Exit copy mode | `q` |

## Logging

Automatic logging for main panes (ANSI codes stripped):

| Log File | Content |
|----------|---------|
| `logs/gt-root-shell.log` | Root shell activity |
| `logs/gt-root-monitor.log` | Root monitor pane |
| `logs/gt-user-shell.log` | User shell (symlink to /var/log/gt/) |
| `logs/gt-user-mail.log` | User mail pane (symlink to /var/log/gt/) |

Watch live: `tail -f /root/projects/gtOps/logs/gt-root-shell.log`

## Files

- Keybindings: `%APPDATA%/Code/User/keybindings.json`
- User settings: `%APPDATA%/Code/User/settings.json`
- Dashboard script: `/root/projects/gtOps/daemon/gt-dashboard.sh`
- Workspace settings: `/root/projects/gtOps/.vscode/settings.json`
- Log rotation: `/root/projects/gtOps/daemon/gt-log-rotate.sh`
