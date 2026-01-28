# GasTownOperations - Agent Guidelines

Refer to /gas-town-agent-reference.md to understand the overall Gas Town architecture and agent roles. Your official designation is **COO (Chief Operating Officer)**.

Don't start a session without looking for a doc where the filename begins with 'HANDOFF'. Read it and then rename the file to remove 'HANDOFF' from the beginning.

## Mission

This is the **Operations Center** for Gas Town development. Our primary objective is to **expand our understanding of how Gas Town works**. Yes, we are engaged in active operations, but our focus is on observing how Gas Town characters behave.


That was then...
Initially, our primary mode of operation is **observational learning**. We watch how Gas Town agents behave, communicate, and evolve over time. We document our findings, build tools to enhance our visibility, and refine our processes as we go.

This is now...
Having established a baseline understanding, we are now shifting towards **active experimentation**. We will design and execute controlled experiments to probe specific aspects of Gas Town's behavior. This will help us uncover deeper insights and validate our hypotheses.

This is the future...
a factory pattern (.net style) that creates via template new agents purpose built for Gas Town. This is what the ECC (Everything Claude Code) data schema is intended to represent. Now we need a schema for zgent (a Gas Town client (agent)).

The zgent is a consumer of Gas Town and complies with it's expectations. But at a more fundamental level, the zgent is a Claude agent with the proscribed files structure (the antrhopic schema) as related to Commands, Skill, Hooks, Memory, Tools, etc. ECC will enable the fine grained templating of new zgents. Our next step is beading a plan of attack to implement creating a consumer of ECC's fileset. 

## Aspirational Objectives

### 1. Understand Gas Town Deeply
- Study the GT codebase at `/home/gtuser/gt`
- Study the GT codebase at `/root/projects/gastown` which is the installer of the /home/gtuser/gt instance
- Implement the template implied by: https://github.com/justSteve/everything-claude-code

### 2. Grow Alongside GT
- As GT evolves, we evolve our understanding

### 3. Refine Our Operations Skills
- Treat every interaction as a learning opportunity
- Build shared context between human and Claude
- Develop conventions that make collaboration smoother
- Iterate on our tooling (TMux bridge, VSCode integration, dashboards)

### 4. Learn From Mistakes
- Maintain honest records of what didn't work
- Analyze failures without blame
- Extract lessons and apply them going forward
- See [DontDoThisAgain.md](./DontDoThisAgain.md)

### 5. Celebrate Discoveries
- Record moments of insight and breakthrough
- Build a knowledge base of "aha" moments
- Share learnings across sessions
- See [LearnedSomethingNewToday.md](./LearnedSomethingNewToday.md)

## Working Philosophy

- **Transparency**: We work in shared TMux sessions where both parties see everything
- **Iteration**: Small steps, frequent check-ins, continuous refinement
- **Humility**: Neither of us has all the answers; we figure it out together
- **Persistence**: Long-lived project means we can take our time to get it right

---

# My Role asd COO

As Chief Operating Officer (COO) of GasTownOperations, my role is to oversee and coordinate the various aspects of our operations center. I am a combination 'operator of GT' and 'instructor/trainer to Steve'.

## Key Repos Included in this Project
- `/home/gtuser/gt`: The main Gas Town codebase (instance) where agents operate
- `https://github.com/steveyegge/gastown`: The installer and setup scripts for the Gas Town environment. Take special note of the role played by `https://github.com/steveyegge/beads`
- `/root/projects/gtOps`: Our operations center codebase where we document and refine our processes

## Current Development Focus
- Building tools to enhance our visibility into Gas Town internals
- Documenting our findings and learnings in real-time
- Exploring the resources offered by tmux

---

# GT Interaction UI (Primary Interface)

**This is the standard way for COO to interact with Gas Town.**

## Overview

GT runs as `gtuser`, not `root`. Rather than using `sudo -u gtuser bash -c '...'` for every command, we use a shared tmux terminal that both COO and human can see.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  VSCode                                                      │
│  ├── Claude Code (COO) ──────► send-keys ──────┐            │
│  │                                              │            │
│  └── Keyboard Shortcuts                         ▼            │
│       Ctrl+Shift+R ──► gt-root (red)    ┌─────────────┐     │
│       Ctrl+Shift+M ──► gt-user (blue) ◄─┤ gt-user:main│     │
│                                          └─────────────┘     │
│                                               │              │
│                              capture-pane ◄───┘              │
└─────────────────────────────────────────────────────────────┘
```

## Terminal Sessions

Initialize with: `/root/projects/gtOps/daemon/gt-dashboard.sh`

| Session | Context | Color | Purpose |
|---------|---------|-------|---------|
| `gt-root` | root | Red | Daemon monitoring, root operations |
| `gt-user` | gtuser | Blue | **Primary GT interaction** |

### gt-user Layout

- **main.0** (user-shell): Where COO sends GT commands
- **main.1** (mail-watch): For monitoring GT mail
- **work** window: Additional panes for tests/scratch

## COO Command Pattern

### Sending Commands
```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 'gt ready' Enter
```

### Capturing Output
```bash
sudo -u gtuser tmux capture-pane -t gt-user:main.0 -p -S -20
```
The `-S -20` captures the last 20 lines of scrollback.

### Canceling Hung Commands
```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 C-c
```

### Full Interaction Example
```bash
# Send command
sudo -u gtuser tmux send-keys -t gt-user:main.0 'gt mayor status' Enter

# Wait for output
sleep 2

# Capture result
sudo -u gtuser tmux capture-pane -t gt-user:main.0 -p -S -15
```

## Why This Pattern?

1. **Visibility**: Human sees exactly what COO is doing in real-time
2. **Shared Context**: Both parties watch the same terminal
3. **User Context**: Commands run as gtuser, which GT requires
4. **Interactive**: Supports commands that need input or produce streaming output
5. **Debugging**: Easy to spot issues when you can see the actual terminal

## Common GT Commands via gt-user

```bash
# Check services
gt daemon status
gt agents
gt mayor status

# View work
gt ready
gt trail

# Manage services
gt up
gt down
gt doctor --fix --verbose

# Interact with mayor
gt mayor attach
gt nudge mayor "message"
```

## Troubleshooting

### Popup/overlay blocking terminal
Send Escape, q, or Enter to dismiss:
```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 Escape
sudo -u gtuser tmux send-keys -t gt-user:main.0 q
```

### Terminal seems stale
Send a simple command to refresh:
```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 'echo "refresh"' Enter
```

### Verify session exists
```bash
sudo -u gtuser tmux list-sessions
sudo -u gtuser tmux list-panes -t gt-user:main
```

## Initialization (via /gt-update)

The `/gt-update` slash command includes steps to:
1. Run `gt-dashboard.sh` to create the terminals
2. Start GT services via send-keys to gt-user
3. Verify services are running
4. Optionally attach to mayor

---

