# Skill: GT Architecture

Overview of Gas Town's multi-agent system architecture.

## Two-Tier Structure

```
┌─────────────────────────────────────┐
│           TOWN LEVEL                │
│  (Orchestration & Management)       │
├─────────────────────────────────────┤
│  Overseer (Human)                   │
│      ↓                              │
│  Mayor (Coordinator)                │
│      ↓                              │
│  Deacon (Watchdog)                  │
│      ↓                              │
│  Dogs ←── Boot (Meta-watchdog)      │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│           RIG LEVEL                 │
│      (Per-Project Workers)          │
├─────────────────────────────────────┤
│  Witness (Supervisor)               │
│      ↓                              │
│  Polecats (Ephemeral workers)       │
│      ↓                              │
│  Refinery (Merge manager)           │
│                                     │
│  Crew (Persistent collaborators)    │
└─────────────────────────────────────┘
```

## Key Roles

| Role | Scope | Function |
|------|-------|----------|
| **Mayor** | Town | Concierge, convoy initiation, primary interaction point |
| **Deacon** | Town | Daemon beacon, health monitoring, patrol cycles |
| **Dogs** | Town | Deacon's helpers for maintenance tasks |
| **Boot** | Town | Watches the watchdog (Deacon health) |
| **Witness** | Rig | Per-rig supervisor, unsticks workers |
| **Polecats** | Rig | Ephemeral workers, swarm execution |
| **Refinery** | Rig | Merge queue management |
| **Crew** | Rig | Persistent collaborators (human-directed) |

## Core Concepts

### GUPP (Gas Town Universal Propulsion Principle)
> "If there is work on your Hook, YOU MUST RUN IT."

Every worker has a **Hook** (pinned Bead). GUPP ensures work continues even when sessions end.

### Beads
- Atomic unit of work tracking
- Stored in JSONL (one issue per line)
- Tracked in Git alongside project
- Have: ID, description, status, assignee

### Molecules
- Durable chained Bead workflows
- Survive agent crashes, compactions, restarts
- New session finds place and continues

### Wisps
- Ephemeral Beads (destroyed after run)
- Used for high-velocity orchestration
- Memory only, not persisted

### Convoys
- Work-order wrapping system
- Groups related work for tracked delivery
- Multiple swarms can "attack" a convoy

## Rig Configuration

Each rig has its own:
- Beads database (`.beads/`)
- Witness (supervisor)
- Polecats (workers)
- Refinery (merge manager)
- Optional: Crew members

## Current gtOps Rigs

| Rig | Purpose |
|-----|---------|
| DReader | Document reader application |
| DataArchive | Data archiving application |
| claude_monitor | Claude context file monitoring |
| ParseClipmate | Windows clipboard parser |
