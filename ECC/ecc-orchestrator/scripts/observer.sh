#!/usr/bin/env bash
#
# observer.sh - Hook observer for Claude Code Explorer
#
# Intercepts hook events from Claude Code, logs them to an event stream,
# and passes through to the actual scene hooks (if any).
#
# Usage: Called by Claude Code as a hook command
#   Environment Variables:
#     OBSERVER_EVENT_LOG  - Path to JSONL event log file (required)
#     OBSERVER_PASSTHROUGH - Command to run after logging (optional)
#     OBSERVER_HOOK_NAME  - Name of this hook for logging (optional)
#
# Exit Codes:
#   0 - Allow (passthrough exit code if OBSERVER_PASSTHROUGH set)
#   1 - Error
#   2 - Block (only if passthrough returns 2)

set -euo pipefail

# Read stdin (Claude Code sends JSON)
INPUT=$(cat)

# Get configuration from environment
EVENT_LOG="${OBSERVER_EVENT_LOG:-/tmp/observer-events.jsonl}"
PASSTHROUGH="${OBSERVER_PASSTHROUGH:-}"
HOOK_NAME="${OBSERVER_HOOK_NAME:-unknown}"

# Extract hook event type from Claude Code's hook context
# The input is the tool call JSON from Claude Code
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

# Parse tool name from input (best effort)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // .tool // "unknown"' 2>/dev/null || echo "unknown")

# Create event log entry
EVENT=$(jq -n \
  --arg type "tool:call" \
  --arg timestamp "$TIMESTAMP" \
  --arg hook "$HOOK_NAME" \
  --arg tool "$TOOL_NAME" \
  --argjson params "$INPUT" \
  '{
    type: $type,
    timestamp: $timestamp,
    data: {
      hook: $hook,
      tool: $tool,
      params: $params
    }
  }'
)

# Append to event log
echo "$EVENT" >> "$EVENT_LOG"

# If passthrough command is set, run it with the original input
if [[ -n "$PASSTHROUGH" ]]; then
  # Run passthrough, capture exit code
  set +e
  echo "$INPUT" | $PASSTHROUGH
  EXIT_CODE=$?
  set -e

  # Log completion
  COMPLETE_EVENT=$(jq -n \
    --arg type "hook:after" \
    --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")" \
    --arg hook "$HOOK_NAME" \
    --argjson exitCode "$EXIT_CODE" \
    '{
      type: $type,
      timestamp: $timestamp,
      data: {
        hook: $hook,
        exitCode: $exitCode
      }
    }'
  )
  echo "$COMPLETE_EVENT" >> "$EVENT_LOG"

  exit $EXIT_CODE
fi

# Default: allow (exit 0)
exit 0
