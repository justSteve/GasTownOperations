# ECC Context: The Inheritance Model for Claude Code Agents

**Purpose**: This document provides foundational context for sessions working on the ECC (Everything Claude Code) system. Read this at the start of any session involving zgent creation or ECC development.

---

## Core Concept: The Factory Pattern for Claude Agents

We are building a **factory pattern** for Claude Code agents. The key concepts:

### 1. Anthropic's Implicit Object Model

Anthropic's Claude Code defines an **implicit object model** through its expected `.claude/` file structure:

| Concept | File Location | Purpose |
|---------|---------------|---------|
| Subagents | `.claude/agents/*.md` | Specialized AI personas for delegation |
| Slash Commands | `.claude/commands/*.md` | User-invocable actions |
| Skills | `.claude/skills/**/*.md` | Domain knowledge and procedures |
| Rules | `.claude/rules/*.md` | Always-active behavioral constraints |
| Hooks | `.claude/hooks/hooks.json` | Event-driven automation |
| Contexts | `.claude/contexts/*.md` | Dynamic system prompt injection |
| MCP Servers | `.claude/settings.json` | External tool integrations |

This file structure IS the schema - it defines what an "Anthropic-style Claude agent" is.

### 2. ECC as the Entity Model

**ECC (Everything Claude Code)** is our entity-relationship representation of Anthropic's implicit object model. Each ECC entity corresponds to a concept that Claude Code expects.

> **Note on terminology**: References to ".NET" patterns (Entity, Factory, inheritance) are **conceptual metaphors** describing the design approach, not technology choices.

The schema is documented in: `/root/projects/gtOps/ECC/buildECCDb.sql`

### 3. zgent = Materialized Instance

A **zgent** is what you get when you materialize ECC data into the Anthropic-expected file structure. It "inherits from" the Anthropic agent type by producing files that honor the contract.

```
ECC Data (JSON)  →  Materializer CLI  →  .claude/ folder  →  zgent instance
```

### 4. This is Inheritance

Just like in object-oriented programming where a class inherits from a base class and must honor its contract, zgents inherit from the Anthropic Claude Code agent "base class" by producing compliant file structures.

---

## Key Files

| File | Purpose |
|------|---------|
| `ECC/buildECCDb.sql` | Schema documentation (canonical entity definitions) |
| `ECC/data/ecc-*.json` | Actual data files (JSON representation of entities) |
| `ECC/ecc-materializer/` | TypeScript CLI that materializes zgents |
| `ECC/ECC-CONTEXT.md` | This document |

## Data Files

| File | Contents |
|------|----------|
| `ecc-plugins.json` | Plugin template definitions (root entities) |
| `ecc-agents.json` | Subagent templates |
| `ecc-commands.json` | Slash command definitions |
| `ecc-skills.json` | Skills + patterns + workflows |
| `ecc-rules.json` | Behavioral rules |
| `ecc-hooks.json` | Event hooks + actions |
| `ecc-contexts.json` | Dynamic contexts |
| `ecc-mcp-servers.json` | MCP server configurations |
| `ecc-zgent-instances.json` | Materialized zgent instances |

---

## Materialization Patterns

There are three patterns for how ECC entities become files:

| Pattern | Entities | Result |
|---------|----------|--------|
| **One-to-One** | Agents, Commands, Skills, Rules, Contexts | One .md file per entity |
| **Aggregated** | Hooks, McpServers | Many entities → one JSON file |
| **Hierarchical** | Skills with Categories | Folder structure with nested files |

---

## Relationship Handling

| Relationship Type | Strategy |
|-------------------|----------|
| Parent → Child (Phases, Patterns, Workflows) | **Embed** in parent file as sections |
| Many-to-Many (AgentSkills, AgentRules) | **Reference by name** |
| FK Reference (InvokesAgentId) | **Reference by name** |

---

## Usage: Creating a New zgent

1. **Define a Plugin** in `ecc-plugins.json` with metadata
2. **Add component entities** (agents, commands, skills, etc.) referencing the Plugin ID
3. **Create a Zgent instance** in `ecc-zgent-instances.json` specifying:
   - Which Plugin to materialize
   - Target path for output
   - Any config overrides (variable substitutions, exclusions)
4. **Run the materializer**: `npm run materialize -- --zgent-id <id>`
5. **Verify output** at the target path

---

## Reference Implementation

The upstream reference for Claude Code configuration patterns:
- Repository: `github.com/justSteve/everything-claude-code`
- Contains battle-tested examples of all entity types

---

*Last updated: 2026-01-28*
