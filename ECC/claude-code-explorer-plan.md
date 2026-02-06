# Claude Code 2.1x Explorer Sandbox
## Product Requirements & Feature Plan

**Version:** 1.0 DRAFT  
**Date:** February 5, 2026  
**Status:** Requirements Definition Phase

---

## I. MISSION STATEMENT

Create an interactive sandbox application that allows users to **experience, explore, and understand** the architectural capabilities introduced in Claude Code 2.1x without requiring deep programming expertise. The application presents features as executable "scenes" with optional "director's commentary" that explains what's happening under the hood.

### The Problem We're Solving
Claude Code 2.1 introduces transformative capabilities—skill hot-reload, lifecycle hooks, and forked sub-agents—that collectively turn Claude Code into an **agent operating system**. However:

- The documentation describes *what* these features do, not *how they feel* in practice
- Understanding the emergent patterns (queen agents, hook-based event buses, policy islands) requires hands-on experimentation
- Users must currently write YAML frontmatter, JSON configurations, and shell scripts to explore these features
- The conceptual leap from "coding assistant" to "agent OS" is difficult without interactive demonstration

### Our Solution
A **sandbox theater** where users can:
1. Watch pre-built demonstrations of each feature ("viewing a scene")
2. Modify parameters and replay with variations ("directing a scene")
3. Access layered explanations of what's happening ("director's commentary")
4. Progress from simple to complex, building understanding incrementally

---

## II. DESIGN PHILOSOPHY

### The "Movie with Scenes" Metaphor

| Concept | Application Equivalent |
|---------|----------------------|
| **Movie** | The complete sandbox application |
| **Act** | A feature category (e.g., "Hooks", "Sub-agents", "Skills") |
| **Scene** | An individual executable demonstration |
| **Take** | A specific parameter configuration for a scene |
| **Director's Commentary** | Toggle-able explanatory overlay |
| **Screenplay** | The template/configuration driving a scene |
| **Props** | Input files, sample code, mock data |
| **Stage** | The execution environment (the Claude Code runtime being demonstrated) |

### Core Principles

1. **No Code Required (to Start)** — Users should be able to run scenes with a single action
2. **Progressive Disclosure** — Complexity reveals itself as users go deeper
3. **Live, Not Simulated** — Scenes execute real Claude Code features, not mockups
4. **Replay with Variation** — Every scene supports parameter adjustment and re-execution
5. **Contextual Learning** — Commentary appears alongside action, not in separate docs

---

## III. FEATURE INVENTORY (The Scenes)

### ACT 1: SKILLS — Live Agent Development

#### Scene 1.1: Basic Skill Creation
**Purpose:** Demonstrate that skills are just Markdown files with YAML frontmatter  
**What Users Experience:**
- View a minimal SKILL.md file
- Watch it load into a Claude Code session
- Invoke the skill via `/skill-name`
- See the behavior defined by the Markdown body

**Adjustable Parameters:**
- Skill name
- Description text
- Instruction content (the Markdown body)

**Director's Commentary Topics:**
- Where skills live (~/.claude/skills vs .claude/skills)
- Global vs project scope
- How Claude interprets the instruction body

---

#### Scene 1.2: Skill Hot-Reload
**Purpose:** Demonstrate live editing without session restart  
**What Users Experience:**
- A skill is active in a session
- User modifies the SKILL.md content
- System shows the reload detection
- User invokes skill again, sees updated behavior

**Adjustable Parameters:**
- Content changes (minor vs major)
- Timing between edit and invocation

**Director's Commentary Topics:**
- The file-watching mechanism
- What "no restart" means for development velocity
- Comparison to traditional plugin architectures

---

#### Scene 1.3: Skills with Tool Restrictions
**Purpose:** Show skills can limit available tools  
**What Users Experience:**
- A skill with `tools: Read, Grep` (read-only)
- Attempt operations that require Write — blocked
- Contrast with unrestricted skill

**Adjustable Parameters:**
- Tool whitelist combinations
- Types of restricted operations attempted

**Director's Commentary Topics:**
- Tool inheritance model
- Security implications
- Use cases (auditor agents, read-only reviewers)

---

### ACT 2: HOOKS — Deterministic Control Points

#### Scene 2.1: Hook Anatomy
**Purpose:** Explain hook structure before execution  
**What Users Experience:**
- Visual breakdown of a hook configuration
- Identification of: Event, Matcher, Command
- JSON schema visualization

**Adjustable Parameters:**
- None (educational scene)

**Director's Commentary Topics:**
- JSON configuration format
- Exit codes and their meanings
- stdin/stdout communication protocol

---

#### Scene 2.2: PreToolUse — Intercepting Operations
**Purpose:** Demonstrate blocking/allowing tool calls before execution  
**What Users Experience:**
- A PreToolUse hook on Bash commands
- Claude attempts a command
- Hook script evaluates the command
- Decision: allow, deny, or ask
- See feedback flow back to Claude

**Adjustable Parameters:**
- Command patterns to intercept
- Decision logic (allow all, deny all, conditional)
- Feedback messages

**Director's Commentary Topics:**
- Permission decisions (allow/deny/ask)
- How Claude receives rejection feedback
- Difference from prompt-based restrictions

---

#### Scene 2.3: PostToolUse — Automated Reactions
**Purpose:** Show actions triggered after tool completion  
**What Users Experience:**
- A PostToolUse hook on Write operations
- Claude writes a file
- Hook fires: runs linter, formatter, or validator
- Output feeds back into conversation

**Adjustable Parameters:**
- Target tools (Write, Edit, Bash)
- Post-actions (lint, format, test, notify)
- Output handling

**Director's Commentary Topics:**
- File watching vs hook execution
- Multiple hooks on same event
- Performance considerations

---

#### Scene 2.4: UserPromptSubmit — Context Injection
**Purpose:** Demonstrate augmenting user prompts before Claude sees them  
**What Users Experience:**
- User submits a prompt
- Hook adds contextual information
- Claude's response reflects the injected context

**Adjustable Parameters:**
- Injection content (time, location, project state)
- Conditional injection rules

**Director's Commentary Topics:**
- Difference from system prompts
- additionalContext field
- Use cases (RAG integration, real-time data)

---

#### Scene 2.5: Stop Hook — Completion Validation
**Purpose:** Show validation when Claude finishes responding  
**What Users Experience:**
- Claude completes a task
- Stop hook evaluates the output
- Decision: accept or request revision

**Adjustable Parameters:**
- Validation criteria
- Block vs continue behavior

**Director's Commentary Topics:**
- When Stop fires vs doesn't
- Automated quality gates
- Human-in-the-loop patterns

---

#### Scene 2.6: Hook Scoping Hierarchy
**Purpose:** Demonstrate the layered governance model  
**What Users Experience:**
- Global hook set
- Project hook that augments/overrides
- Skill hook that adds another layer
- Visual trace of which hooks fire for a given operation

**Adjustable Parameters:**
- Enable/disable each layer
- Conflict scenarios

**Director's Commentary Topics:**
- Hook inheritance
- Scope precedence
- Enterprise governance patterns

---

### ACT 3: SUB-AGENTS — Isolated Parallel Execution

#### Scene 3.1: Sub-Agent Basics
**Purpose:** Show sub-agent creation and invocation  
**What Users Experience:**
- View sub-agent Markdown definition
- Invoke the sub-agent
- Observe isolated context
- See summary returned to parent

**Adjustable Parameters:**
- Sub-agent role/prompt
- Tools available to sub-agent

**Director's Commentary Topics:**
- Context isolation
- System prompt via `agent:` field
- Project vs user-level storage

---

#### Scene 3.2: Context Fork (True Parallel Execution)
**Purpose:** Demonstrate `context: fork` for skill-as-sub-agent  
**What Users Experience:**
- A skill with `context: fork`
- Invocation spawns separate process
- Internal reasoning not visible to parent
- Only summary returns

**Adjustable Parameters:**
- Fork vs no-fork comparison
- Complexity of sub-task

**Director's Commentary Topics:**
- Process model implications
- Memory efficiency
- When to fork vs when to inline

---

#### Scene 3.3: Sub-Agent with Hooks (Policy Islands)
**Purpose:** Show sub-agent-scoped governance  
**What Users Experience:**
- Sub-agent with PreToolUse hook in frontmatter
- Sub-agent attempts restricted operation
- Hook blocks within sub-agent context
- Parent context unaffected

**Adjustable Parameters:**
- Hook restrictiveness
- Attempted operations

**Director's Commentary Topics:**
- Policy isolation
- Sandboxing patterns
- Read-only/write-restricted agents

---

#### Scene 3.4: Sub-Agent Loading Skills
**Purpose:** Demonstrate the inverse pattern (sub-agent that loads skills)  
**What Users Experience:**
- Sub-agent with `skills:` array in frontmatter
- Skills act as injected domain knowledge
- Sub-agent behavior shaped by loaded skills

**Adjustable Parameters:**
- Skills to load
- Skill combinations

**Director's Commentary Topics:**
- Two composition models compared
- Domain knowledge injection
- Specialization patterns

---

### ACT 4: EMERGENT PATTERNS — Architectural Compositions

#### Scene 4.1: Hooks as Event Bus
**Purpose:** Show hooks enabling inter-agent observation  
**What Users Experience:**
- Multiple sub-agents working
- Hooks emitting structured status signals
- Central observer receiving signals
- Visualization of event flow

**Adjustable Parameters:**
- Number of sub-agents
- Signal types emitted
- Observer behavior

**Director's Commentary Topics:**
- Hooks beyond automation
- Telemetry patterns
- Coordination without coupling

---

#### Scene 4.2: The Queen Agent Pattern
**Purpose:** Demonstrate supervised agent swarm  
**What Users Experience:**
- Queen agent spawns worker sub-agents
- Workers emit progress via hooks
- Queen observes, decides: retry, reassign, terminate
- Task completion with supervision

**Adjustable Parameters:**
- Worker count
- Failure injection
- Queen decision rules

**Director's Commentary Topics:**
- Swarm architecture
- Emergent vs prescribed patterns
- Real-world applications

---

#### Scene 4.3: Self-Correcting Code Generator
**Purpose:** Show validation loop with code execution  
**What Users Experience:**
- Task: generate code that passes tests
- Claude generates code
- Hook executes code against tests
- Failures feed back to Claude
- Iteration until success

**Adjustable Parameters:**
- Target problem
- Test stringency
- Iteration limits

**Director's Commentary Topics:**
- Closed-loop development
- Automated validation gates
- Integration with Judge0-style execution

---

#### Scene 4.4: Governed Deployment Pipeline
**Purpose:** Show production-grade governance  
**What Users Experience:**
- Code change proposed
- PreToolUse: validate against style guide
- PostToolUse: run security scan
- Stop: require human approval for certain files

**Adjustable Parameters:**
- Governance rules
- File patterns
- Approval requirements

**Director's Commentary Topics:**
- Enterprise use cases
- Audit trails
- Compliance automation

---

### ACT 5: THE DEVELOPMENT EXPERIENCE

#### Scene 5.1: The /hooks Command
**Purpose:** Interactive hook management  
**What Users Experience:**
- Invoke `/hooks`
- Create hook interactively
- Edit settings.json
- See hook live-reload

**Adjustable Parameters:**
- Hook type to create

**Director's Commentary Topics:**
- Interactive vs manual configuration
- Settings file locations
- Managed hooks (allowManagedHooksOnly)

---

#### Scene 5.2: The /agents Command
**Purpose:** Interactive sub-agent management  
**What Users Experience:**
- Invoke `/agents`
- Browse, create, configure sub-agents
- Tool access configuration
- MCP server integration

**Adjustable Parameters:**
- Agent to create/modify

**Director's Commentary Topics:**
- Agent discovery
- Tool inheritance
- MCP integration points

---

#### Scene 5.3: Plugin Distribution
**Purpose:** Packaging and sharing configurations  
**What Users Experience:**
- A plugin containing: slash command, sub-agent, hook
- Install via `/plugin`
- All components active
- Toggle on/off

**Adjustable Parameters:**
- Plugin components
- Enable/disable states

**Director's Commentary Topics:**
- Plugin anatomy
- Distribution mechanisms
- Team sharing patterns

---

## IV. DIRECTOR'S COMMENTARY SYSTEM

### Commentary Layers

| Layer | Content Type | Activation |
|-------|-------------|------------|
| **L0: Silent** | No commentary | Default viewing |
| **L1: Captions** | Brief inline annotations | User toggle |
| **L2: Narration** | Step-by-step explanation | User toggle |
| **L3: Deep Dive** | Technical details, code paths, design rationale | On-demand per element |
| **L4: Chat** | Interactive Q&A about the scene | Chat interface |

### Commentary Content Categories

1. **What's Happening** — Literal description of the action
2. **Why It Matters** — Significance of this capability
3. **How It Works** — Technical mechanism (file format, JSON schema, exit codes)
4. **When To Use** — Real-world application scenarios
5. **Common Mistakes** — Pitfalls and how to avoid them
6. **Related Concepts** — Links to other scenes or documentation

### Commentary Delivery Mechanisms

- **Overlay Text** — Non-intrusive annotations on the execution display
- **Sidebar Panel** — Persistent commentary alongside action
- **Pause Points** — Scene pauses with explanation before continuing
- **Highlight Traces** — Visual emphasis on relevant elements
- **Glossary Links** — Inline definitions for technical terms

---

## V. USER EXPERIENCE FLOWS

### Flow 1: First-Time Visitor
```
Landing → Feature Overview → Guided Tour (3 scenes) → Self-Exploration
```

### Flow 2: Concept Explorer
```
Select Act → Browse Scenes → Watch with Commentary L2 → Replay with Variations
```

### Flow 3: Builder
```
Select Scene → Examine Template → Export Configuration → Apply to Own Project
```

### Flow 4: Researcher
```
Search/Filter → Jump to Scene → Deep Dive Commentary → Compare Patterns
```

---

## VI. TEMPLATE STRUCTURE

Each scene is driven by a **scene template** that contains:

```yaml
scene:
  id: "2.2-pretooluse-intercept"
  act: 2
  title: "PreToolUse — Intercepting Operations"
  duration_estimate: "2-3 minutes"
  
purpose:
  one_liner: "Demonstrate blocking/allowing tool calls before execution"
  learning_outcomes:
    - "Understand the PreToolUse event timing"
    - "See how hooks communicate decisions"
    - "Learn the allow/deny/ask permission model"

prerequisites:
  scenes: ["2.1-hook-anatomy"]
  concepts: ["JSON configuration", "exit codes"]

assets:
  files:
    - path: ".claude/settings.json"
      role: "Hook configuration"
    - path: ".claude/hooks/validate-command.sh"
      role: "Hook script"
  mock_data:
    - description: "Sample bash commands to intercept"
  
parameters:
  - name: "command_pattern"
    type: "string"
    default: "rm|sudo|curl"
    description: "Regex pattern of commands to evaluate"
  - name: "decision_mode"
    type: "enum"
    values: ["allow_all", "deny_all", "conditional"]
    default: "conditional"
  - name: "feedback_verbosity"
    type: "enum"
    values: ["minimal", "detailed"]
    default: "detailed"

execution_steps:
  - step: 1
    action: "display_configuration"
    commentary_l1: "This is our hook setup"
    commentary_l2: "We're configuring a PreToolUse hook that fires before any Bash command executes. The matcher 'Bash' ensures we only intercept shell commands."
    
  - step: 2
    action: "trigger_claude_command"
    input: "Run: ls -la"
    commentary_l1: "Safe command passes through"
    commentary_l2: "The hook script receives the command via stdin as JSON. It checks against our pattern. Since 'ls' isn't in our danger list, it returns exit code 0, allowing the command."
    
  - step: 3
    action: "trigger_claude_command"
    input: "Run: rm -rf /tmp/test"
    commentary_l1: "Dangerous command blocked"
    commentary_l2: "Now 'rm' matches our pattern. The hook returns exit code 2 with a reason, which Claude sees as feedback. The operation never executes."

variations:
  - id: "allow_all"
    description: "Permissive mode - see what passes through"
    parameter_overrides:
      decision_mode: "allow_all"
  - id: "lockdown"
    description: "Deny everything - total restriction"
    parameter_overrides:
      decision_mode: "deny_all"
      
related_scenes:
  - "2.3-posttooluse-reactions"
  - "3.3-subagent-policy-islands"

export_artifacts:
  - type: "settings_json"
    description: "Hook configuration ready to use"
  - type: "hook_script"
    description: "The validation script"
```

---

## VII. NAVIGATION & DISCOVERY

### Primary Navigation
- **By Act** — Browse feature categories in order
- **By Pattern** — View emergent architectural patterns
- **By Use Case** — "I want to build a..." entry points

### Discovery Aids
- **Concept Map** — Visual graph of feature relationships
- **Dependency Tree** — "Before this scene, understand these..."
- **Difficulty Progression** — Beginner → Intermediate → Advanced tracks
- **Search** — Full-text search across scenes and commentary

### Progress Tracking
- Scenes completed
- Commentary layers explored
- Variations attempted
- Templates exported

---

## VIII. SUCCESS METRICS

### User Engagement
- Scene completion rate
- Commentary engagement (which layers, how long)
- Variation experimentation frequency
- Template export actions

### Learning Outcomes
- Pre/post concept quizzes (optional)
- User-reported confidence levels
- Time-to-first-export (applying to real project)

### Content Effectiveness
- Per-scene completion rates
- Drop-off points
- Commentary helpfulness ratings
- Feature request patterns

---

## IX. CONTENT SCOPE BOUNDARIES

### In Scope
- All Claude Code 2.1x documented features
- Emergent patterns enabled by feature combinations
- Interactive execution of real Claude Code
- Exportable configurations for user projects

### Out of Scope (for v1)
- Claude Agent SDK (separate product)
- MCP server development tutorials
- IDE integration specifics (VS Code, JetBrains)
- Cloud deployment (Anthropic API, AWS Bedrock)
- Performance optimization deep-dives

### Future Expansion Candidates
- User-contributed scenes
- Team/enterprise scenarios
- Integration with Judge0 for code validation demos
- Multi-modal demonstrations (screen recordings, live sessions)

---

## X. GLOSSARY

| Term | Definition |
|------|------------|
| **Hook** | User-defined shell command executing at lifecycle points |
| **Skill** | Markdown file with YAML frontmatter defining reusable behaviors |
| **Sub-agent** | Specialized AI assistant with isolated context |
| **Frontmatter** | YAML metadata block at the top of Markdown files |
| **Matcher** | Pattern that determines which tools/skills trigger a hook |
| **Policy Island** | Sub-agent with its own governance rules |
| **Context Fork** | Spawning a skill as a separate sub-agent process |
| **Hook Scoping** | Hierarchy determining which hooks apply (global → project → skill → sub-agent) |
| **Event Bus** | Hooks used for inter-agent communication |
| **Queen Agent** | Supervisor agent coordinating worker sub-agents |

---

## XI. APPENDIX: FEATURE MATRIX

| Feature | Type | Scope | Hot-Reload | Hooks Support |
|---------|------|-------|------------|---------------|
| Skill | Behavior module | Global/Project | ✅ Yes | ✅ Frontmatter |
| Sub-agent | Isolated assistant | Global/Project | ❌ Manual | ✅ Frontmatter |
| Hook | Automation rule | Global/Project/Skill/Sub-agent | ✅ Yes | N/A |
| Plugin | Distribution package | Installed | Via `/plugin` | Contains hooks |

---

## XII. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 DRAFT | 2026-02-05 | Planning Team | Initial requirements definition |

---

*This document defines the product vision and feature scope. Implementation decisions regarding frameworks, architecture, and technology stack are handled by the development team.*
