#!/usr/bin/env bash
# Session start hook - check for handoffs and provide context reminders

GTOPS_DIR="/root/projects/gtOps"

# Check for handoff files
HANDOFF_FILES=$(ls "$GTOPS_DIR"/HANDOFF-*.md 2>/dev/null | wc -l)

if [ "$HANDOFF_FILES" -gt 0 ]; then
    echo "[Session Start] Found $HANDOFF_FILES handoff file(s):"
    ls -1 "$GTOPS_DIR"/HANDOFF-*.md 2>/dev/null
    echo ""
    echo "REMINDER: Read handoff file(s) and rename to remove 'HANDOFF-' prefix."
    echo "Example: mv HANDOFF-COO-2026-01-23.md COO-2026-01-23.md"
fi

# Quick status reminder
if [ -f "$GTOPS_DIR/CurrentStatus.md" ]; then
    echo ""
    echo "[Session Start] CurrentStatus.md available for context."
fi
