# Repository Inventory

**Generated:** 2026-02-06
**Locations scanned:** `/mnt/c/myStuff`, `/root/projects`, `github.com/justSteve`

## Summary

| Location | Count |
|----------|-------|
| /mnt/c/myStuff | 18 |
| /root/projects | 19 |
| GitHub justSteve | 32 |
| **Unique repos (estimated)** | ~35 |

---

## Cross-Location Analysis

### Repos in Multiple Locations (Same Remote)

| Repo Name | myStuff | root/projects | GitHub | Notes |
|-----------|---------|---------------|--------|-------|
| DataArchive | main/f79f03a | main/d212e0c, master/272fd15 | main | 3 local copies, diverged |
| myFireplace | master/6ce6947 | master/8ffb2b6 | master | Both local, root/projects ahead |
| agents | main/e684d6b | main/a638a97 | - | myStuff ahead |
| Steve-s_Sites | master/a49a709 | (as justSteve) master/2440b0b | master | Different local names, root ahead |
| claude-monitor | master/1e77a5f | - | master | myStuff only |
| ActionableLogLines | main/a8db214 | - | main | myStuff only |
| BitWarden | main/fc72733 | main/e8ef6e4 | main (private) | Different commits |
| ParseClipmate | master/09e9239 | - | master | myStuff only |
| IDEasPlatform | master/9e14b56 | (as ideasplatform) main/d432c6b | main | Different branches! |
| DReader | master/6fbcf1e | (as ScrapeDiscord) master/2ab3840 | master | ScrapeDiscord points to DReader remote |

### Critical Issues

1. **DataArchive has 3 copies** with divergent history - SOT determination required
2. **IDEasPlatform/ideasplatform** - Different branches (master vs main) and remotes
3. **ScrapeDiscord** points to DReader remote - likely a mistake
4. **Steve-s_Sites/justSteve** - Same repo, different local names

---

## Full Inventory by Location

### /mnt/c/myStuff

| Name | Remote | Branch | Last Commit | .claude | CLAUDE.md | Type | Pkg Mgr |
|------|--------|--------|-------------|---------|-----------|------|---------|
| myStuff | justSteve/myStuff | master | 2026-01-24 | Y | Y | node | no-lock |
| Bitwarden | justSteve/bitwarden | main | 2025-11-28 | Y | Y | python | requirements |
| Daemon | justSteve/Daemon | main | 2025-12-15 | N | Y | node | no-lock |
| DataArchive | justSteve/DataArchive | main | 2026-01-10 | Y | Y | node | npm |
| DReader | justSteve/DReader | master | 2026-01-18 | N | N | other | none |
| Fabric | justSteve/Fabric | main | 2025-12-20 | N | N | go | go-mod |
| IDEasPlatform | justSteve/IDEasPlatform | master | 2026-01-17 | Y | N | other | none |
| myDSPy | justSteve/dspy | main | 2025-11-01 | Y | Y | python | pyproject |
| myFireplace | justSteve/myFireplace | master | 2026-01-07 | Y | Y | other | none |
| ParseClipmate | justSteve/ParseClipmate | master | 2025-12-15 | Y | Y | python | requirements+venv |
| Steve-s_Sites | justSteve/Steve-s_Sites | master | 2026-01-24 | Y | Y | python+node | requirements+npm |
| Substrate | justSteve/Substrate | main | 2025-12-10 | N | Y | other | none |
| Telos | justSteve/Telos | main | 2025-11-09 | N | N | other | none |
| ActionableLogLines | justSteve/ActionableLogLines | main | 2026-01-05 | Y | Y | node | npm |
| agents | justSteve/agents | main | 2026-01-05 | Y | Y | other | none |
| beads | justSteve/beads | main | 2026-01-29 | Y | Y | go | go-mod |
| claude-monitor | justSteve/claude-monitor | master | 2026-01-27 | Y | Y | node | npm |
| Judge0 | justSteve/judge0 | master | 2026-01-07 | Y | Y | other | none |

### /root/projects

| Name | Remote | Branch | Last Commit | .claude | CLAUDE.md | Type | Pkg Mgr |
|------|--------|--------|-------------|---------|-----------|------|---------|
| voicemode | justSteve/voicemode | master | 2025-10-21 | Y | Y | python | pyproject |
| gastown | justSteve/gastown | main | 2026-02-06 | Y | N | go | go-mod |
| ScrapeDiscord | justSteve/DReader | master | 2026-01-14 | Y | Y | node | npm |
| data-archive | justSteve/DataArchive | main | 2025-11-29 | Y | Y | node | npm |
| buildDockers | justSteve/YOLODocker | master | 2025-10-24 | Y | Y | other | none |
| BankWebinars | justSteve/BankWebinars | master | 2018-12-06 | Y | Y | other | none |
| BitWarden | justSteve/BitWarden | main | 2025-10-29 | N | Y | python | requirements |
| Skill_Seekers | justSteve/Skill_Seekers | development | 2025-10-23 | Y | Y | python | requirements |
| myFireplace | justSteve/myFireplace | master | 2026-02-02 | Y | Y | other | none |
| agents | justSteve/agents | main | 2025-10-29 | Y | Y | other | none |
| dspy | justSteve/dspy | main | 2025-10-26 | Y | Y | python | pyproject+venv |
| gtOps | justSteve/GasTownOperations | master | 2026-02-06 | Y | N | other | none |
| ideasplatform | justSteve/ideasplatform | main | 2025-11-25 | N | N | node | npm |
| RAGinDSPY | justSteve/RAGinDSPY | master | 2025-10-29 | Y | Y | other | none |
| DataArchive | justSteve/DataArchive | master | 2025-10-29 | Y | Y | python | requirements+venv |
| justSteve | justSteve/Steve-s_Sites | master | 2026-01-25 | Y | Y | node | no-lock+venv |
| xstate-skill | justSteve/XState-Skill | main | 2025-10-29 | Y | Y | other | none |
| buildClaudeUI | justSteve/MyClaudeUI | main | 2025-10-29 | Y | Y | node | npm |
| myOrchestration | justSteve/myOrchestration | main | 2025-10-29 | Y | Y | other | none |

### GitHub-Only (not found locally)

| Name | Description | Default Branch | Last Push |
|------|-------------|----------------|-----------|
| wsl-4-claude | WSL config for Claude Code | main | 2025-10-12 |
| justSteveSite | - | main | 2024-04-03 |
| schwab-py-my | (private) | main | 2024-10-13 |
| ts-trades | - | main | 2025-06-12 |
| ts-py | (private) Library migration | main | 2025-03-02 |
| vuestic | - | main | 2024-04-03 |
| gt | - | main | 2026-01-14 |
| tradier_api | (private) | main | 2024-05-04 |
| paulaslifeisabook | - | main | 2025-11-18 |
| tradestation-py | - | main | 2024-12-14 |
| RudderPositionViaComputerVision | - | master | 2020-04-02 |
| SteerageForMyBoat | Hydraulic steering system | master | 2020-01-23 |

---

## Config Audit Summary

### Missing .claude Directory

| Location | Repo |
|----------|------|
| myStuff | Daemon, DReader, Fabric, Substrate, Telos |
| root/projects | BitWarden, ideasplatform |

### Missing CLAUDE.md

| Location | Repo |
|----------|------|
| myStuff | DReader, Fabric, IDEasPlatform, Telos |
| root/projects | gastown, gtOps, ideasplatform |

### Missing settings.json (has .claude but no settings)

Most repos - only these have complete .claude/settings.json:
- myStuff: Bitwarden, myDSPy, claude-monitor
- root/projects: voicemode, agents, RAGinDSPY, xstate-skill, buildClaudeUI, myOrchestration

---

## Structural Evaluation

### Python Projects

| Repo | Best Practices | Issues |
|------|----------------|--------|
| ParseClipmate | requirements.txt + venv | Good |
| myDSPy | pyproject.toml | Good (modern) |
| voicemode | pyproject.toml | Good (modern) |
| dspy | pyproject.toml + venv | Good |
| Bitwarden | requirements.txt | No venv |
| BitWarden | requirements.txt | No venv |
| Steve-s_Sites | requirements.txt | Mixed python+node |
| Skill_Seekers | requirements.txt | No venv |
| DataArchive (master) | requirements.txt + venv | Good |

### Node Projects

| Repo | Bun Migrated? | Issues |
|------|---------------|--------|
| myStuff | No (no lockfile) | Missing lockfile |
| Daemon | No (no lockfile) | Missing lockfile |
| DataArchive (myStuff) | No (npm) | - |
| ActionableLogLines | No (npm) | - |
| claude-monitor | No (npm) | - |
| ScrapeDiscord | No (npm) | Points to wrong remote |
| data-archive | No (npm) | - |
| buildClaudeUI | No (npm) | - |
| ideasplatform | No (npm) | Missing .claude |
| justSteve | No (no lockfile) | Missing lockfile |

**None have migrated to bun.**

### Go Projects

| Repo | Status |
|------|--------|
| Fabric | go.mod present, no .claude |
| beads | go.mod present, good |
| gastown | go.mod present, no CLAUDE.md |

---

## Recommendations

### Immediate Actions

1. **Resolve DataArchive divergence** - 3 copies with different history
2. **Fix ScrapeDiscord remote** - Points to DReader instead of DiscordScraper
3. **Standardize IDEasPlatform** - Different branches/remotes across locations
4. **Add CLAUDE.md to gtOps** - Operating repo should have documentation

### Config Improvements

1. Add `.claude` directory to: Daemon, DReader, Fabric, Substrate, Telos, BitWarden (root), ideasplatform
2. Add `CLAUDE.md` to: DReader, Fabric, IDEasPlatform, Telos, gastown, gtOps, ideasplatform
3. Add `settings.json` to repos with .claude but missing settings

### Structure Improvements

1. **Python repos**: Add venv to Bitwarden, BitWarden, Skill_Seekers
2. **Node repos**: Add lockfiles to myStuff, Daemon, justSteve (or migrate to bun)
3. **Consider bun migration** for active Node projects

---

## SOT Determination (Required Before Sync)

For repos with multiple copies, determine which is authoritative:

| Repo | Candidates | Suggested SOT |
|------|------------|---------------|
| DataArchive | myStuff (newest), root/data-archive, root/DataArchive | TBD - manual review |
| myFireplace | root/projects (newest) | root/projects |
| agents | myStuff (newest) | myStuff |
| Steve-s_Sites | root/justSteve (newest) | root/projects/justSteve |
| BitWarden | myStuff (newest) | myStuff/Bitwarden |
| IDEasPlatform | myStuff (newest) | TBD - branch mismatch |
