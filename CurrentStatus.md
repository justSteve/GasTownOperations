# GT Current Status

**Generated:** 2026-02-06 14:45

| Category | Status |
|----------|--------|
| GT Version | `v0.5.0-317-g2811f49c` |
| Upstream | Synced with steveyegge/gastown@2811f49c |
| Town State | **DOWN** |
| Doctor (last) | 62 passed, 3 warnings, 0 failed |
| Rigs | gtOps (1 rig) |

## Open Work

### Repo Inventory Task (Next Session)
Comprehensive catalog of git repos across 3 locations:

| Location | Access |
|----------|--------|
| `/mnt/c/myStuff` | WSL mount |
| `/root/projects` | Direct |
| `github.com/justSteve` | API |

**Per-repo data to collect:**
- Name, remote URL, current branch, last commit
- Sync status across locations (ahead/behind/diverged)
- Config audit: `.git` config, `.claude` files present?
- Structural evaluation:
  - Python: best practices (venv, pyproject.toml, structure)
  - Node: bun migration status
  - File structure quality (clean/messy)
- One-line objective description

**Output:** `docs/repo-inventory.md` + `docs/repo-inventory.csv`

**Constraint:** SOT determination required before any sync ops

## Known Issues

1. **Bead routing**: Fresh GT install has rig-level beads not visible from town root
2. **Formula paths**: mol-polecat-work not found during sling (path resolution issue)
3. **Migration pending**: Town + gtOps still on SQLite (Dolt migration available)

## Rig Creation Commands (Reference)

```bash
gt rig add DReader https://github.com/justSteve/DReader --prefix dr
gt rig add DataArchive git@github.com:justSteve/DataArchive.git --prefix da
gt rig add claude_monitor https://github.com/justSteve/claude-monitor.git --prefix claude-monitor
gt rig add gtOps git@github.com:justSteve/GasTownOperations.git --prefix gt
gt rig add parseClipmate git@github.com:justSteve/parseClipmate.git --prefix ParseClipmate
```
