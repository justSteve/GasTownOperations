# Agent Performance Summary (Post-Update Sessions)

Generated: 2026-01-22 07:15 CST

## Session Overview

| Session | Agent | Outcome | Manual Intervention Required |
|---------|-------|---------|------------------------------|
| Run 10 | Polecat (obsidian) | Partial | Yes - formula copy, git auth |
| Run 11 | Polecat (quartz) | Success | Yes - remote URL fix mid-run |
| Run 11 | Refinery | Success | No |
| Run 12 | Polecat (furiosa) | **Failed** | Yes - manual MR submit |
| Run 12 | Refinery | Success | No |
| Mayor Session | Mayor | Success | No |
| Mayor Session | Witnesses (2) | Success | No |

---

## Failure Instances by Category

### 1. Prefix Validation Bug (Persists from pre-update)

| Session | Agent | Error |
|---------|-------|-------|
| Run 10 | gt sling | `dr-DReader-polecat-obsidian does not match configured prefix 'hq'` |
| Run 11 | gt sling | Same warning (continued anyway) |
| Run 12 | gt rig add | `da-DataArchive-witness does not match configured prefix 'hq'` |
| Run 12 | gt sling | `da-DataArchive-polecat-furiosa does not match configured prefix 'hq'` |

**Total: 4 instances**

### 2. Formula Path Resolution Bug (Partially fixed)

| Session | Agent | Issue |
|---------|-------|-------|
| Run 10 | gt sling | GT_ROOT not set for `bd cook` step |
| Run 12 | gt sling | Same - required copy to `<rig>/.beads/formulas/` |

**Total: 2 instances** (workaround applied)

### 3. Polecat Incomplete Execution

| Session | Agent | Issue |
|---------|-------|-------|
| Run 12 | furiosa | Session ended without running `gt done` or submitting MR |

**Total: 1 instance** - required manual `gt mq submit`

### 4. Git Remote URL Inheritance

| Session | Agent | Issue |
|---------|-------|-------|
| Run 11 | quartz | Worktree still had HTTPS after rig remote changed to SSH |

**Total: 1 instance** - fixed by updating remote mid-session

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total agent sessions | 7 |
| Sessions requiring manual intervention | 4 (57%) |
| Sessions completing autonomously | 3 (43%) |
| Prefix validation failures | 4 |
| Formula path failures | 2 |
| Polecat incomplete exits | 1 |
| Remote URL inheritance issues | 1 |

## Agents Working As Intended

- **Mayor**: Received requests, reviewed code, created issues, verified Windows compat, sent report ✅
- **DReader Witness**: Monitoring and escalation working ✅
- **DataArchive Witness**: Monitoring working ✅
- **DReader Refinery**: Processed MR, merged, pushed ✅
- **DataArchive Refinery**: Processed MR, merged, pushed ✅

## Root Cause Analysis

### Still broken in GT code:
1. Prefix detection - `bd create` from rig directories still defaults to `hq-`
2. GT_ROOT not set for `bd cook` step (only set for wisp step)

### Workarounds in place:
1. Use `--rig <name>` flag when creating beads
2. Copy formula to `<rig>/.beads/formulas/`
3. Ensure polecat worktrees use SSH URLs

---

## Recommendations for Upstream

### Priority 1: Fix prefix detection
- `gt sling` should pass `--rig <rigname>` to bd commands
- Or `bd` should resolve prefix from `.beads/config.yaml` in working directory

### Priority 2: Fix GT_ROOT for cook step
- In `sling_helpers.go` line 489, `cookCmd` needs GT_ROOT env var
- Currently only `wispCmd` (line 506) gets GT_ROOT

### Priority 3: Worktree remote inheritance
- When rig remote URL changes, existing polecat worktrees should update
- Or document that polecats need nuking after remote URL change
