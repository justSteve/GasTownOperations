#!/usr/bin/env bash
# hook-wirer.sh — Register tmux hooks from a Zgent Session Spec.
#
# Usage: source spec-loader.sh && spec_load <spec.yaml>
#        source hook-wirer.sh
#        hooks_install <session-name>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! declare -f spec_get &>/dev/null; then
    source "$SCRIPT_DIR/spec-loader.sh"
fi

hooks_install() {
    local session="${1:?Usage: hooks_install <session-name>}"

    if ! spec_has_field '.hooks'; then
        return 0
    fi

    local hook_names
    hook_names="$(spec_get '.hooks | keys | .[]')"
    while IFS= read -r hook; do
        [[ -z "$hook" ]] && continue
        local cmd
        cmd="$(spec_get ".hooks[\"$hook\"]")"
        tmux set-hook -t "$session" "$hook" "$cmd"
        echo "  Hook: $hook → $cmd"
    done <<< "$hook_names"
}

hooks_remove() {
    local session="${1:?Usage: hooks_remove <session-name>}"

    if ! spec_has_field '.hooks'; then
        return 0
    fi

    local hook_names
    hook_names="$(spec_get '.hooks | keys | .[]')"
    while IFS= read -r hook; do
        [[ -z "$hook" ]] && continue
        tmux set-hook -u -t "$session" "$hook" 2>/dev/null || true
        echo "  Removed hook: $hook"
    done <<< "$hook_names"
}
