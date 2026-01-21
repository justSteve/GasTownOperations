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
## Testing sling with fresh task
