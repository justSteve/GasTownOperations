# Skill: GT Command Reference

Quick reference for Gas Town CLI commands. Run all GT commands as `gtuser`.

## Town Management

| Command | Purpose |
|---------|---------|
| `gt up` | Start all services |
| `gt down` | Graceful shutdown |
| `gt status` | Overview of town state |
| `gt version` | Show GT version |
| `gt doctor` | Health check |
| `gt doctor --fix` | Health check with auto-repair |
| `gt doctor --fix --verbose` | Detailed health check |

## Work Management

| Command | Purpose |
|---------|---------|
| `gt ready` | Show work ready to be done |
| `gt trail` | Show work trail/history |
| `gt hook` | What's on your hook |
| `gt sling <bead> <agent>` | Assign work to agent's hook |
| `gt convoy create <name>` | Create work convoy |
| `gt convoy list` | List convoys |

## Agent Interaction

| Command | Purpose |
|---------|---------|
| `gt agents` | List active agents |
| `gt mayor attach` | Attach to mayor session |
| `gt mayor status` | Mayor status |
| `gt nudge <agent> "msg"` | Send real-time message to agent |
| `gt peek <agent>` | Check agent status |
| `gt polecat list` | List polecats |
| `gt crew list` | List crew members |

## Mail System

| Command | Purpose |
|---------|---------|
| `gt mail inbox` | View your inbox |
| `gt mail send <to> "subject" "body"` | Send mail |
| `gt mail read <id>` | Read specific message |

## Session Management

| Command | Purpose |
|---------|---------|
| `gt handoff` | Graceful session restart |
| `gt seance` | Talk to previous sessions |
| `gt prime` | Context recovery in existing session |

## Diagnostics

| Command | Purpose |
|---------|---------|
| `gt feed` | Activity stream (one-shot) |
| `gt feed --follow` | Live activity stream |
| `gt costs` | Token usage tracking |
| `gt daemon status` | Daemon health |

## Beads Commands

| Command | Purpose |
|---------|---------|
| `bd list` | List beads |
| `bd show <id>` | Show bead details |
| `bd create` | Create new bead |
| `bd close <id>` | Close bead |

## COO Pattern (via tmux)

```bash
# Send command
sudo -u gtuser tmux send-keys -t gt-user:main.0 'gt <command>' Enter

# Capture output
sleep 2
sudo -u gtuser tmux capture-pane -t gt-user:main.0 -p -S -20
```
