#!/bin/bash
# hourly-activity-summary.sh
# Prepends hourly summary to DaysActivity.md if there was activity
#
# Usage: Run via cron every hour
#   0 * * * * /root/projects/gtOps/daemon/hourly-activity-summary.sh
#
# Rules:
#   - If idle (no git changes in last hour): Don't add anything
#   - If active with file changes: List files changed (one per line)
#   - If active but no file changes: Would need AI summary (skip for now)

GTOPS_DIR="/root/projects/gtOps"
DAYSACTIVITY="$GTOPS_DIR/DaysActivity.md"
TODAY=$(date +%Y-%m-%d)
HOUR=$(date +%H):00

# Check if DaysActivity.md exists and is for today
if [[ -f "$DAYSACTIVITY" ]]; then
    HEADER=$(head -1 "$DAYSACTIVITY")
    if [[ "$HEADER" != "# DaysActivity - $TODAY" ]]; then
        # Wrong date - let daily-housekeeping handle it
        exit 0
    fi
else
    # No file - nothing to append to
    exit 0
fi

# Get files changed in the last hour
CHANGED_FILES=$(git -C "$GTOPS_DIR" diff --name-only --since="1 hour ago" HEAD 2>/dev/null)

# Also check for recent commits
RECENT_COMMITS=$(git -C "$GTOPS_DIR" log --oneline --since="1 hour ago" 2>/dev/null | head -5)

# If no changes, exit silently
if [[ -z "$CHANGED_FILES" && -z "$RECENT_COMMITS" ]]; then
    exit 0
fi

# Build the entry
ENTRY="## $HOUR - Hourly Summary

"

if [[ -n "$RECENT_COMMITS" ]]; then
    ENTRY+="Commits:
$RECENT_COMMITS

"
fi

if [[ -n "$CHANGED_FILES" ]]; then
    ENTRY+="Files changed:
$CHANGED_FILES

"
fi

ENTRY+="---

"

# Prepend to DaysActivity.md (after the header line)
HEADER_LINE=$(head -1 "$DAYSACTIVITY")
REST=$(tail -n +2 "$DAYSACTIVITY")

{
    echo "$HEADER_LINE"
    echo ""
    echo -n "$ENTRY"
    echo "$REST"
} > "$DAYSACTIVITY.tmp" && mv "$DAYSACTIVITY.tmp" "$DAYSACTIVITY"

echo "Hourly summary added for $HOUR"
