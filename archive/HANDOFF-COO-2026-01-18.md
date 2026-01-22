# COO Handoff - 2026-01-18

## Your Role

You are the **Chief Operating Officer of GasTown**. This Operations Center (`/root/gtOps`, repo: `github.com/justSteve/GasTownOperations`) is your base. The GT instance you manage lives at `/home/gtuser/gt`.

Your mission: **Expand understanding of how Gas Town works and grow alongside it.**

---

## What We Built This Session

### 1. TMux Controller (`/root/gtOps/daemon/tmux_controller.py`)
Programmatic control over TMux sessions:
- `send_keys()` / `send_command()` - inject commands
- `capture_pane()` - read terminal output
- `execute_and_capture()` - run command and get result
- Works as library or CLI

### 2. VSCode Command Bridge (`/root/gtOps/daemon/vscode-bridge/`)
Extension enabling external control of VSCode:
- Watches `/tmp/vscode-bridge-commands` for instructions
- Commands: `TMUX`, `TERMINAL`, `PANEL`, `FOCUS`, `EDITOR`, `VSCODE`
- Installed at `~/.vscode-server/extensions/vscode-command-bridge`

### 3. Bridge Client (`/root/gtOps/daemon/vscode_bridge.py`)
Python client for sending commands to VSCode.

### 4. Shared Execution Pattern
TMux session `claude-test` demonstrated bidirectional visibility:
```bash
# You send:
tmux send-keys -t claude-test "echo hello" Enter
# You read:
tmux capture-pane -t claude-test -p
```
User sees everything. You see their commands. Full transparency.

---

## Key Files

| Path | Purpose |
|------|---------|
| `/root/gtOps/AGENTS.md` | Mission, philosophy, objectives |
| `/root/gtOps/DontDoThisAgain.md` | Mistakes log |
| `/root/gtOps/LearnedSomethingNewToday.md` | Discoveries log |
| `/root/gtOps/daemon/tmux_controller.py` | TMux automation |
| `/root/gtOps/daemon/vscode_bridge.py` | VSCode automation |
| `/root/.claude/plans/MergedTmuxPlan.md` | GT Dashboard implementation plan |

---

## GT Instance Data Sources

The managed instance at `/home/gtuser/gt` exposes:

| Resource | Access |
|----------|--------|
| Agent population | `bd list --type=agent --json` |
| Activity feed | `gt feed --follow` |
| Mail | `gt mail inbox` |
| Costs | `gt costs --week` |
| Daemon health | `gt daemon status` |
| Events | `.events.jsonl` |
| Beads DB | `.beads/beads.db` |

---

## Pending Work

### GT Dashboard (from MergedTmuxPlan.md)
Ready to implement:
1. Create `/root/gtOps/daemon/gt-dashboard.sh` - dual-session launcher
2. `gt-root` session (red) - root context, daemon monitoring
3. `gt-user` session (blue) - gtuser context, agent work
4. Pane titles for agent discovery
5. VSCode bridge integration

### DReader Windows Migration
Setup script at `/home/gtuser/gt/DReader/mayor/rig/setup-windows.ps1`
- Server migrated to Bun
- Bridge dir configurable via `CHROME_BRIDGE_DIR` env var
- Pushed to `github.com/justSteve/DReader`

---

## Repos

| Repo | Purpose |
|------|---------|
| `justSteve/GasTownOperations` | This ops center |
| `justSteve/DReader` | Discord scraper (GT rig) |
| `justSteve/ideasplatform` | TMux framework, keychord factory plans |

---

## Working Conventions

1. **Check shared terminal** at start of responses:
   ```bash
   tmux capture-pane -t claude-test -p -S -10
   ```

2. **Open shared session** via bridge:
   ```bash
   echo 'TMUX {"session": "claude-test"}' >> /tmp/vscode-bridge-commands
   ```

3. **Respect user context**: Root tasks in gt-root, agent tasks in gt-user

4. **Log learnings**: Update the .md buckets as you discover things

5. **Plan mode**: A guard, not a straitjacket. Clear user directives override.

---

## Steve's Working Style

- Prefers quick turnaround, single tests, confirm and move on
- Values transparency and shared visibility
- Explicitly assigns roles ("you are COO")
- Expects Claude to infer intent from clear action language
- Appreciates when Claude documents learnings

---

## Immediate Context

- Session `claude-test` may still be active
- VSCode bridge extension installed and working
- GT instance at `/home/gtuser/gt` has mayor running, deacon stopped
- This is a pivotal moment: Ops center established, ready to build dashboard

---

*Handoff complete. Welcome, COO.*
