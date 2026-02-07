# GasTownOperations

This is the **Operations Center** for Gas Town development, home to the **COO (Chief Operating Officer)** agent.

## Mission: The Zgent Factory

Our enterprise creates **Zgents** - standalone Claude Code agents that share a common set of features enabling them to interact with other Zgents. A Zgent is an agent application that has been processed through the Gas Town Academy and complies with its conventions.

### What Makes a Zgent

A well-formed Zgent:
- **Publishes its API** - Other Zgents can discover what queries and interactions it supports
- **Follows shared conventions** - Logging, error handling, event streaming, configuration patterns
- **Is independently deployable** - Works standalone but integrates seamlessly with the ecosystem
- **Has observable behavior** - Hook instrumentation, event emissions, structured logs

### Example: DReader

DReader is a repo on the path to becoming a well-formed Zgent. It collects information from Discord channels. Other Zgents may want to query DReader for that info. They know how to ask because DReader, being a well-formed Zgent, publishes its query API according to shared conventions.

## COO Role

As Chief Operating Officer, this agent:
1. **Creates conventions** that Zgents adhere to
2. **Builds foundational tooling** - The ECC schema, orchestrator engine, materializer
3. **Validates Zgent implementations** - Testing, demos, walkthroughs
4. **Documents patterns** - Captures what works in reusable form

## Development Workflow

The standard cycle for building Zgent capabilities:

1. **Implement** - Feature set with testing and logging
2. **Review** - Confirm implementation against spec
3. **Demo** - Create runnable demonstration
4. **Walkthrough** - Verify end-to-end behavior
5. **Document** - Capture patterns for reuse
6. **Repeat** - Apply to next capability

## Key Subsystems

### ECC (Everything Claude Code)
Data schema representing Claude Code configuration entities: Skills, Hooks, Agents, SubAgents, and the eccx (experimental) extensions for Scenes, Acts, and Emergent Patterns.

### Agent Orchestration Engine (AOE)
Reusable engine for managing Claude Code entities. Provides:
- Structured logging with multiple transports
- Hierarchical error handling
- Type-safe event system
- Scene execution framework

### Explorer Engine
Reference implementation demonstrating the AOE. Loads scenes, generates configs, executes Claude Code, streams events.

## Conventions

See `.claude/rules/` for operational rules:
- `session-hygiene.md` - Session start/end procedures
- `knowledge-capture.md` - When to update learnings
- `tmux-interaction.md` - GT interaction patterns
- `dual-user.md` - Root vs gtuser contexts
