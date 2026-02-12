# The Infrastructure Stack

A reveal.js presentation explaining how ECC, AOE, CrudEngine, and Explorer compose into a coherent infrastructure stack for managing Gas Town agent configurations at scale.

## Audience

Technical-executive: people who need to understand the architecture without reading code.

## Running the Presentation

Open `index.html` in a browser. The presentation uses CDN-hosted dependencies (reveal.js 4.6.1, Mermaid.js 10) and requires an internet connection on first load.

```bash
# From the presentation directory
open index.html
# or
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Slide Overview

| # | Title | Key Point |
|---|-------|-----------|
| 1 | Title | "How Gas Town Agents Get Their Plumbing" |
| 2 | The Problem | Manual config, no visibility, no consistency, no audit trail |
| 3 | The Stack | 4-layer diagram: ECC, AOE, CrudEngine, Explorer (Mermaid) |
| 4 | Layer 1: ECC | Data model, 7 artifact types, ecc/eccx namespace split |
| 5 | Layer 2: AOE | Multi-transport logging, structured error hierarchy |
| 6 | AOE Events | 13 typed event types, type-safe pub/sub (Mermaid) |
| 7 | Layer 3: CrudEngine | Persistence with traffic logging and versioning (Mermaid) |
| 8 | CrudEngine Internals | 7 handlers, 5 operations, typed convenience methods |
| 9 | Layer 4: Explorer | Scene loading, config generation, CLI execution (Mermaid) |
| 10 | Observability First | Each layer adds a different kind of visibility |
| 11 | The Composition | Package dependency graph, loose coupling (Mermaid) |
| 12 | In Practice | Sequence diagram: "Create a Skill" through all layers (Mermaid) |
| 13 | The Numbers | 293+ tests, 3 packages, 7 types, 10,305 lines |
| 14 | Integration Points | DReader, Strades, future Zgents (Mermaid) |
| 15 | What's Next | gt-crud.6, gt-fc5, production deployment roadmap |
| 16 | Close | Summary + questions |

## Key Insight

The infrastructure stack is not four separate tools bolted together. It is a coherent system designed around a single principle: **observability at every layer**. ECC makes artifacts visible as data. AOE makes runtime behavior visible as logs and events. CrudEngine makes mutations visible as traffic. Explorer makes the whole pipeline visible as scene executions.

## Technical Details

- **reveal.js**: 4.6.1 via CDN
- **Mermaid.js**: v10 via CDN, dark theme
- **Diagrams**: 6 Mermaid diagrams (stack overview, event system, CrudEngine flow, Explorer pipeline, package dependencies, integration points, sequence diagram)
- **Theme**: Dark (#1a1a2e background), cyan headings (#00d4ff)
- **Transitions**: fade
- **Speaker notes**: Every slide includes notes explaining architectural rationale

## Source Material

The presentation synthesizes from:
- `ECC/ecc-materializer/src/ecc-types.ts` - ECC type definitions
- `ECC/ecc-orchestrator/src/logging/` - AOE logging subsystem
- `ECC/ecc-orchestrator/src/errors/error-types.ts` - Error hierarchy
- `ECC/ecc-orchestrator/src/events/event-types.ts` - Event system
- `ECC/ecc-orchestrator/src/explorer/` - Explorer components
- `ECC/ecc-crud/src/core/crud-engine.ts` - CrudEngine implementation
- `ECC/ecc-crud/src/logging/traffic-logger.ts` - Traffic logging
- `ECC/ecc-crud/src/types/operation-types.ts` - Operation type system
- `ECC/ecc-crud/src/artifacts/` - Artifact handlers
