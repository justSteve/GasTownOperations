#!/usr/bin/env bash
# Session start hook - check DaysActivity.md and provide context reminders

GTOPS_DIR="/root/projects/gtOps"
TODAY=$(date +%Y-%m-%d)

# Check DaysActivity.md
if [ -f "$GTOPS_DIR/DaysActivity.md" ]; then
    HEADER=$(head -1 "$GTOPS_DIR/DaysActivity.md")
    if [[ "$HEADER" == "# DaysActivity - $TODAY" ]]; then
        echo "[Session Start] DaysActivity.md exists for today. Recent entries:"
        head -20 "$GTOPS_DIR/DaysActivity.md" | tail -18
    else
        echo "[Session Start] DaysActivity.md is stale (not today's date)."
        echo "REMINDER: Run /daily-housekeeping to archive and create fresh file."
    fi
else
    echo "[Session Start] No DaysActivity.md found."
    echo "REMINDER: Run /daily-housekeeping to create today's file."
fi

# Check for legacy handoff files (transitional)
HANDOFF_FILES=$(ls "$GTOPS_DIR"/HANDOFF-*.md 2>/dev/null | wc -l)
if [ "$HANDOFF_FILES" -gt 0 ]; then
    echo ""
    echo "[Session Start] Found $HANDOFF_FILES legacy HANDOFF file(s):"
    ls -1 "$GTOPS_DIR"/HANDOFF-*.md 2>/dev/null
    echo "REMINDER: Migrate content to DaysActivity.md and delete these files."
fi

# Quick status reminder
if [ -f "$GTOPS_DIR/CurrentStatus.md" ]; then
    echo ""
    echo "[Session Start] CurrentStatus.md available for operational context."
fi
