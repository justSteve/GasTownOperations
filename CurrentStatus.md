# GT Current Status

**Generated:** 2026-01-28 14:26

| Category | Status |
|----------|--------|
| GT Version | `v0.5.0-86-gb49f08f7` (67 new commits) |
| Upstream | Synced with steveyegge/gastown@b49f08f7 |
| Doctor Passed | 55 |
| Doctor Warnings | 1 (patrol-not-stuck - false positive, wisp is closed) |
| Doctor Failed | 1 (agent-beads-exist - prefix mismatch, known upstream issue) |

## This Session

| Action | Result |
|--------|--------|
| Upstream sync | 67 commits pulled (be96bb00 → b49f08f7) |
| Build method | `make build` (new `go build` guard added) |
| Stuck wisp | Closed ParseClipmate-wisp-qdn |
| Services | All 9 started (mayor + 4 witnesses + 4 refineries) |

## Notable Changes in Update

- **SQLite removal**: Scorched-earth removal from codebase
- **Dolt integration**: `gt dolt` command for server management
- **KRC (Key Record Chronicle)**: TTL-based ephemeral data lifecycle
- **Web dashboard**: Comprehensive control panel with 13 data panels
- **Dark mode CLI**: Theme support added
- **Build guard**: `go build` directly now blocked, requires `make build`

## Known Issues (Upstream)

1. **agent-beads-exist**: `hq-deacon` and `hq-mayor` beads can't be created - prefix mismatch (`hq-` vs configured `gt-`). GT functions without them.

2. **patrol-not-stuck false positive**: Doctor reports closed wisps as "stuck" - doesn't filter by status.

## Services Running

| Service | Session | Status |
|---------|---------|--------|
| Mayor | hq-mayor | Running |
| Witness (DReader) | gt-DReader-witness | Running |
| Witness (DataArchive) | gt-DataArchive-witness | Running |
| Witness (claude_monitor) | gt-claude_monitor-witness | Running |
| Witness (parseClipmate) | gt-parseClipmate-witness | Running |
| Refinery (DReader) | gt-DReader-refinery | Running |
| Refinery (DataArchive) | gt-DataArchive-refinery | Running |
| Refinery (claude_monitor) | gt-claude_monitor-refinery | Running |
| Refinery (parseClipmate) | gt-parseClipmate-refinery | Running |
