# gtOps Glossary

Foundational terms for the Gas Town Operations ecosystem.

## Core Abstractions

### ECC (Everything Claude Code)

A TypeScript schema that abstracts Claude Code's agent system. ECC models the file-based configuration artifacts (skills, hooks, agents, etc.) as structured JSON data, enabling programmatic generation and management.

- **Source**: Abstraction of `affaan-m/everything-claude-code` patterns
- **Location**: `ECC/ecc-materializer/src/ecc-types.ts`
- **Relationship**: ECC defines *what* to generate; the materializer produces Claude Code-compliant files

### AOE (Agent Orchestration Engine)

Runtime engine for managing Claude Code entities. Provides logging, error handling, event system, and scene execution. The reusable foundation that Explorer, DReader, and future Zgents build upon.

- **Location**: `ECC/ecc-orchestrator/`
- **Key subsystems**: Logging (transports, formatters), Errors (hierarchy), Events (typed pub/sub)

### Zgent

A standalone Claude Code agent that has graduated from the Gas Town Academy. A well-formed Zgent:
- Publishes its API (other Zgents can query it)
- Follows shared conventions (logging, errors, events, config)
- Is independently deployable
- Has observable behavior (hooks, events, structured logs)

### CRUD Engine

The lifecycle manager for 2.1 artifacts. Handles initialization, versioning, hot-reloading, and deletion of Claude Code configuration files. The bedrock component that must be bulletproof before Zgents enter production.

- **Status**: Planned (not yet implemented)
- **Logging needs**: Verbose during testing, minimal in production

## Claude Code 2.1 Artifacts

The file types managed by the CRUD engine. These are what Claude Code reads at runtime.

| Artifact | File Location | ECC Type | 2.1 Additions |
|----------|---------------|----------|---------------|
| **Skill** | `.claude/skills/{name}/SKILL.md` | `EccSkill` | `hotReload`, `allowedTools`, `contextMode` |
| **Hook** | `.claude/settings.json` (hooks section) | `EccHook` | `exitCodeProtocol`, `stdinSchema`, `stdoutSchema`, `scopeLevel` |
| **SubAgent** | `.claude/agents/{name}.md` | `EccSubAgent` | NEW - policy islands with `contextMode: fork\|inline` |
| **Rule** | `.claude/rules/{name}.md` | `EccRule` | Always-active behavioral constraints |
| **Agent** | `.claude/agents/{name}.md` | `EccAgent` | Top-level agent definition |
| **Command** | `.claude/commands/{name}.md` | `EccCommand` | Slash command (`/name`) |
| **MCP Server** | `.claude.json` or `settings.json` | `EccMcpServer` | External tool integration |

### Hook Events (2.1)

| Event | Trigger |
|-------|---------|
| `PreToolUse` | Before tool execution |
| `PostToolUse` | After tool execution |
| `UserPromptSubmit` | User sends message |
| `SessionStart` | Session begins |
| `SessionEnd` | Session ends |
| `PreCompact` | Before context compaction |
| `Stop` | After each response |
| `Notification` | System notifications |

## Ecosystem Components

### Pattern Factory

Generates 2.1 artifacts from ECC data for target Zgents. Combines templates, context profiles, and enrichments to emit customized configurations.

- **Materializer**: `ECC/ecc-materializer/` - Current implementation
- **Future**: CRUD Engine integration for live updates

### Explorer Engine

Reference implementation demonstrating AOE capabilities. Loads scenes, generates configs, executes Claude Code, streams events.

- **Location**: `ECC/ecc-orchestrator/src/explorer/`
- **Purpose**: Sandbox for testing hook/skill interactions

### Context Profile

Translation layer that customizes ECC output for specific targets. Includes:
- Variable substitution (`{{VAR}}` → value)
- Enrichments (inject content into entities)
- Terminology mapping (generic → domain-specific)

## Operational Terms

### Gas Town Academy

The process by which an agent becomes a well-formed Zgent. Graduation criteria include:
- API publication
- Convention compliance
- Observable behavior
- Independent deployability

### Plugin (ECC)

A package grouping related artifacts. The root template from which Zgents are materialized.

### Take (Explorer)

A single execution run of a scene. Captures events, logs, and results for review.

## See Also

- [terminology-mapping-agent-skills-standard-ecc.md](../ECC/terminology-mapping-agent-skills-standard-ecc.md) - Anthropic → ECC mapping
- [CLAUDE.md](../CLAUDE.md) - COO role and development workflow
