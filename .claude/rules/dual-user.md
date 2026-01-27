# Rule: Dual-User Context

## User Contexts

| User | Context | Purpose |
|------|---------|---------|
| `root` | gtOps operations | Daemon control, file management, syncing |
| `gtuser` | GT instance operations | Agent work, GT commands |

## Tmux Servers

Root and gtuser have **separate** tmux servers. You cannot `switch-client` between them.

| Session | User | Color | Attach Command |
|---------|------|-------|----------------|
| `gt-root` | root | Red | `tmux attach -t gt-root` |
| `gt-user` | gtuser | Blue | `sudo -u gtuser tmux attach -t gt-user` |

## File Permissions

Files in `/root/` are **not accessible** to GT agents.

To share files with agents:

```bash
cp /root/projects/gtOps/somefile.md /home/gtuser/gt/<rig>/
chown gtuser:gtuser /home/gtuser/gt/<rig>/somefile.md
```

## Key Paths

| Path | Owner | Purpose |
|------|-------|---------|
| `/root/projects/gtOps` | root | Operations center |
| `/root/projects/gastown` | root | GT installer/source (upstream sync) |
| `/home/gtuser/gt` | gtuser | Running GT instance |
| `/usr/local/bin/gt` | root | GT binary (accessible to all) |
