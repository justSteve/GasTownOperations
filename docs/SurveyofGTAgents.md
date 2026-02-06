# Survey of Gas Town Agents: Alignment with Anthropic's Agent Framework

*Survey Date: 2026-01-29*

## Executive Summary

This survey evaluates the Gas Town (GT) staff agents against Anthropic's published framework for building effective agents ([Building Effective AI Agents](https://www.anthropic.com/research/building-effective-agents)). The GT system implements a sophisticated multi-agent architecture where Claude-powered agents collaborate through message-passing and shared state, operating as a coordinated "town" metaphor.

---

## Anthropic's Agent Framework (Reference)

### Agent vs. Workflow Distinction

| Category | Definition | Autonomy Level |
|----------|------------|----------------|
| **Workflow** | Systems where LLMs and tools are orchestrated through predefined code paths | Low - follows fixed paths |
| **Agent** | Systems where LLMs dynamically direct their own processes and tool usage | High - makes dynamic decisions |

### Core Principles

1. **Simplicity**: Design agents without unnecessary complexity
2. **Transparency**: Explicitly display the agent's planning steps
3. **Documentation and Testing**: Craft agent-computer interfaces (ACI) through thorough tool specifications

### Agent Patterns Identified by Anthropic

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Augmented LLM** | Base LLM + retrieval, tools, memory | Foundation for all agents |
| **Prompt Chaining** | Sequential steps with checkpoints ("gates") | Fixed subtasks |
| **Routing** | Classify inputs, direct to specialized handlers | Separation of concerns |
| **Parallelization** | Simultaneous LLM operations (sectioning/voting) | Independent subtasks |
| **Orchestrator-Workers** | Central LLM delegates to workers, synthesizes results | Dynamic task decomposition |
| **Evaluator-Optimizer** | Generate + feedback loops | Iterative refinement |
| **Autonomous Agent** | Tools + environmental feedback in continuous loops | Complex, open-ended tasks |

### Required Agent Characteristics

- Clear initial task understanding
- Independent operation with human oversight potential
- Environmental ground truth at each step (tool results)
- Checkpoint-based human feedback capability
- Defined stopping conditions
- Error recovery mechanisms

---

## Gas Town Agent Inventory

The GT "staff" comprises the following agent roles:

| Agent | Role | Analogy |
|-------|------|---------|
| **Mayor** | Strategic coordinator, task dispatcher | Manager/Executive |
| **Polecat** | Implementation worker, code execution | Worker/Developer |
| **Witness** | Per-rig monitor, lifecycle oversight | Pit Boss/Supervisor |
| **Refinery** | Merge queue processor | Engineer/CI Pipeline |
| **Deacon** | System health monitor, infrastructure | System Administrator |
| **Dog** | Deacon's helper for cross-rig tasks | Infrastructure Worker |
| **Crew** | Human-directed subagents, persistent workspaces | Contractor Team |

---

## Individual Agent Analysis

### 1. Mayor

**Source**: [internal/mayor/manager.go](../gastown/internal/mayor/manager.go)

#### Role Description
The Mayor is the strategic coordinator for Gas Town. It receives high-level directives, decomposes work into tasks, assigns issues to polecats, and monitors overall progress.

#### Anthropic Pattern Alignment

| Pattern | Alignment | Evidence |
|---------|-----------|----------|
| **Orchestrator-Workers** | **Strong** | Mayor dynamically breaks tasks, delegates to polecats, synthesizes results |
| **Routing** | **Moderate** | Classifies work type, routes to appropriate workers |
| **Autonomous Agent** | **Strong** | Operates in continuous loops, uses tools based on environmental feedback |

#### Framework Compliance Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Dynamic process control | **Yes** | Mayor decides task decomposition, not predefined |
| Tool usage | **Yes** | Mail system, beads (issue tracking), tmux interaction |
| Environmental feedback | **Yes** | Receives completion signals, monitors progress |
| Human-in-the-loop | **Yes** | Can escalate, accepts human directives |
| Stopping conditions | **Partial** | Context limit triggers handoff, but patrol loops indefinitely |
| Error recovery | **Yes** | Escalation paths, retry mechanisms |

#### Verdict: **True Agent**
Mayor exhibits high autonomy in directing processes and making dynamic decisions. It exemplifies the Orchestrator-Workers pattern with elements of Routing.

---

### 2. Polecat

**Source**: [internal/polecat/types.go](../gastown/internal/polecat/types.go), [mol-polecat-work.formula.toml](../gastown/internal/formula/formulas/mol-polecat-work.formula.toml)

#### Role Description
Polecats are ephemeral worker agents that execute specific implementation tasks. They follow the "self-cleaning model": receive work, implement, submit to merge queue, then terminate. There is no idle state.

#### Anthropic Pattern Alignment

| Pattern | Alignment | Evidence |
|---------|-----------|----------|
| **Prompt Chaining** | **Strong** | Follows `mol-polecat-work` formula with sequential steps and gates |
| **Augmented LLM** | **Strong** | Has tools (git, beads, mail), memory (issue context), retrieval (codebase) |
| **Autonomous Agent** | **Moderate** | Within its molecule, makes implementation decisions autonomously |

#### Framework Compliance Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Dynamic process control | **Partial** | Follows predefined molecule steps, but implementation choices are dynamic |
| Tool usage | **Yes** | Git, bash, file editing, mail, beads |
| Environmental feedback | **Yes** | Test results, git status, compilation output |
| Human-in-the-loop | **Partial** | Can mail Witness/Mayor for help, but primarily autonomous |
| Stopping conditions | **Yes** | `gt done` is explicit termination |
| Error recovery | **Yes** | Self-review, escalation to Witness |

#### Key Insight: Workflow Within Agent
Polecats operate as **Autonomous Agents** executing a **Prompt Chaining workflow**. The molecule (formula) defines the workflow, but the polecat's implementation decisions within each step are autonomous.

#### Verdict: **Hybrid Agent/Workflow**
Polecat is a workflow-guided autonomous agent. It follows predefined steps but makes dynamic decisions within them. This matches Anthropic's recommendation: "Start with simple prompts... add multi-step agentic systems only when simpler solutions fall short."

---

### 3. Witness

**Source**: [internal/witness/manager.go](../gastown/internal/witness/manager.go), [mol-witness-patrol.formula.toml](../gastown/internal/formula/formulas/mol-witness-patrol.formula.toml)

#### Role Description
The Witness is the "Pit Boss" for a rig. It monitors polecats, nudges them toward completion, verifies clean git state before cleanup, and escalates stuck workers. Importantly, **Witness does NOT do implementation work** - its job is oversight.

#### Anthropic Pattern Alignment

| Pattern | Alignment | Evidence |
|---------|-----------|----------|
| **Evaluator-Optimizer** | **Strong** | Monitors polecat output, provides feedback, triggers corrections |
| **Autonomous Agent** | **Strong** | Continuous patrol loops with environmental discovery |
| **Routing** | **Moderate** | Routes different message types to appropriate handlers |

#### Framework Compliance Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Dynamic process control | **Yes** | Discovers state each cycle, makes dynamic decisions |
| Tool usage | **Yes** | Mail, beads, tmux monitoring, git inspection |
| Environmental feedback | **Yes** | Observes tmux panes, agent beads, mail |
| Human-in-the-loop | **Yes** | Escalates to Mayor, can request human intervention |
| Stopping conditions | **Yes** | Context limit triggers handoff/respawn |
| Error recovery | **Yes** | Cleanup wisps for exception handling |

#### Verdict: **True Agent**
Witness is a monitoring/evaluation agent that exemplifies the Evaluator-Optimizer pattern. It maintains meaningful human oversight through escalation paths.

---

### 4. Refinery

**Source**: [internal/refinery/types.go](../gastown/internal/refinery/types.go), [mol-refinery-patrol.formula.toml](../gastown/internal/formula/formulas/mol-refinery-patrol.formula.toml)

#### Role Description
The Refinery is the "Engineer in the engine room." It processes polecat branches, merging them to main one at a time with sequential rebasing. It enforces the "Beads Promise" - never merge failing tests.

#### Anthropic Pattern Alignment

| Pattern | Alignment | Evidence |
|---------|-----------|----------|
| **Prompt Chaining** | **Strong** | Sequential merge process with verification gates |
| **Evaluator-Optimizer** | **Moderate** | Runs tests, evaluates results, can trigger rework |
| **Autonomous Agent** | **Moderate** | Operates patrol loops, handles failures dynamically |

#### Framework Compliance Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Dynamic process control | **Partial** | Merge process is structured, but failure handling is dynamic |
| Tool usage | **Yes** | Git, beads, mail, test runners |
| Environmental feedback | **Yes** | Test results, merge conflicts, git state |
| Human-in-the-loop | **Partial** | Creates conflict-resolution tasks, notifies Witness |
| Stopping conditions | **Yes** | Context limit or empty queue triggers exit |
| Error recovery | **Yes** | Comprehensive failure type handling |

#### Verdict: **Workflow with Agentic Exception Handling**
Refinery operates as a **structured workflow** for the happy path (fetch, rebase, test, merge) but becomes **agentic** when handling exceptions (conflicts, test failures, edge cases). This aligns with Anthropic's guidance: use workflows where deterministic, add agency where dynamic decisions are needed.

---

### 5. Deacon

**Source**: [internal/deacon/manager.go](../gastown/internal/deacon/manager.go)

#### Role Description
The Deacon is the system health monitor - a daemon-like agent that performs infrastructure maintenance, health checks, and ensures other agents are running. It's managed by the GT daemon with heartbeat-triggered restarts.

#### Anthropic Pattern Alignment

| Pattern | Alignment | Evidence |
|---------|-----------|----------|
| **Autonomous Agent** | **Strong** | Continuous patrol loops, environmental monitoring |
| **Routing** | **Moderate** | Different patrol actions based on discovered state |

#### Framework Compliance Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Dynamic process control | **Yes** | Discovers infrastructure state, responds dynamically |
| Tool usage | **Yes** | tmux, system commands, mail |
| Environmental feedback | **Yes** | Heartbeat monitoring, session detection |
| Human-in-the-loop | **Partial** | Escalates serious issues to Mayor |
| Stopping conditions | **Yes** | Context limit triggers respawn via daemon |
| Error recovery | **Yes** | Self-healing through daemon restart |

#### Unique Characteristic: Second-Order Monitoring
Witnesses collectively monitor Deacon health, preventing the "who watches the watchers" problem. This is a sophisticated multi-agent reliability pattern.

#### Verdict: **True Agent (Infrastructure)**
Deacon is an infrastructure-focused autonomous agent with appropriate scope limitation.

---

### 6. Dog

**Source**: [internal/dog/types.go](../gastown/internal/dog/types.go)

#### Role Description
Dogs are Deacon's helper workers for cross-rig infrastructure tasks. Unlike polecats (single-rig, ephemeral), dogs handle multi-rig work with reusable worktrees.

#### Anthropic Pattern Alignment

| Pattern | Alignment | Evidence |
|---------|-----------|----------|
| **Worker (in Orchestrator-Workers)** | **Strong** | Receives tasks from Deacon, executes, reports back |
| **Augmented LLM** | **Yes** | Tools + multi-rig worktrees |

#### Framework Compliance Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Dynamic process control | **Partial** | Follows assigned work, limited autonomous decision-making |
| Tool usage | **Yes** | Multi-rig git operations, file system |
| Environmental feedback | **Yes** | Git state across rigs |
| Human-in-the-loop | **Low** | Primarily managed by Deacon |
| Stopping conditions | **Yes** | Task completion |
| Error recovery | **Partial** | Escalates to Deacon |

#### Verdict: **Worker Component**
Dogs are better characterized as worker components in an Orchestrator-Workers pattern rather than fully autonomous agents. They have limited independent decision-making.

---

### 7. Crew

**Source**: [internal/crew/types.go](../gastown/internal/crew/types.go), [internal/crew/manager.go](../gastown/internal/crew/manager.go)

#### Role Description
Crew members are **human-directed Claude subagents** operating in persistent workspaces. Unlike polecats (which receive automated task assignments and self-terminate), crew members:
- Run Claude in their own tmux sessions (`gt-<rig>-crew-<name>`)
- Receive full agent infrastructure (settings, beads, PRIME.md)
- Persist across sessions (no self-cleaning)
- Take direction from humans rather than Mayor

#### Anthropic Pattern Alignment

| Pattern | Alignment | Evidence |
|---------|-----------|----------|
| **Augmented LLM** | **Strong** | Full tool access, retrieval, memory via beads |
| **Autonomous Agent** | **Moderate** | Autonomous within human-directed tasks |
| **Human-in-the-loop** | **Strong** | Primary interaction model is human direction |

#### Framework Compliance Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Dynamic process control | **Yes** | Makes implementation decisions autonomously |
| Tool usage | **Yes** | Git, bash, file editing, beads, mail |
| Environmental feedback | **Yes** | Test results, git state, compilation output |
| Human-in-the-loop | **Primary** | Human direction is the defining characteristic |
| Stopping conditions | **Yes** | Session termination, handoff |
| Error recovery | **Yes** | Can escalate, request help |

#### Verdict: **Human-Directed Subagents**
Crew members are fully-featured Claude agents that operate under human direction rather than automated orchestration. They exemplify Anthropic's human-in-the-loop pattern as a primary operating mode. The key distinction from polecats is **who assigns the work** (human vs Mayor) and **lifecycle** (persistent vs ephemeral).

---

## Summary Assessment

### Overall Architecture Classification

Gas Town implements a **Multi-Agent Orchestration System** that combines several Anthropic patterns:

```
                    ┌─────────────────────────────────────────────┐
                    │                   MAYOR                     │
                    │         (Orchestrator-Workers +             │
                    │              Routing Agent)                 │
                    └─────────────────┬───────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐           ┌─────────────────┐           ┌─────────────────┐
│    WITNESS    │           │     POLECAT     │           │    REFINERY     │
│  (Evaluator-  │◄─────────►│    (Worker +    │──────────►│   (Workflow +   │
│   Optimizer)  │           │ Prompt Chain)   │           │   Evaluator)    │
└───────────────┘           └─────────────────┘           └─────────────────┘
        │
        ▼
┌───────────────┐           ┌─────────────────┐
│    DEACON     │──────────►│       DOG       │
│ (Autonomous   │           │    (Worker)     │
│  Infrastructure)          └─────────────────┘
└───────────────┘
```

### Pattern Usage Summary

| Agent | Primary Pattern | Secondary Pattern | Autonomy Level |
|-------|-----------------|-------------------|----------------|
| Mayor | Orchestrator-Workers | Routing | **High** |
| Polecat | Prompt Chaining | Autonomous Agent | **Medium** |
| Witness | Evaluator-Optimizer | Autonomous Agent | **High** |
| Refinery | Workflow | Agentic Exception Handling | **Medium** |
| Deacon | Autonomous Agent | Routing | **High** |
| Dog | Worker | - | **Low** |
| Crew | Human-in-the-loop | Autonomous Agent | **Medium** (human-directed) |

### Alignment with Anthropic Principles

| Principle | GT Implementation | Assessment |
|-----------|-------------------|------------|
| **Simplicity** | Each agent has focused scope | Good |
| **Transparency** | Molecules define explicit steps, mail provides audit trail | Good |
| **Tool Documentation** | gt commands, beads system well-defined | Good |
| **Human-in-the-loop** | Escalation paths, Mayor oversight | Good |
| **Environmental Feedback** | ZFC compliance (truth from tmux/git state) | Excellent |
| **Stopping Conditions** | Context limits, explicit termination | Good |

---

## Recommendations

### Strengths

1. **ZFC Compliance**: GT's "Zero Stored Running State" philosophy aligns with Anthropic's emphasis on environmental ground truth
2. **Role Separation**: Clear boundaries between oversight (Witness) and implementation (Polecat)
3. **Graceful Degradation**: Multi-layered escalation (Polecat → Witness → Mayor → Human)
4. **Self-Cleaning Model**: Ephemeral polecats avoid state accumulation issues

### Areas for Enhancement

1. **Explicit Gate Verification**: While molecules have gates, explicit programmatic verification (Anthropic's "poka-yoke") could be strengthened
2. **Voting/Parallelization**: GT could benefit from Anthropic's voting pattern for critical decisions
3. **Evaluation Loops**: More sophisticated feedback loops between Refinery and Polecats on test failures

---

## References

- [Building Effective AI Agents](https://www.anthropic.com/research/building-effective-agents) - Anthropic
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) - Anthropic Engineering
- [Anthropic Cookbook - Agents](https://github.com/anthropics/anthropic-cookbook/tree/main/patterns/agents) - Reference Implementation

---

*Generated by COO for Gas Town Operations*
