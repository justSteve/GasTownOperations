# GT Current Status

**Generated:** 2026-01-22 12:13 UTC

| Category | Status |
|----------|--------|
| GT Version | unchanged (b158ff27) |
| Commits Pulled | none (already up to date) |
| Doctor Passed | 52 |
| Doctor Warnings | 4 (patrol-molecules-exist, patrol-not-stuck, misclassified-wisps, clone-divergence) |
| Doctor Failed | 2 (agent-beads-exist, priming) |
| Manual Fixes Attempted | shell install ✅, clone pull ✅, wisp release ✅, agent beads ❌ |
| Remaining Issues | See below |

## Services Running

| Service | Session | Status |
|---------|---------|--------|
| Daemon | PID 11575 | ✅ Running |
| Mayor | hq-mayor | ✅ Running (detached) |
| Deacon | hq-deacon | ✅ Running |
| DReader Witness | gt-DReader-witness | ✅ Running |
| DReader Refinery | gt-DReader-refinery | ✅ Running |
| DataArchive Witness | gt-DataArchive-witness | ✅ Running |
| DataArchive Refinery | gt-DataArchive-refinery | ✅ Running |
| claude_monitor Witness | gt-claude_monitor-witness | ✅ Running |
| claude_monitor Refinery | gt-claude_monitor-refinery | ✅ Running |

## Issues Requiring Human Attention

1. **agent-beads-exist** (FAILED)
   - 2 DataArchive agent beads cannot be created
   - Error: "invalid issue type: agent" and "database is locked"
   - May require beads update or manual intervention

2. **priming** (FAILED)
   - DataArchive AGENTS.md has 40 lines (should be <20)
   - Requires manual edit to reduce to bootstrap pointer

3. **patrol-molecules-exist** (WARNING)
   - 3 rigs missing patrol formulas
   - Formulas needed: mol-deacon-patrol, mol-witness-patrol, mol-refinery-patrol

4. **misclassified-wisps** (WARNING)
   - 6 issues should be marked as wisps (DReader: 3, claude_monitor: 3)
   - `gt doctor --fix` should handle but may need manual review
