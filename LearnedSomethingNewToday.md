# Learned Something New Today

A running log of discoveries, insights, and "aha" moments. Building our shared knowledge base.

---

## Format

Each entry should include:
- **Date**: When discovered
- **Discovery**: What we learned
- **Context**: How we discovered it
- **Application**: How this helps us going forward

---

## Entries

### 2026-01-18: TMux as shared execution space
**Discovery**: TMux sessions provide bidirectional visibility - Claude can send commands via `send-keys` and read output via `capture-pane`. User sees everything in real-time and can intervene.

**Context**: Built TMux controller and VSCode bridge to enable shared terminal sessions.

**Application**: Foundation for transparent collaboration. No hidden commands. Both parties work in the same context.

---

### 2026-01-18: VSCode command bridge via file-based IPC
**Discovery**: VSCode extensions can watch files for commands, enabling external processes to trigger IDE actions. Write to `/tmp/vscode-bridge-commands`, extension picks it up and executes.

**Context**: Needed to control VSCode UI (open terminals, toggle panels) from scripts.

**Application**: Claude can now open TMux sessions in VSCode, toggle panels, focus elements - all programmatically.

---

### 2026-01-18: GT data sources for monitoring
**Discovery**: Gas Town exposes rich data via:
- `.beads/issues.jsonl` - agent population, work items
- `gt feed --follow` - real-time event stream
- `gt status` - agent states
- `gt costs` - token tracking
- `daemon/state.json` - daemon health

**Context**: Explored GT codebase to understand what's available for dashboard.

**Application**: Can build comprehensive monitoring dashboards with live data.

---

### 2026-01-19: Gas Town daily update workflow
**Discovery**: Established a repeatable workflow for syncing the GT fork with upstream:
1. Fetch upstream and compare commits
2. Fast-forward merge and push to fork
3. Build from source and install to `/usr/local/bin/gt`
4. Run `gt doctor` to verify installation
5. Review CHANGELOG.md for release notes

**Context**: GT is iterating rapidly (80 commits in 4 days, 0.2.6 → 0.4.0). Need daily sync to stay current.

**Application**: Created `/gt-update` slash command and `scripts/gt-sync.sh` for daily updates. Key paths:
- Source: `/root/projects/gastown` (with upstream and origin remotes)
- Binary: `/usr/local/bin/gt` (accessible to gtuser)
- Managed instance: `/home/gtuser/gt`

---

### 2026-01-19: Dual-user tmux requires separate servers
**Discovery**: When root creates a tmux session and gtuser creates a session, they exist in separate tmux servers. You cannot switch between them with `switch-client` - they're isolated by user.

**Context**: Building gt-dashboard.sh with `gt-root` (red) and `gt-user` (blue) sessions.

**Application**:
- Use `sudo -u gtuser tmux` for all gtuser session operations
- Attach commands differ: `tmux attach -t gt-root` vs `sudo -u gtuser tmux attach -t gt-user`
- Script must track which server each command targets

---

### 2026-01-20: GT Mail vs Hooks - Separate Concepts

**Discovery**: Mail and Hooks are distinct systems in Gas Town:
- **Mail** (`gt mail inbox`): Messages waiting to be read - passive communication
- **Hooks** (`gt hook`): Active work assignments that trigger agent behavior

A message in an agent's inbox does NOT automatically appear on their hook. Agents must process mail and decide what to hook as work.

**Context**: Sent a tracer message to crew/steve and observed it appeared in his inbox but not on his hook.

**Application**: When designing agent workflows:
- Use mail for communication/notifications
- Use hooks for actionable work items
- Agent startup involves: check hook → process hooked work → then check mail

---

### 2026-01-20: GT Message ID Prefixes

**Discovery**: Message IDs use the town-level prefix (`hq-`) regardless of recipient:
- `hq-3g9` - message to `DReader/crew/steve`
- Session names use rig prefixes: `dr-DReader-crew-steve`

The prefix comes from the beads database location (town level), not the recipient address.

**Context**: Tracer experiment - sent message to rig-level agent, observed storage.

**Application**: When querying beads, messages are all in the HQ namespace. Filter by `assignee` field to find rig-specific messages.

---

### 2026-01-20: GT Address Resolution

**Discovery**: Addresses simplify in storage:
- Sent to: `DReader/crew/steve`
- Stored as assignee: `DReader/steve`
- Query with: `--identity DReader/crew/steve`

The `/crew/` segment is part of the addressing but not always in the stored assignee.

**Context**: Tracer experiment - comparing send address to stored structure.

**Application**: Be flexible when querying - the exact form may vary between commands.

---

### 2026-01-21: GT Expected Workflow vs Reality (Discord insight)

**Discovery**: Community mental model of GT workflow doesn't match current implementation:

**Expected Flow:**
1. Create spec/plan with crew member
2. Crew creates beads (epics + tasks) from plan
3. Sling epic to rig's polecats
4. Mayor creates **convoy** of **waves** with **gates** watching merge queue
5. Refinery merge → message to gate → gate closes → next wave releases

**Actual Problem:**
- Wave 2 kicks off before Wave 1 merges
- Polecats sync from main (missing dependent work from Wave 1)
- No gate mechanism watching the merge queue
- Everything "falls off the rails"

**Context**: Discord post from GT user trying to scale work across polecats with dependencies.

**Application**:
- GT convoy/wave/gate orchestration is not yet implemented (or not working as expected)
- Current workaround: manual sequencing, one wave at a time
- This is a key feature gap to watch for in GT releases
- Bead `gt-zlr` created to design experiment replicating this workflow

---

### 2026-01-23: Orphaned Agent Input in TMux Buffers

**Discovery**: When GT agent sessions timeout, crash, or get interrupted mid-response, Claude Code may leave partial typed input in the tmux input buffer. This appears as mystery text in the prompt area with `↵ send` indicator.

**Context**: Observed unexplained messages in `hq-mayor` ("tell me what mayor does") and `gt-claude_monitor-refinery` ("check the other rigs") that neither user nor COO sent. Investigation revealed these were orphaned inputs from agents that started typing but didn't complete.

**Application**:
- When investigating mystery input, check if sessions recently crashed/restarted
- Use `Escape` then `C-u` to clear orphaned input (Ctrl+C alone may not work)
- Agents that show "Sautéed/Baked/Crunched for Xm" followed by idle prompt may have orphaned input
- This is a GT/Claude Code quirk, not a security concern

---

*Add new entries above this line*
