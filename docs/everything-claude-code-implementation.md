# The Everything Claude Code Implementation

A comprehensive guide to the structured Claude Code development methodology implemented in gtOps.

---

## Table of Contents

1. [Origins and Philosophy](#origins-and-philosophy)
2. [Architecture Overview](#architecture-overview)
3. [Component Deep Dive](#component-deep-dive)
   - [Rules](#rules)
   - [Commands](#commands)
   - [Skills](#skills)
   - [Hooks](#hooks)
4. [How It All Works Together](#how-it-all-works-together)
5. [Customization for gtOps](#customization-for-gtops)
6. [Using the System](#using-the-system)
7. [Extending to Other Properties](#extending-to-other-properties)
8. [File Reference](#file-reference)

---

## Origins and Philosophy

### The Source

This implementation draws from [everything-claude-code](https://github.com/affaan-m/everything-claude-code), a battle-tested collection of Claude Code configurations developed by Affaan Mustafa over 10+ months of intensive daily use. The approach won the Anthropic x Forum Ventures hackathon and has been refined through building real production applications.

### Core Principles

The methodology rests on several key insights:

1. **Structure Enables Autonomy**: By providing Claude with clear rules, domain knowledge, and workflows, you reduce the need for constant guidance while improving output quality.

2. **Separation of Concerns**: Different types of knowledge serve different purposes:
   - **Rules** = Always-follow constraints (what NOT to do, critical patterns)
   - **Skills** = Domain knowledge (reference material, how things work)
   - **Commands** = Workflows (step-by-step procedures for common tasks)
   - **Hooks** = Automation (event-driven actions)

3. **Context is Precious**: The 200k token context window is your most valuable resource. The system is designed to inject relevant knowledge only when needed, not all at once.

4. **Persistence Across Sessions**: Claude Code sessions end, but knowledge should persist. The system provides mechanisms for capturing learnings and transferring context between sessions.

### Adaptation for gtOps

The original everything-claude-code is optimized for TypeScript/React development with heavy emphasis on TDD, code review, and build processes. gtOps required adaptation because:

- **gtOps is an operations center**, not a development project
- **The primary interface is tmux**, not a code editor
- **Work involves observation and coordination**, not code production
- **The COO role is already well-defined** in AGENTS.md

We preserved what made sense (rules, skills, commands, hooks structure) while adapting content for operational work.

---

## Architecture Overview

### Directory Structure

```
.claude/
├── commands/           # Slash commands (workflows)
│   ├── gt-update.md    # Daily sync and health check
│   ├── handoff.md      # Create session handoff
│   └── health-check.md # Quick status check
│
├── rules/              # Always-follow guidelines
│   ├── tmux-interaction.md   # How to interact with GT
│   ├── dual-user.md          # root vs gtuser contexts
│   ├── knowledge-capture.md  # When to document learnings
│   └── session-hygiene.md    # Session start/end protocols
│
├── skills/             # Domain knowledge reference
│   ├── gt-commands.md      # GT CLI reference
│   ├── gt-architecture.md  # Agent roles and concepts
│   └── troubleshooting.md  # Common issues and fixes
│
├── hooks/              # Event-driven automation
│   ├── hooks.json          # Hook configuration
│   └── scripts/
│       └── session-start.sh # Handoff reminder
│
└── settings.local.json # Permissions configuration
```

### How Claude Code Uses These

| Component | Loaded When | Purpose |
|-----------|-------------|---------|
| **Rules** | Always (system prompt) | Constrain behavior, prevent mistakes |
| **Commands** | On `/command` invocation | Guide multi-step workflows |
| **Skills** | On reference or invocation | Provide domain knowledge |
| **Hooks** | On matching events | Automate recurring actions |

---

## Component Deep Dive

### Rules

Rules are **always-loaded guidelines** that constrain Claude's behavior. They should be:
- Concise (20-40 lines ideal)
- Actionable (clear do/don't guidance)
- Critical (things that would cause problems if violated)

#### tmux-interaction.md

**Purpose**: Prevent the most common mistake—running GT commands as root.

**Key Content**:
```bash
# Required pattern for GT interaction
sudo -u gtuser tmux send-keys -t gt-user:main.0 '<command>' Enter
sleep 2
sudo -u gtuser tmux capture-pane -t gt-user:main.0 -p -S -20
```

**Why It Matters**: GT runs as `gtuser`. Commands run as root appear to work but don't actually affect the GT instance. This rule prevents hours of confusion.

#### dual-user.md

**Purpose**: Clarify the two-user architecture.

**Key Content**:
- root owns gtOps, daemon control, file management
- gtuser owns the GT instance, agent sessions
- Tmux servers are separate (can't switch-client between them)
- Files in /root/ are inaccessible to GT agents

**Why It Matters**: New sessions often forget the dual-user model. This rule provides quick reference.

#### knowledge-capture.md

**Purpose**: Ensure learnings persist across sessions.

**Key Content**:
- Update `LearnedSomethingNewToday.md` for discoveries
- Update `DontDoThisAgain.md` for mistakes
- Standard entry format (date, discovery, context, application)

**Why It Matters**: Without explicit prompting, valuable learnings get lost when sessions end.

#### session-hygiene.md

**Purpose**: Standardize session start and end procedures.

**Key Content**:
- Session start: Check for HANDOFF files, rename them, review CurrentStatus.md
- Session end: Update status, create handoff, consider knowledge capture

**Why It Matters**: Consistent procedures ensure context transfers reliably.

---

### Commands

Commands are **invocable workflows** triggered by `/command-name`. They should be:
- Step-by-step (numbered procedures)
- Self-contained (include all necessary context)
- Outcome-focused (clear deliverable)

#### /gt-update (existing)

**Purpose**: Daily sync with upstream, build, install, health check.

**Steps**:
1. Fetch upstream
2. Compare versions
3. Fast-forward merge
4. Build and install
5. Run doctor with auto-fix
6. Initialize dashboard
7. Start services
8. Report status

**When to Use**: Start of day, after upstream changes, when services need restart.

#### /health-check (new)

**Purpose**: Quick status without full update workflow.

**Steps**:
1. Check GT version
2. Run doctor (no fix)
3. Check active agents
4. Check daemon status
5. Report summary table

**When to Use**: Quick status check, verifying health after changes.

#### /handoff (new)

**Purpose**: Create session continuity document.

**Steps**:
1. Get current date
2. Gather context from CurrentStatus.md
3. Check GT status
4. Create handoff with standard structure
5. Save to HANDOFF-COO-{date}.md

**When to Use**: End of substantive work sessions.

---

### Skills

Skills are **reference documents** providing domain knowledge. They should be:
- Comprehensive (cover the domain thoroughly)
- Well-organized (tables, headers, examples)
- Accurate (extracted from authoritative sources)

#### gt-commands.md

**Purpose**: Quick reference for GT CLI commands.

**Content Organization**:
- Town Management (gt up, gt down, gt status, gt doctor)
- Work Management (gt ready, gt trail, gt hook, gt sling)
- Agent Interaction (gt agents, gt mayor, gt nudge, gt peek)
- Mail System (gt mail inbox, gt mail send)
- Session Management (gt handoff, gt seance, gt prime)
- Diagnostics (gt feed, gt costs, gt daemon status)

**Source**: Extracted from `gas-town-agent-reference.md`

#### gt-architecture.md

**Purpose**: Understand the multi-agent system structure.

**Content Organization**:
- Two-tier diagram (Town level vs Rig level)
- Role definitions (Mayor, Deacon, Dogs, Boot, Witness, Polecats, Refinery, Crew)
- Core concepts (GUPP, Beads, Molecules, Wisps, Convoys)
- Current rigs table

**Source**: Distilled from `gas-town-agent-reference.md`

#### troubleshooting.md

**Purpose**: Solve common problems quickly.

**Content Organization**:
- Doctor check failures (agent-beads-exist, patrol-not-stuck, clone-divergence, priming)
- Terminal issues (orphaned input, popups, missing sessions)
- Service issues (services not starting, mayor not responding)
- Beads issues (message ID prefixes, address resolution)
- When to escalate

**Source**: Patterns from `LearnedSomethingNewToday.md` and operational experience

---

### Hooks

Hooks are **event-driven automations** that fire on specific triggers. They should be:
- Lightweight (fast execution)
- Non-blocking (don't interrupt workflow)
- Helpful (provide useful reminders or actions)

#### hooks.json Structure

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [{
          "type": "command",
          "command": "/path/to/script.sh"
        }],
        "description": "What this hook does"
      }
    ]
  }
}
```

**Available Events**:
- `SessionStart` - New Claude Code session begins
- `SessionEnd` - Session ends
- `PreToolUse` - Before a tool executes
- `PostToolUse` - After a tool executes
- `PreCompact` - Before context compaction
- `Stop` - After Claude's response completes

#### session-start.sh

**Purpose**: Remind about pending handoff files.

**Behavior**:
```bash
# Checks for HANDOFF-*.md files
# If found, prints reminder to process them
# Also notes if CurrentStatus.md is available
```

**Why It Matters**: Easy to forget about handoff files. The reminder ensures they get processed.

---

## How It All Works Together

### Session Lifecycle Example

**1. Session Starts**
- `session-start.sh` hook fires
- Outputs: "Found 2 handoff file(s)... REMINDER: Read and rename"
- COO reads rules (loaded automatically)

**2. COO Processes Handoffs**
- Following `session-hygiene.md` rule
- Reads HANDOFF-COO-2026-01-25.md
- Renames to COO-2026-01-25.md
- Reviews CurrentStatus.md

**3. COO Checks Health**
- Runs `/health-check` command
- Gets quick status table
- Identifies any issues

**4. COO Does Work**
- References `gt-commands.md` skill for CLI syntax
- References `gt-architecture.md` skill for agent understanding
- Uses `troubleshooting.md` skill when issues arise
- Follows `tmux-interaction.md` rule for all GT commands
- Follows `dual-user.md` rule for context awareness

**5. COO Discovers Something**
- Following `knowledge-capture.md` rule
- Updates LearnedSomethingNewToday.md with discovery

**6. Session Ends**
- Runs `/handoff` command
- Creates HANDOFF-COO-2026-01-26.md
- Updates CurrentStatus.md if needed

### Information Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     SESSION START                           │
│  hooks/session-start.sh → Reminder about handoffs          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    RULES (Always Loaded)                    │
│  tmux-interaction.md  → How to run GT commands             │
│  dual-user.md         → root vs gtuser context             │
│  knowledge-capture.md → When to document                    │
│  session-hygiene.md   → Start/end procedures               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 COMMANDS (On Invocation)                    │
│  /gt-update    → Full daily sync workflow                  │
│  /health-check → Quick status check                        │
│  /handoff      → Create continuity document                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  SKILLS (On Reference)                      │
│  gt-commands.md      → CLI reference                       │
│  gt-architecture.md  → System understanding                │
│  troubleshooting.md  → Problem solving                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      SESSION END                            │
│  /handoff → Create HANDOFF-COO-{date}.md                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Customization for gtOps

### What We Kept from everything-claude-code

| Component | Kept | Reason |
|-----------|------|--------|
| Directory structure | Yes | Clean organization |
| Rules concept | Yes | Critical for consistent behavior |
| Commands concept | Yes | Workflows are universally useful |
| Skills concept | Yes | Domain knowledge is essential |
| Hooks concept | Yes | Automation reduces friction |
| YAML frontmatter | Yes | Commands use it for metadata |

### What We Adapted

| Original | Adapted | Reason |
|----------|---------|--------|
| TDD workflow | Removed | gtOps doesn't do TDD |
| Code review agent | Removed | Not a code production project |
| TypeScript checks | Removed | No TypeScript in gtOps |
| Prettier formatting | Removed | Mostly markdown files |
| console.log warnings | Removed | No JS/TS code |
| Node.js scripts | Bash scripts | Matches existing tooling |

### What We Added

| Addition | Purpose |
|----------|---------|
| tmux-interaction rule | Critical for GT work |
| dual-user rule | Unique to this architecture |
| GT command reference | Domain-specific knowledge |
| GT architecture skill | System understanding |
| Troubleshooting skill | Operational efficiency |

### What We Skipped

| Skipped | Reason |
|---------|--------|
| plugin.json | Not needed for single project |
| contexts/ | Handoff protocol covers this |
| agents/ directory | AGENTS.md is sufficient |
| Memory persistence hooks | Handoff protocol is better fit |
| Verification loops | Not applicable to ops work |

---

## Using the System

### Daily Workflow

```bash
# Start of day
/gt-update              # Sync, build, health check

# During work
/health-check           # Quick status checks

# End of day
/handoff                # Create continuity document
```

### Quick Reference

| Need | Action |
|------|--------|
| Run GT command | Follow tmux-interaction rule |
| Check GT status | `/health-check` |
| Full sync | `/gt-update` |
| Create handoff | `/handoff` |
| GT CLI syntax | Reference gt-commands.md skill |
| Understand agents | Reference gt-architecture.md skill |
| Fix an issue | Reference troubleshooting.md skill |
| Document learning | Follow knowledge-capture rule |

### Adding New Rules

Create a new file in `.claude/rules/`:

```markdown
# Rule: [Name]

[Brief description of what this rule governs]

## [Section]

[Content - keep concise, actionable]

## Never

- [Things to avoid]

## Always

- [Things to do]
```

### Adding New Commands

Create a new file in `.claude/commands/`:

```markdown
---
description: "Brief description for command list"
allowed-tools: ["Bash", "Read", "Write"]
---

# [Command Name]

[What this command does]

## Workflow

1. **Step one**
   ```bash
   command here
   ```

2. **Step two**
   ...

## When to Use

- [Situation 1]
- [Situation 2]
```

Update `.claude/settings.local.json` to add permissions:
```json
"Skill(new-command)",
"Skill(new-command:*)"
```

### Adding New Skills

Create a new file in `.claude/skills/`:

```markdown
# Skill: [Name]

[What knowledge this provides]

## [Section]

| Column 1 | Column 2 |
|----------|----------|
| Data | Data |

## [Another Section]

[More content - be comprehensive]
```

---

## Extending to Other Properties

### Template Extraction

The following components are **generic** and can be reused:

**Rules (adapt content, keep structure)**:
- knowledge-capture.md (change file paths)
- session-hygiene.md (adapt procedures)

**Commands (adapt content, keep structure)**:
- handoff.md (change role name and context)
- health-check.md (change what to check)

**Hooks (reusable as-is)**:
- session-start.sh (change directory path)

### Property-Specific Components

Each property needs its own:
- Domain-specific rules (like tmux-interaction for gtOps)
- Domain-specific skills (like gt-commands for gtOps)
- Domain-specific commands (like /gt-update for gtOps)

### Rollout Checklist

For each new property:

1. [ ] Create `.claude/` directory structure
2. [ ] Copy generic rules, adapt paths/content
3. [ ] Create property-specific rules
4. [ ] Copy generic commands, adapt for property
5. [ ] Create property-specific commands
6. [ ] Create property-specific skills
7. [ ] Set up hooks (copy and adapt paths)
8. [ ] Update settings.local.json with permissions
9. [ ] Test all commands work
10. [ ] Document property-specific patterns

---

## File Reference

### Complete File Listing

```
.claude/
├── commands/
│   ├── gt-update.md        # 124 lines - Daily sync workflow
│   ├── handoff.md          #  67 lines - Create handoff document
│   └── health-check.md     #  52 lines - Quick status check
├── rules/
│   ├── tmux-interaction.md #  47 lines - GT interaction patterns
│   ├── dual-user.md        #  38 lines - User context rules
│   ├── knowledge-capture.md #  42 lines - Documentation triggers
│   └── session-hygiene.md  #  44 lines - Session protocols
├── skills/
│   ├── gt-commands.md      #  95 lines - CLI reference
│   ├── gt-architecture.md  #  91 lines - System architecture
│   └── troubleshooting.md  # 127 lines - Problem solutions
├── hooks/
│   ├── hooks.json          #  15 lines - Hook configuration
│   └── scripts/
│       └── session-start.sh #  18 lines - Handoff reminder
└── settings.local.json     #  24 lines - Permissions
```

### Key External Files

| File | Purpose |
|------|---------|
| `/root/projects/gtOps/AGENTS.md` | Primary COO role definition |
| `/root/projects/gtOps/CurrentStatus.md` | Live operational status |
| `/root/projects/gtOps/LearnedSomethingNewToday.md` | Discovery log |
| `/root/projects/gtOps/DontDoThisAgain.md` | Mistake log |
| `/root/projects/gtOps/gas-town-agent-reference.md` | GT architecture source |
| `/root/projects/gtOps/HANDOFF-*.md` | Session handoff documents |

---

## Conclusion

The everything-claude-code methodology provides a structured approach to working with Claude Code that:

1. **Reduces cognitive load** - Rules and skills provide ready reference
2. **Ensures consistency** - Commands standardize workflows
3. **Preserves knowledge** - Handoffs and knowledge capture persist learnings
4. **Prevents mistakes** - Rules constrain behavior before errors occur
5. **Scales across properties** - Structure is reusable with domain adaptation

For gtOps specifically, this implementation respects the existing COO role definition while adding practical tooling that makes daily operations smoother and more reliable.

The system is designed to evolve. As new patterns emerge, add them to skills. As new mistakes happen, add rules to prevent them. As new workflows develop, add commands to standardize them. The structure accommodates growth while maintaining organization.

---

*Document created: 2026-01-25*
*Based on: everything-claude-code by Affaan Mustafa*
*Adapted for: gtOps (GasTown Operations Center)*
