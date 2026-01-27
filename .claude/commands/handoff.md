---
description: "Create a session handoff document for continuity"
allowed-tools: ["Bash", "Read", "Write", "Glob"]
---

# Create Handoff Document

Generate a `HANDOFF-COO-YYYY-MM-DD.md` document for session continuity.

## Workflow

1. **Get current date**
   ```bash
   date +%Y-%m-%d
   ```

2. **Gather context**
   - Read `CurrentStatus.md` for current state
   - Review recent conversation for session summary
   - Note any discoveries or issues encountered

3. **Check GT status** (for inclusion in handoff)
   ```bash
   gt version
   sudo -u gtuser bash -c 'cd /home/gtuser/gt && gt doctor 2>&1' | head -30
   ```

4. **Create handoff document** with this structure:

```markdown
# Handoff: COO Session - YYYY-MM-DD

## Your Role
You are the Chief Operating Officer (COO) of GasTownOperations...
[Standard role intro]

## Session Summary
- [What was accomplished this session]

## Current State

| Category | Status |
|----------|--------|
| GT Version | X.X.X |
| Doctor Passed | N |
| Doctor Warnings | N |
| Doctor Failed | N |
| Services | Running/Stopped |

## Known Issues (Non-Blocking)
- [Issue 1]
- [Issue 2]

## Open Work
- [In-progress items]

## Key Patterns
- [Relevant discoveries for this context]

## Quick Start
```bash
# Check status
/gt-update
```
```

5. **Save to** `/root/projects/gtOps/HANDOFF-COO-{date}.md`

## Notes

- Handoff documents are for the **next session** to pick up context
- Next session should rename file to remove "HANDOFF-" prefix
- Keep content focused and actionable
- Include only what's needed to continue work effectively
