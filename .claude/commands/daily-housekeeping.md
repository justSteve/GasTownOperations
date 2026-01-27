---
description: "Archive yesterday's DaysActivity and create fresh file for today"
allowed-tools: ["Bash", "Read", "Write", "Glob"]
---

# Daily Housekeeping

Archive yesterday's DaysActivity.md and create a fresh file for today.

## Workflow

1. **Get dates**
   ```bash
   TODAY=$(date +%Y-%m-%d)
   YESTERDAY=$(date -d 'yesterday' +%Y-%m-%d)
   echo "Today: $TODAY, Yesterday: $YESTERDAY"
   ```

2. **Check current DaysActivity.md**
   ```bash
   head -1 /root/projects/gtOps/DaysActivity.md 2>/dev/null
   ```

3. **Archive if from previous day**

   If DaysActivity.md exists and header shows a date before today:
   ```bash
   # Extract date from header
   OLD_DATE=$(head -1 /root/projects/gtOps/DaysActivity.md | grep -oP '\d{4}-\d{2}-\d{2}')

   # Archive it
   mv /root/projects/gtOps/DaysActivity.md /root/projects/gtOps/archive/DaysActivity-$OLD_DATE.md
   ```

4. **Create fresh DaysActivity.md for today**
   ```markdown
   # DaysActivity - YYYY-MM-DD

   ```

5. **Clean up legacy HANDOFF files** (transitional)
   ```bash
   # List any remaining HANDOFF files
   ls /root/projects/gtOps/HANDOFF-*.md 2>/dev/null

   # If found, move to archive
   mv /root/projects/gtOps/HANDOFF-*.md /root/projects/gtOps/archive/ 2>/dev/null
   ```

6. **Report**
   - Confirm archive location
   - Confirm fresh file created
   - Note any legacy files cleaned up

## When to Run

- **Automatically**: Can be triggered by cron at midnight
- **Manually**: Run at start of first session of the day
- **On-demand**: If DaysActivity.md is stale

## Archive Retention

- Archives are kept **indefinitely**
- Manual cleanup only (no auto-deletion)
- Location: `/root/projects/gtOps/archive/DaysActivity-YYYY-MM-DD.md`

## Notes

- Safe to run multiple times (idempotent for same day)
- Won't archive today's file
- Creates file even if no activity yet (placeholder for the day)
