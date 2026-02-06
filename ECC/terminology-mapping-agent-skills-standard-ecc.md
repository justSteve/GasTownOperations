# Terminology Mapping: Agent Skills Standard → ECC

## Terminology Mapping: Agent Skills Standard → ECC

| Anthropic Term | ECC Entity | Notes |
|----------------|------------|-------|
| **Skill** | `EccSkill` | ✓ Direct match. Progressive disclosure via `SKILL.md` + supporting files |
| **Agent** (via Task tool) | `EccAgent` | CC uses "subagent" - ECC captures the `model`, `tools`, `instructions` pattern |
| **Command** (slash command) | `EccCommand` | `/name` invocation pattern. ECC adds `phases` for multi-step workflows |
| **Rule** | `EccRule` | CC loads from `.claude/rules/` - always-active behavioral constraints |
| **Hook** | `EccHook` | Event-driven automation (`PreToolUse`, `PostToolUse`, etc.) |
| **MCP Server** | `EccMcpServer` | External tool integration via settings.json |
| **Context** | `EccContext` | ECC addition - dynamic system prompt injection (not in base standard) |

## Key Conceptual Alignment

**Anthropic's Progressive Disclosure** maps to ECC's materialization:
- Level 1 (metadata) → frontmatter fields (`name`, `description`)
- Level 2 (instructions) → `content` field materialized to markdown body
- Level 3+ (references) → embedded `patterns`, `workflows`, `skillRefs`

**The OO "inheritance" concept you mentioned:**
- ECC's `pluginId` creates a **composition** relationship (not true inheritance)
- A `Plugin` is the **root template** containing agents, commands, skills
- A `Zgent` is a **materialized instance** of a plugin deployed to a target path
- `invokesAgentRef` and `skillRefs` provide **delegation** (agent invokes agent, skill references skill)

## Where ECC Extends the Standard

| ECC Concept | Standard Equivalent | Extension Purpose |
|-------------|---------------------|-------------------|
| `EccPlugin` | *(none)* | Groups related artifacts into deployable package |
| `EccZgent` | *(none)* | Tracks materialization instances with config overrides |
| `EccContext` | *(partial - prompt caching?)* | Dynamic context injection by situation |
| `Phases` in commands | *(none)* | Structured multi-step workflow definition |
| `ChecklistItems` in agents | *(none)* | Priority-ordered task lists for agent behavior |
| `Patterns` / `Workflows` in skills | Supporting files | Embedded rather than file-referenced |

## Naming Convention Differences

| Aspect | Agent Skills Standard | ECC Convention |
|--------|----------------------|----------------|
| Skill storage | `.claude/skills/{name}/SKILL.md` | Same ✓ |
| Skill with category | *(not specified)* | `.claude/skills/{category}/{name}/SKILL.md` |
| Frontmatter | `name`, `description` required | Maps to `name`, `description` fields |
| ID format | Not specified | `{type}-{number}` (e.g., `agent-001`) |
| Name format | Lowercase, hyphens | kebab-case ✓ |

## Summary

ECC is a **factory pattern implementation** that produces Claude Code-compliant artifacts. The standard defines the **output format** (`.claude/` file structure with SKILL.md, agents, commands, etc.), while ECC adds:

1. **Plugin** - grouping/packaging concept
2. **Zgent** - materialization/deployment tracking
3. **Embedded children** - phases, patterns, workflows, checklist items stored in JSON rather than separate files

The relationship is: **Agent Skills Standard** defines the *interface contract* (what Claude Code expects), while **ECC** implements a *schema-driven generator* that produces conforming artifacts with additional structure for maintainability.
