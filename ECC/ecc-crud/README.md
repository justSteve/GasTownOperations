# @ecc/crud

CRUD operations for ECC (Everything Claude Code) entities.

## Purpose

Provides Create, Read, Update, Delete operations for Claude Code configuration entities:

- **Skills** - Reusable agent capabilities
- **Hooks** - Event-driven automation
- **Agents** - Top-level agent configurations
- **Sub-agents** - Nested agent definitions

## Features

- Type-safe CRUD operations for all entity types
- Traffic logging for observability
- Integration with @ecc/orchestrator logging subsystem
- Dry-run mode for validation

## Installation

```bash
bun add @ecc/crud
```

## Usage

```typescript
import { /* operations */ } from '@ecc/crud';

// Implementation pending
```

## Development

```bash
# Install dependencies
bun install

# Type check
bun run typecheck

# Run tests
bun test

# Build
bun run build
```

## Related Packages

- `@ecc/orchestrator` - Agent orchestration engine (logging, events, errors)
- `@ecc/materializer` - Config file generation
