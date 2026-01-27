# Rule: Session Hygiene

## Session Start

1. **Check DaysActivity.md**
   ```bash
   head -5 /root/projects/gtOps/DaysActivity.md 2>/dev/null
   ```
   - Read recent entries for context on what was done previously
   - Note any open work items

2. **Review CurrentStatus.md** for operational context

3. **Check for legacy HANDOFF files** (transitional)
   ```bash
   ls /root/projects/gtOps/HANDOFF-*.md 2>/dev/null
   ```
   - If found: Read content, then delete (migrate info to DaysActivity.md)

## Session End

1. **Update CurrentStatus.md** if state changed significantly

2. **Run `/handoff`** if substantive work was done
   - Prepends session summary to DaysActivity.md
   - Include files changed, open work, state

3. **Consider knowledge capture**:
   - Learned anything new? Update LearnedSomethingNewToday.md
   - Made mistakes? Update DontDoThisAgain.md

## Status Update Triggers

Update `CurrentStatus.md` after:
- Running `/gt-update`
- Fixing doctor issues
- Adding/removing rigs
- Significant investigations

## DaysActivity.md Contents

Each handoff entry includes:
- **Timestamp**: HH:MM in 24-hour format
- **Summary**: What was accomplished (1-2 sentences)
- **State**: GT version, doctor status (compact)
- **Open Work**: In-progress items
- **Files Changed**: One per line (if any)

## Daily Housekeeping

Run `/daily-housekeeping` at start of day (or it runs automatically):
- Archives yesterday's DaysActivity.md
- Creates fresh file for today
