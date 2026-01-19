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

*Add new entries above this line*
