# Rule: Session Hygiene

## Session Start

1. **Check for handoff files**
   ```bash
   ls /root/projects/gtOps/HANDOFF-*.md 2>/dev/null
   ```

2. **If handoff exists**: Read it, then rename to remove "HANDOFF-" prefix
   ```bash
   mv HANDOFF-COO-2026-01-23.md COO-2026-01-23.md
   ```

3. **Review CurrentStatus.md** for operational context

## Session End

1. **Update CurrentStatus.md** if state changed significantly

2. **Create handoff** if substantive work was done:
   - Use `/handoff` command or create `HANDOFF-COO-YYYY-MM-DD.md`

3. **Consider knowledge capture**:
   - Learned anything new? Update LearnedSomethingNewToday.md
   - Made mistakes? Update DontDoThisAgain.md

## Status Update Triggers

Update `CurrentStatus.md` after:
- Running `/gt-update`
- Fixing doctor issues
- Adding/removing rigs
- Significant investigations

## Handoff Contents

A good handoff includes:
- Session summary (what was done)
- Current state (doctor status, version, services)
- Known issues (non-blocking)
- Open work (what's in progress)
- Key patterns (relevant discoveries)
- Quick start commands
