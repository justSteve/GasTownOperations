# GT Exploration Log - 2026-01-21

## Run 1: DReader Baseline
Started: Wed Jan 21 02:34:41 PM CST 2026

### Observation 1: Agent Bead Prefix Mismatch
**Expected**: Agent beads created with rig prefix (dr-)
**Observed**: Error - "issue ID 'dr-DReader-crew-coo' does not match configured prefix 'hq'"
**Learning**: Town-level beads (hq-) vs rig-level beads (dr-) routing issue. Agent beads try to use rig prefix but beads config expects hq- at town level.

### Observation 2: Beads Created at Town Level from Crew
**Expected**: Beads in crew workspace might use rig prefix (dr-)
**Observed**: Created with hq- prefix (hq-778, hq-f98)
**Learning**: Crew workspaces route beads to town-level by default. This may be intentional for cross-rig visibility, but could complicate rig-specific work tracking.

### Observation 3: Routing Confusion
**Issue**: bd dep add hq-f98.2 hq-f98.1 failed - "no issue found"
**But**: bd list shows dr- prefix beads, not hq- ones
**Learning**: Crew workspace routes to different prefix than expected. Beads created show hq- but queries resolve to dr-. Routing layer needs investigation.

---
## Pivoting: Direct sling test

### Observation 4: Formula Path Error
**Error**: `mol-polecat-work` looked for in `DReader/mayor/rig/` but formulas are in `.beads/formulas/`
**Impact**: Polecat spawns but without workflow molecule attached
**Learning**: Formula resolution path mismatch between rig and town-level storage

### Observation 5: Polecat Running
- Spawned: obsidian
- Convoy: hq-cv-umc34
- Status: Working (Schlepping)

### Observation 6: Dependency Chain Broken
**Context**: Slung dr-145.2 (Wave 2) which depends on dr-145.1 (never completed)
**Observed**: Polecat can't find test-wave-file.txt - it doesn't exist in worktree
**Learning**: Slinging a blocked task still works, but polecat can't complete work that depends on uncommitted changes from prior wave. The dependency system allows slinging blocked tasks - no guard rail.

---
## Quick iteration: Simple standalone task

### Observation 7: Simple Task Completed But Not Closed
**Task**: dr-qqa3 - Create hello.txt with Hello World
**Observed**: Polecat created file successfully, said "Done" but did NOT run `gt done`
**Learning**: Without mol-polecat-work formula attached, polecat doesn't know the completion protocol. It treats tasks as "done" conversationally but doesn't close the bead or submit to refinery.

### Key Finding: Formula Attachment is Critical
The mol-polecat-work formula contains the workflow knowledge (commit, push, gt done). Without it, polecats complete work but don't follow GT protocol.

### Observation 8: Formula Path Resolution Bug
**Formula exists**: /home/gtuser/gt/.beads/formulas/mol-polecat-work.formula.toml
**But gt sling looks in**: /home/gtuser/gt/DReader/mayor/rig/mol-polecat-work
**Root cause**: Path resolution looking in rig mayor clone instead of town-level .beads/formulas/
**Impact**: ALL polecats spawned in this setup lack workflow knowledge

### Investigation: Check formula resolution code path

### ROOT CAUSE FOUND: Formula Path Resolution Bug

**Test:**
- `cd /home/gtuser/gt && bd cook mol-polecat-work` → SUCCESS
- `cd /home/gtuser/gt/DReader && bd cook mol-polecat-work` → FAIL

**Root cause:** `bd cook` from rig directory doesn't look up to town-level `.beads/formulas/`

**Impact:** `gt sling` runs `bd cook` from rigDir (per sling_helpers.go), so ALL polecat spawns fail to get workflow molecule

**Workaround candidates:**
1. Run bd cook from town root first
2. Copy formulas to rig level
3. Fix bd cook to search parent directories

---
## Testing workaround: Pre-cook formula from town root

### Observation 9: Pre-cooking Doesn't Help
Pre-cooking at town level doesn't help because `gt sling` runs its own `bd cook` from rigDir.

**Workaround attempt 2:** Copy/symlink formulas to rig level

### WORKAROUND FOUND: Copy formula to mayor/rig/.beads/formulas/
`gt sling` runs `bd cook` from `<rig>/mayor/rig/` directory, so formulas must be present there.

**Fixed by:**
```bash
mkdir -p DReader/mayor/rig/.beads/formulas
cp .beads/formulas/mol-polecat-work.formula.toml DReader/mayor/rig/.beads/formulas/
```

Now testing if polecat gets molecule attached...

### Observation 10: Error Chain - Agent Bead → Molecule Attachment
**Error 1**: Agent bead creation fails - prefix mismatch (dr- vs hq-)
**Error 2**: Molecule attachment fails - agent bead doesn't exist

These are linked: can't attach molecule to non-existent agent bead.

**Root issue**: Agent beads use rig prefix (dr-) but town beads expect hq-

---
## Testing: Does polecat still work despite missing molecule?

### Observation 11: Polecat Works But Doesn't Follow Protocol
Same as before - polecat completes task conversationally but no gt done.
Without molecule, no workflow knowledge.

---
## Run 1 Summary

### Issues Found:
1. **Agent bead prefix mismatch** - Agent beads try dr- prefix but town expects hq-
2. **Formula path resolution** - Formulas must be in mayor/rig/.beads/formulas/
3. **Molecule attachment cascade failure** - No agent bead → no molecule attachment
4. **Beads routing confusion** - Crew workspace routes to hq- prefix unexpectedly

### Impact:
- Polecats spawn and can do work
- But they don't follow GT protocol (commit, push, gt done)
- Work completes "conversationally" but beads stay HOOKED, not closed
- Refinery never gets MRs

### Key Learning:
The prefix routing between town-level (hq-) and rig-level (dr-) beads is misconfigured for this setup. Agent beads need to be created with the correct prefix.

---
## Run 2: Investigate prefix routing

### Deep Dive: Prefix Detection Bug

**Evidence:**
- Database config shows `issue_prefix|dr`
- Database issues have `dr-` prefix
- But `bd create` says "database uses 'hq'"

**Hypothesis:** bd prefix detection is looking somewhere other than the database config table. Possibly:
- Checking the first issue in the database
- Using routing to determine prefix
- Bug in prefix detection code

**Workaround to try:** Use --force flag to override prefix validation

---
## Attempting --force workaround

### ROOT CAUSE IDENTIFIED: Prefix Detection from Working Directory

**Discovery:**
- `bd create` from `mayor/rig/` with auto-ID creates `hq-xxx` not `dr-xxx`
- This means bd thinks the current working database has prefix 'hq'
- Even though `config` table shows `issue_prefix=dr`
- And `routes.jsonl` routes `dr-` to this location

**Behavior:**
- Reading (bd show dr-xxx) works via routing
- Writing new beads uses working directory prefix (hq-)
- This creates a mismatch for agent beads which need dr- prefix

**This explains the cascade failure:**
1. gt sling runs in rig context
2. Tries to create agent bead with dr-DReader-polecat-xxx
3. bd validates against working dir prefix (hq-)
4. Validation fails -> no agent bead -> no molecule attachment

---
## Run 2 Complete - Moving to Run 3: Try fresh rig

### CRITICAL FINDING: Route Overwrite Bug

**Discovery:**
- Adding testrig with prefix 'dr' OVERWROTE the DReader route
- Routes only stores one path per prefix
- DReader's beads (dr-145, etc.) are now orphaned!

**Impact:**
- All DReader beads now inaccessible via routing
- This is destructive - existing work is lost from routing perspective

**This is a significant bug in gt rig add**

---
## Attempting recovery

### Recovery Complete

- Manually fixed routes.jsonl to point dr- back to DReader/mayor/rig
- DReader beads accessible again
- Deleted testrig directory

### BUG FILED: Route Overwrite on Shared Prefix

**Symptom:** Adding a new rig that clones a repo with existing beads overwrites the route for that prefix, orphaning the previous rig's beads.

**Expected:** Either prevent prefix collision or maintain multiple routes.

**Workaround:** Manual route editing after rig operations.

---
## Creating fresh rig with UNIQUE prefix

### KEY DISCOVERY: --rig Flag Required for Correct Prefix

**Test:**
- `cd wavetest && bd create` → creates hq- prefix (WRONG)
- `bd create --rig wavetest` → creates wt- prefix (CORRECT)

**Root cause:** 
- bd uses working directory to determine prefix
- Working directory resolves to town-level (hq-) somehow
- `--rig` flag overrides this and uses correct rig prefix

**Bug in gt sling:**
- Does not pass --rig flag when creating agent beads
- Agent beads fail prefix validation

**Fix needed:**
- gt sling should use `--rig <rigname>` when running bd commands
- Or bd should properly resolve prefix from .beads/config.yaml in working dir

---
## Run 3: Fresh Rig (wavetest) with Unique Prefix

Started: Wed Jan 21 02:55 PM CST 2026

### Observation 12: Polecat Completes Work But No Protocol
**Task**: wt-xwt "Rig flag test"
**Observed**:
- Polecat spawned successfully (obsidian)
- Interpreted task literally - tested `gt rig config` flags
- Set dnd=true in wisp layer, verified layer precedence
- Polecat shows "done" status in `gt polecat list`
- BUT bead is still HOOKED, not closed

**Learning**: Same pattern as before - without mol-polecat-work formula attached, polecats don't know to run `gt done`. They complete work conversationally but leave beads hanging.

### Observation 13: Same Root Cause, Different Rig
**Expected**: Fresh rig might work better
**Observed**: Same issues:
1. Agent bead creation warned (prefix mismatch)
2. Formula not attached (path resolution)
3. Polecat didn't follow GT protocol

**Learning**: The bugs are systemic, not rig-specific. Need code fixes, not setup changes.

### Run 3 Summary
Fresh rig doesn't help. The issues are:
1. `gt sling` doesn't pass `--rig` flag to bd commands
2. `bd cook` doesn't search parent directories for formulas
3. These combine to leave polecats "dumb" - they do work but don't close loops

---
## Run 3 Complete - Moving to Run 4: Test with manual formula copy

**Hypothesis**: If we copy mol-polecat-work.formula.toml to rig/.beads/formulas/, will polecat follow protocol?

---
## Run 4: Protocol Test with Explicit Instructions

Started: Wed Jan 21 03:01 PM CST 2026

### Observation 14: Polecats CAN Follow Protocol from Task Title
**Task**: wt-91f "Protocol test: create README and follow gt done"
**Observed**:
- Polecat understood "follow gt done" from title
- Created README, committed locally
- Actually ran `gt done`!

**Learning**: Polecats don't NEED the molecule if instructions are explicit. The molecule provides workflow knowledge, but explicit task descriptions can substitute.

### Observation 15: Git Push Auth Failure
**Error**: `fatal: could not read Username for 'https://github.com': No such device or address`
**Root cause**: Rigs cloned via HTTPS, gtuser has no git credentials
**Impact**: Even when polecat runs `gt done`, push fails → bead stays HOOKED

**Learning**: This is a setup issue independent of the bead/formula bugs. Need either:
1. SSH URLs for remotes
2. Git credential helper for gtuser
3. gh CLI auth for gtuser

### Run 4 Summary
**Major finding**: The molecule attachment isn't strictly required - explicit task instructions work.
**New blocker identified**: Git auth prevents polecats from completing the gt done flow.

---
## Run 4 Complete - Moving to Run 5

**Next**: Try DReader rig (different repo) or fix git auth issue.

---
## Run 5: Local-Only Testing with DEFERRED

Started: Wed Jan 21 03:27 PM CST 2026

### Observation 16: DEFERRED Works for Local Testing
**Task**: wt-9q2 "Local test: create file, commit, run gt done --status DEFERRED"
**Observed**:
- Polecat created file, ran git status
- Committed changes locally
- Ran `gt done --status DEFERRED`
- Sent POLECAT_DONE notification to witness
- Session exited cleanly

**Key insight**: DEFERRED doesn't require push - it's designed for "pause" scenarios.

### Observation 17: DEFERRED Leaves Bead Open (Intentional)
**Bead status**: Still HOOKED after DEFERRED exit
**This is correct behavior**: DEFERRED = "paused, not completed"
- Work can be resumed later
- Different from COMPLETED which requires MR submission

### Observation 18: Witness Received Notification
**Mail**: hq-4v5l from wavetest/obsidian
**Content**:
```
Exit: DEFERRED
Issue: wt-9q2
Branch: polecat/obsidian/wt-9q2@mkojaquz
```
**Learning**: The gt done → witness notification flow works even without push.

### Run 5 Summary
**Success**: Found a local-only test pattern using DEFERRED status.
**Insight**: For exploration without git push, use explicit DEFERRED instructions.

---
## Run 5 Complete - Moving to Run 6

**Next**: Test actual work completion scenario - does witness act on DEFERRED?

---
## Run 6: Multi-Agent Dynamics Observation

Started: Wed Jan 21 03:29 PM CST 2026

### Observation 19: Witness Detects Pattern and Escalates
**Trigger**: Two DEFERRED exits in a row (wt-91f, wt-9q2)
**Witness action**:
- Checked polecat worktree
- Found "no commits" (worktree was nuked after first run)
- Filed escalation: "ESCALATION: Repeated incomplete polecat exits"
- Sent detailed report to Mayor

**Learning**: Witness performs post-exit verification and escalates patterns.

### Observation 20: Mayor Corrects Witness Diagnosis
**Mayor's analysis**:
- Reviewed escalation
- Determined witness was wrong: "Work IS being committed properly"
- Identified actual root cause: "all failures are push failures"
- Proposed fix: `gh auth login`

**Mayor's summary table**:
| Issue | Reality |
|-------|---------|
| Zombie processes | 5 stale processes |
| Git auth | ROOT CAUSE |
| Witness accuracy | Reporting false negatives |

**Learning**: Mayor provides meta-oversight, can correct agent misdiagnoses.

### Observation 21: Multi-Agent Communication Working
**Flow observed**:
1. Polecat → Witness: POLECAT_DONE notification
2. Witness → Mayor: ESCALATION when pattern detected
3. Mayor: Root cause analysis and correction

**Learning**: The GT agent ecosystem has working escalation paths.

### Run 6 Summary
**Major insight**: Multi-agent oversight is operational:
- Witness monitors and escalates
- Mayor analyzes and corrects
- Communication via gt mail works

---
## Run 7: DReader Rig Test

Started: Wed Jan 21 03:31 PM CST 2026

### Observation 22: Prefix Bug Confirmed Across Rigs
**From DReader/mayor/rig directory**:
- `bd create` without flag → hq-cec (WRONG)
- `bd create --rig DReader` → dr-xcv (CORRECT)

**Learning**: Prefix detection bug is systemic, not rig-specific.

### Observation 23: JSONL Hash Mismatch Warning
**New warning during sling**: "JSONL file hash mismatch detected"
**Action taken**: "Clearing export_hashes to force full re-export"
**Learning**: GT has integrity checking for JSONL databases.

### Observation 24: DReader DEFERRED Works Same as wavetest
**Task**: dr-xcv "DReader test with flag: gt done --status DEFERRED"
**Result**:
- Polecat jasper spawned
- Explored codebase
- Ran gt done --status DEFERRED
- Sent POLECAT_DONE to witness
- Bead stays HOOKED (expected)

**Learning**: DEFERRED behavior consistent across rigs.

### Run 7 Summary
**Confirmed**: Same bugs, same patterns across different rigs.
- Prefix detection always defaults to hq-
- Agent bead creation always fails same way
- DEFERRED works for local testing

---
## Run 8: Wave Dependency Test

Started: Wed Jan 21 03:35 PM CST 2026

### Observation 25: Can Sling Blocked Tasks - No Guardrail
**Setup**:
- wt-kn6: Epic "Wave test: Task A blocks Task B"
- wt-d18: Wave 1 (blocks wt-5nq)
- wt-5nq: Wave 2 (depends on wt-d18)

**Test**:
- Slung wt-d18 (Wave 1) → obsidian spawned
- Immediately slung wt-5nq (Wave 2) → quartz spawned

**Expected**: "Cannot sling blocked task" error
**Actual**: Both polecats spawned in parallel!

**Learning**: `gt sling` does NOT check dependency status. Blocked tasks can be slung freely.

### Observation 26: Parallel Execution of Dependent Tasks
**Wave 1** (obsidian): Create VERSION=1 file
**Wave 2** (quartz): Verify VERSION=1 exists

Both ran simultaneously. Wave 2 could not see Wave 1's uncommitted work.

**This confirms the original bug hypothesis**:
- Dependencies are stored but NOT enforced at sling time
- Polecats can run blocked tasks
- Without push/merge, dependent tasks see stale state

### Observation 27: Both Exited DEFERRED (As Instructed)
- obsidian: DEFERRED with branch polecat/obsidian/wt-d18@...
- quartz: DEFERRED with branch polecat/quartz/wt-5nq@...

**Learning**: Task instructions override dependency logic. Polecats follow explicit directions even when dependency chain is broken.

### Run 8 Summary
**MAJOR BUG CONFIRMED**:
1. `gt sling` has no dependency check
2. Blocked tasks can be dispatched
3. Wave ordering relies on external enforcement (witness? mayor?)
4. Without enforcement, dependent tasks run on stale state

**This is the bug from the original gt-zlr bead.**

---
## Run 9: Summary and Enforcement Analysis

Started: Wed Jan 21 03:40 PM CST 2026

### Observation 28: Witness Detection is Reactive
**Witness behavior**:
- Detected dependency chain failure AFTER both polecats exited
- Created escalation table showing cascade
- Escalated to Mayor

**Learning**: Witness is a post-hoc monitor, NOT a gate. It catches problems after they occur.

### Observation 29: Mayor Analysis
**Mayor found**:
- VERSION file DOES exist (at `/home/gtuser/gt/wavetest/polecats/obsidian/wavetest/VERSION`)
- But uncommitted - polecats bail early when push fails
- Root cause: git auth

**Mayor's diagnosis**:
- Polecats detect push will fail → exit before full commit
- Fix remains: `gh auth login`

**Learning**: Even the Mayor doesn't prevent blocked tasks from slinging. It analyzes failures after the fact.

### Observation 30: No Preventive Enforcement Found
**Searched for enforcement at**:
1. `gt sling` - NO check for blocked status
2. Witness - reactive, not preventive
3. Mayor - analyzes escalations, doesn't gate dispatches

**Conclusion**: Wave ordering must be enforced by:
- The swarm dispatcher (mayor/witness should check before auto-dispatch)
- Manual discipline (don't sling blocked tasks)
- Or code fix needed in gt sling

---
# EXPLORATION SUMMARY

## Bugs Confirmed

| Bug | Description | Impact |
|-----|-------------|--------|
| **Prefix Detection** | `bd create` defaults to hq- regardless of directory | Agent beads fail validation |
| **Formula Path** | `bd cook` from rig dir doesn't find town-level formulas | Polecats lack workflow knowledge |
| **Route Overwrite** | Adding rig with same prefix overwrites existing route | Can orphan beads |
| **Wave Ordering** | `gt sling` has no dependency check | Blocked tasks can run in parallel |
| **Agent Bead Cascade** | No agent bead → no molecule → no protocol | Polecats don't follow GT workflow |

## Working Features

| Feature | Status |
|---------|--------|
| Polecat spawning | ✅ Works |
| Task execution | ✅ Polecats do work |
| DEFERRED exit | ✅ Works for local testing |
| gt mail communication | ✅ Agents communicate |
| Witness monitoring | ✅ Detects patterns, escalates |
| Mayor analysis | ✅ Provides root cause |

## Key Learnings

1. **Multi-agent oversight works** - Witness → Mayor escalation operational
2. **Explicit instructions can substitute for molecules** - Polecats follow task titles
3. **DEFERRED is the local-only pattern** - Skips push, keeps bead open
4. **Dependencies are advisory** - Not enforced at dispatch time
5. **Prefix detection is the root cause** - Cascades to agent beads → molecules

## Recommended Fixes

1. **Priority 1**: `gt sling` should pass `--rig` flag to bd commands
2. **Priority 2**: `bd cook` should search parent directories for formulas
3. **Priority 3**: `gt sling` should check dependency status before dispatch
4. **Setup**: Configure git auth for gtuser (gh auth login or SSH keys)

## Session Stats

- **Runs completed**: 9
- **Observations logged**: 30
- **Bugs found**: 5 major
- **Features confirmed working**: 6
- **Polecats spawned**: 8+
- **Agent beads created successfully**: 0 (all failed prefix validation)

---
## Run 10: Post-Update Testing (GT b612df04)

Started: Wed Jan 22 00:30 AM CST 2026

### GT Update Summary

**60+ commits pulled** including key fixes:
- `fix(sling): auto-apply mol-polecat-work (#288)` - Auto-attach molecule to polecats
- `fix: updateAgentHookBead uses wrong directory for rig-level beads (#733)` - Prefix fix attempt
- `Fix GT_ROOT export for beads formula search compatibility (#718)` - Formula path fix attempt

### Observation 31: Auto-Apply mol-polecat-work Works (with workaround)

**New behavior**: `gt sling` now auto-applies mol-polecat-work for polecat work
**But**: Formula path resolution still fails - needs GT_ROOT for cook step too

**Workaround still required**: Copy formula to rig-level `.beads/formulas/`
```bash
cp /home/gtuser/gt/.beads/formulas/mol-polecat-work.formula.toml \
   /home/gtuser/gt/DReader/mayor/rig/.beads/formulas/
```

**After workaround**: Formula instantiation succeeds:
```
✓ Formula wisp created: dr-wisp-0jl
✓ Formula bonded to dr-rdl
```

### Observation 32: Polecat Now Follows Molecule Steps

**With molecule attached**, polecat behavior changed:
1. Checked hook with attached molecule
2. Ran `bd update <step> --status=in_progress`
3. Ran `gt prime && bd prime` for context
4. Closed molecule steps with `bd close`
5. Did the work (`echo hello`)
6. Attempted `gt done`

**Learning**: Molecule attachment enables structured workflow. Polecat follows steps instead of ad-hoc completion.

### Observation 33: Same Git Auth Blocker

Push still fails: `fatal: could not read Username for 'https://github.com'`

Polecat attempted escalation but `gt escalate` syntax has changed.

### Observation 34: Prefix Bug Still Present

Agent bead creation still fails:
```
Error: validate issue ID prefix: issue ID 'dr-DReader-polecat-obsidian' does not match configured prefix 'hq'
```

The fix in #733 may not cover all code paths.

### Observation 35: Incomplete GT_ROOT Fix

**Issue in sling_helpers.go line 489**:
- `cookCmd` runs `bd cook` WITHOUT GT_ROOT env var
- `wispCmd` at line 506 DOES set GT_ROOT

**Result**: Formula search fails at cook step before GT_ROOT is available.

### Run 10 Summary

**Improvements from update**:
- Auto-apply mol-polecat-work implemented ✅
- Formula instantiation works (with workaround) ✅
- Polecat follows molecule-guided workflow ✅

**Still broken**:
- Formula path resolution (GT_ROOT not set for cook) ❌
- Agent bead prefix validation ❌
- Git push auth (setup issue) ❌

**Remaining workaround**: Copy formula to rig-level `.beads/formulas/`

---
## Run 11: Full Pipeline Success with SSH Auth

Started: Wed Jan 22 06:52 AM CST 2026

### Setup
- Copied SSH keys from root to gtuser
- Updated DReader remote URLs from HTTPS to SSH
- Verified SSH auth: `Hi justSteve!`

### Observation 36: Complete Polecat Lifecycle Works

**Task**: dr-aog "SSH test: create file and run gt done"

**Full flow executed:**
1. Task created with `--rig DReader` → dr-aog ✅
2. Polecat slung → quartz spawned ✅
3. Formula attached (mol-polecat-work) → dr-wisp-1pu ✅
4. Polecat followed molecule workflow steps ✅
   - Updated wisp steps (in_progress → closed)
   - Set up branch, verified tests, implemented solution
   - Created SSH_TEST.md, updated .gitignore
   - Self-reviewed changes
5. Git push to remote ✅
6. `gt done` executed ✅
7. Bead closed → dr-aog CLOSED ✅
8. MR submitted → dr-71e in merge queue (status: ready) ✅

### Observation 37: Workaround Required for Polecat Worktrees

Initial push failed because polecat worktree still used HTTPS URL.
Fixed by updating remote in worktree: `git remote set-url origin git@github.com:...`

**Learning**: When main rig remote is changed, existing polecat worktrees don't inherit the change. Need to update each worktree's remote or nuke/recreate polecats.

### Observation 38: MR Bead Structure

MR bead (dr-71e) contains full metadata:
```
branch: polecat/quartz/dr-aog@mkp3h1wc
target: master
source_issue: dr-aog
rig: DReader
worker: quartz
agent_bead: dr-DReader-polecat-quartz
```

### Run 11 Summary

**FULL PIPELINE SUCCESS** 🎉

| Stage | Status |
|-------|--------|
| Task creation | ✅ |
| Polecat spawn | ✅ |
| Formula attach | ✅ |
| Molecule workflow | ✅ |
| Git commit | ✅ |
| Git push | ✅ |
| gt done | ✅ |
| Bead close | ✅ |
| MR in queue | ✅ |

**Remaining issues:**
- Formula workaround still needed (copy to rig-level)
- Polecat worktrees need manual remote URL update
- Prefix bug still present (but --rig flag works around it)

---
End of exploration log.
