# Anatomy of a Zgent

Conceptual walkthrough of what makes an autonomous agent well-formed in the Gas Town ecosystem.

## Viewing

```bash
# Open directly in browser
open presentations/zgent-anatomy/index.html

# Or serve locally for speaker notes
cd presentations/zgent-anatomy
python3 -m http.server 8080
# Then open http://localhost:8080
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrows / Space | Navigate slides |
| S | Speaker notes view |
| F | Fullscreen |
| O | Overview mode |
| B | Pause (black screen) |

## Slide Overview

| # | Title | Content |
|---|-------|---------|
| 1 | Title | "Anatomy of a Zgent" -- What Makes an Autonomous Agent Well-Formed |
| 2 | The Question | What does it take for 20-30 agents to work together reliably? |
| 3 | What Is a Zgent? | The 4 graduation properties from the Gas Town Academy |
| 4 | The Artifact Layer | 7 Claude Code 2.1 artifacts as the Zgent's "skeleton" |
| 5 | CrudEngine | Lifecycle management as the "nervous system" |
| 6 | AOE | Logging, errors, events as the Zgent's "senses" |
| 7 | Publishing the API | How Zgents tell others what they can do -- the "voice" |
| 8 | tmuxMOO | Persistent text environments as the Zgent's "habitat" |
| 9 | 30 Years in the Making | MOO (1995) to Zgent (2026) evolution |
| 10 | A Day in the Life | Conceptual walkthrough from startup to collaboration |
| 11 | The Gas Town Academy | Raw agent vs. graduated Zgent comparison |
| 12 | What Exists Today | Current status of all subsystems |
| 13 | The Horizon: DReader | First Zgent graduation candidate |
| 14 | The Complete Organism | Summary of all anatomical layers |
| 15 | Questions | Closing slide with key takeaways |

## Narrative Arc

The presentation uses an anatomical metaphor throughout:

- **Skeleton** -- ECC schema and 7 artifact types (structure)
- **Nervous System** -- CrudEngine lifecycle management (metabolism)
- **Senses** -- AOE logging, errors, events (perception)
- **Voice** -- Published API and inter-agent protocol (communication)
- **Habitat** -- tmuxMOO persistent text environments (environment)

The deeper insight: a Zgent is a complete organism, not just "a Claude Code agent with some config files." The MOO lineage from 1995 maps 1:1 to the current architecture.

## Source Material

- `CLAUDE.md` -- Zgent definition, COO role, subsystems
- `docs/GLOSSARY.md` -- Formal definitions of all terms
- `BRIEFING.md` -- MOO evolution concepts, tmux as modern MOO transport
- `tmuxMOO/` -- Habitat implementation and topology design
- `presentations/crudengine-exec-walkthrough/` -- Template and style reference

## Bead Reference

Part of the Gas Town presentation standard defined in `tmuxMOO/ZGENT-PRESENTATION-STANDARD.md`.
