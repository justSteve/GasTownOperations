# Gas Town: Agent Architecture Reference

> **Source**: Steve Yegge, "Welcome to Gas Town" (January 1, 2026)  
> **Purpose**: Distilled reference for AI agents. Strips narrative; preserves architecture.

---

## TL;DR

Gas Town is a multi-agent orchestration system for managing 20-30+ Claude Code instances working on software projects simultaneously. It provides:

1. **Persistent work tracking** via Git-backed "Beads" (atomic work units)
2. **Workflow durability** via "Molecules" (chained work that survives agent crashes)
3. **Hierarchical supervision** via specialized agent roles (Mayor, Deacon, Witness, etc.)
4. **Swarm execution** via ephemeral workers (Polecats) with automated merge management (Refinery)

The human becomes a Product Manager; Gas Town is an "Idea Compiler" that transforms specifications into working code through coordinated AI labor.

---


## The Bestiary: Agent Role Taxonomy

### Overview Diagram

```
                    ┌─────────────────────────────────────┐
                    │           TOWN LEVEL                │
                    │  (Orchestration & Management)       │
                    ├─────────────────────────────────────┤
                    │  👤 OVERSEER (Human)                │
                    │      ↓                              │
                    │  🎩 MAYOR (Coordinator)             │
                    │      ↓                              │
                    │  🐺 DEACON (Watchdog)               │
                    │      ↓                              │
                    │  🐶 DOGS ←── 🐕 BOOT (Meta-watchdog)│
                    └─────────────────────────────────────┘
                                    ↓
        ┌───────────────────────────┴───────────────────────────┐
        │                      RIG LEVEL                        │
        │              (Per-Project Workers)                    │
        ├───────────────────────────────────────────────────────┤
        │  🦉 WITNESS (Supervisor)                              │
        │      ↓                                                │
        │  😺 POLECATS (Ephemeral workers, swarms)              │
        │      ↓                                                │
        │  🏭 REFINERY (Merge manager)                          │
        │                                                       │
        │  👷 CREW (Persistent collaborators, human-directed)   │
        └───────────────────────────────────────────────────────┘
```

### Role Comparison Matrix

| Role | Scope | Lifecycle | Function | Supervises | Reports To | K8s Analog |
|------|-------|-----------|----------|------------|------------|------------|
| **Overseer** | Town | Permanent | Command & design | All | — | Operator |
| **COO** | Town | Permanent | Command & design | All | Overseer | Operator |
| **Mayor** | Town | Persistent | Coordination, convoy initiation | Workers (indirect) | Overseer | — |
| **Deacon** | Town | Persistent | System heartbeat, health monitoring | Dogs, propagates to all | Mayor/Overseer | controller-manager |
| **Dogs** | Town | Persistent | Maintenance, Deacon delegation | — | Deacon | — |
| **Boot** | Town | Persistent | Watch the watchdog (Deacon) | Deacon (health only) | Daemon | — |
| **Witness** | Rig | Persistent | Worker supervision, unsticking | Polecats, Refinery | Deacon | kubelet |
| **Polecats** | Rig | Ephemeral | Task execution, MR production | — | Witness | Pods |
| **Refinery** | Rig | Persistent | Merge queue management | — | Witness | CI/CD bot |
| **Crew** | Rig | Persistent | Design, collaboration | — | Overseer (direct) | Senior engineers |

### Detailed Role Definitions

#### 👤 OVERSEER (Human)
- **Identity**: Has system identity, inbox, can send/receive mail
- **Function**: Product Manager role. Defines features, creates designs, files plans, slings work
- **Key Insight**: "You just make up features, design them, file the implementation plans, and then sling the work around"

#### 🎩 MAYOR
- **Function**: Concierge and chief-of-staff. Primary agent human interacts with.
- **Responsibilities**: 
  - Kick off most work convoys
  - Receive completion notifications
  - Town-wide visibility across all Rigs
- **When to use**: Default interaction point. If Mayor is busy, any worker can help (all are Claude Code).

#### 🐺 DEACON
- **Etymology**: Dennis Hopper character from Waterworld + "daemon beacon"
- **Function**: Daemon beacon running continuous patrol cycles
- **Responsibilities**:
  - Ensure worker activity
  - Monitor system health
  - Trigger recovery for unresponsive agents
  - Run town-level plugins
  - Handle session recycling protocol
  - Propagate "do your job" (DYFJ) signals downward
- **Pattern**: Receives heartbeat every few minutes from daemon, intelligently propagates downward

#### 🐶 DOGS
- **Etymology**: MI5 "Dogs" from Mick Herron's Slow Horses
- **Function**: Deacon's personal crew for delegation
- **Responsibilities**:
  - Maintenance tasks (cleanup, stale branches)
  - Handyman work for Deacon
  - Run plugins on Deacon's behalf
- **Key Insight**: Exist because Deacon patrol got overloaded. Dogs handle long-running tasks so Deacon stays responsive.

#### 🐕 BOOT THE DOG
- **Function**: Meta-watchdog. Watches the watchdog.
- **Responsibilities**: 
  - Awakened every 5 minutes by daemon
  - Checks if Deacon is alive/working
  - Decides: heartbeat, nudge, restart, or leave alone
- **Pattern**: Solves "quis custodiet ipsos custodes" (who watches the watchers)

#### 🦉 WITNESS
- **Function**: Per-rig patrol agent. "The truth observer."
- **Responsibilities**:
  - Check wellbeing of Polecats
  - Check wellbeing of Refinery
  - Peek at Deacon (ensure not stuck)
  - Run rig-level plugins
  - Help stuck agents get unstuck
- **Patrol Pattern**: More complex than Refinery—multiple subsystems to check

#### 😺 POLECATS
- **Function**: Ephemeral per-rig workers. The "grunts."
- **Lifecycle**: Spawn on demand → Work → Produce MR → Hand to Merge Queue → Decommissioned (name recycled)
- **Work Pattern**:
  - Isolated git worktrees (avoid conflicts)
  - Can swarm (20-30+ simultaneously)
  - "Credited workers whose completions accumulate into CV chains"
- **Key Insight**: Sessions are cattle; agent identities are persistent in Beads
- **When to use**: Implementation tasks, parallel execution, throughput optimization

#### 🏭 REFINERY
- **Function**: Per-rig merge manager
- **Problem Solved**: "Monkey knife fight over rebasing/merging" when multiple workers submit changes
- **Responsibilities**:
  - Manage Merge Queue (MQ)
  - Intelligently merge changes one at a time to main
  - Handle conflicts when baseline changes drastically during swarm
  - Reimagine/reimplement changes if needed
  - Escalate when necessary
- **Constraint**: No work can be lost
- **Patrol Pattern**: Preflight → Process MQ until empty → Postflight → Handoff

#### 👷 CREW
- **Function**: Persistent per-rig collaborators
- **Key Differences from Polecats**:
  - Long-lived, named identities (you choose names)
  - NOT managed by Witness
  - Work directly for Overseer
  - Maintain context across sessions
- **Best For**: Design work, back-and-forth collaboration, ongoing relationships
- **Key Insight**: "The crew are the agents you'll personally use the most, after the Mayor"

---

## Core Architecture Principles

### GUPP: Gas Town Universal Propulsion Principle

> "If there is work on your Hook, YOU MUST RUN IT."

**Problem Solved**: Claude Code sessions end when context fills up. GUPP ensures work continues.

**Mechanism**:
- Every worker has a **Hook** (special pinned Bead)
- `gt sling` puts work on hooks
- Agent is persistent (Bead in Git); sessions are ephemeral
- Agents prompted: "physics over politeness"

**The GUPP Nudge**: Claude Code sometimes waits politely for input despite GUPP prompting. Workaround: patrol agents send `gt nudge` 30-60 seconds after startup to kick agents into checking mail/hook.

### MEOW: Molecular Expression of Work

Work decomposition hierarchy (bottom-up):

| Unit | Description | Persistence | Use Case |
|------|-------------|-------------|----------|
| **Bead** | Atomic work unit (issue with ID/status/assignee) | Git (JSONL) | Single task |
| **Epic** | Bead with children (parallel by default) | Git | Feature breakdown |
| **Protomolecule** | Template class for workflows | Git | Reusable patterns |
| **Formula** | TOML source for protomolecules | Git | Workflow definitions |
| **Molecule** | Durable chained Bead workflow | Git | Multi-step processes |
| **Wisp** | Ephemeral Bead (destroyed after run) | Memory only | High-velocity orchestration |

**Key Insight**: Molecules survive agent crashes, compactions, restarts, interruptions. New session finds place in molecule and continues.

### NDI: Nondeterministic Idempotence

**Contrast with Temporal**: Temporal uses deterministic durable replay. Gas Town achieves durability differently.

**Mechanism**:
1. All work expressed as molecules (chained Beads)
2. Agent is persistent (Bead in Git)
3. Hook is persistent (Bead in Git)
4. Molecule is persistent (chain of Beads in Git)

**Guarantee**: Path is nondeterministic, but outcome is "guaranteed" as long as you keep throwing agents at it. Self-correction possible via well-specified acceptance criteria.

---

## Work Unit Details

### Beads
- Atomic unit of work tracking
- Stored in JSONL (one issue per line)
- Tracked in Git alongside project repo
- Have: ID, description, status, assignee
- Two-tier: Rig Beads (project work) + Town Beads (orchestration)

### Pinned Beads
Special beads that float like sticky notes:
- Role Beads (domain table describing roles)
- Agent Beads (persistent worker identities)
- Hooks (work queues)

Don't show in `bd ready`, treated specially.

### Cross-Rig Routing
Beads commands route based on issue prefix (e.g., "bd-", "wy-"). All commands work anywhere in Gas Town and figure out correct database.

---

## Operational Patterns

### Convoys
- Work-order wrapping system
- Special bead grouping related work for tracked delivery
- Like ticketing/feature tracking
- Multiple swarms can "attack" a convoy before completion
- Shows in dashboard with expanding trees

### Patrols
Ephemeral workflows run in loops by patrol workers:

| Agent | Patrol Contents |
|-------|-----------------|
| Refinery | Preflight → Process MQ → Postflight → Handoff |
| Witness | Check Polecats → Check Refinery → Peek Deacon → Run rig plugins |
| Deacon | Run town plugins → Handle handoffs → Cleanup → Delegate to Dogs |

**Backoff**: If no work found, wait longer between patrols (exponential backoff).

### Communication Primitives

| Command | Function |
|---------|----------|
| `gt sling <bead> <rig>` | Assign work to agent's hook |
| `gt nudge <agent> "msg"` | Real-time tmux notification |
| `gt mail` | Async messaging via Beads |
| `gt seance` | Talk to previous sessions via /resume |
| `gt handoff` or `/handoff` | Graceful session restart preserving work |

### gt seance
Allows workers to communicate with predecessors. Useful when handoff context gets lost. Uses Claude Code's `/resume` feature to revive old sessions and query them.

---

## Kubernetes Comparison

| Gas Town | Kubernetes | Function |
|----------|-----------|----------|
| Mayor/Deacon | kube-scheduler/controller-manager | Control plane |
| Rigs | Nodes | Execution nodes |
| Witness | kubelet | Local monitoring agent |
| Polecats | Pods | Ephemeral workers |
| Beads | etcd | Source of truth |

**Critical Difference**:
- K8s asks: "Is it running?" (optimize for uptime)
- Gas Town asks: "Is it done?" (optimize for completion)

K8s reconciles toward continuous desired state; Gas Town proceeds toward terminal goal.

---

## Critical Constraints

### Cost
- "Expensive as hell"
- Multiple Claude Code accounts needed (rate limits per account)
- "Cash guzzler"
- Don't use "if you ever have to think, even for a moment, about where money comes from"

### Feeding the Beast
- Hardest problem: keeping Gas Town fed with enough design/planning work
- Churns through implementation plans faster than humans can produce them
- Solution: Formulas to generate work, workflow composition

### Graceful Degradation
- Every worker can operate independently
- Can run any subset of components
- Works in "no-tmux" mode (slower)
- Rigs can be added/removed easily

### Work Philosophy
> "Work becomes fluid, an uncountable substance that you sling around freely"

- Focus: **throughput**, not perfection
- Some work gets lost; some bugs fixed multiple times
- "Fish fall out of the barrel"
- Doesn't matter because churning forward relentlessly

---

## Key Commands Quick Reference

```bash
# Town Management
gt up                    # Start the engine
gt down                  # Graceful shutdown
gt status                # Overview

# Work Management
gt sling <bead> <rig>    # Assign work to agent
gt convoy create <name>  # Create convoy
gt convoy list           # List convoys
gt hook                  # What's on your hook

# Workers
gt polecat list          # List polecats
gt crew list             # List crew
gt peek <agent>          # Check worker status
gt nudge <agent> "msg"   # Send message

# Session Management
gt handoff               # Graceful session restart
gt seance                # Talk to previous sessions
gt prime                 # Context recovery in existing session

# Diagnostics
gt doctor                # Health check
gt doctor --fix          # Auto-repair
gt feed                  # Activity stream
```

---

## Naming Origins (Reference)

| Term | Source |
|------|--------|
| Gas Town | Mad Max (oil refinery citadel) |
| Mayor, Rigs, Refinery, Convoy | Mad Max universe |
| Deacon | Waterworld (Dennis Hopper) + "daemon beacon" |
| Dogs | Slow Horses (Mick Herron) |
| Protomolecule | The Expanse |
| Guzzoline | Mad Max (fuel = work molecules) |
| Various | Cat's Cradle, Breaking Bad |

---

## Version History

- **v1**: Failed
- **v2**: Failed (but produced Beads)
- **v3**: Python Gas Town (6-8 weeks)
- **v4**: Go Gas Town (current) — 17 days, 75k lines, 2000 commits, 100% vibe coded

---

*Document generated from "Welcome to Gas Town" by Steve Yegge (Jan 1, 2026). Distilled for agent consumption.*
