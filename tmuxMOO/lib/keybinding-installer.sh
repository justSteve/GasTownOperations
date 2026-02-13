#!/usr/bin/env bash
# keybinding-installer.sh — Install keybindings from a Zgent Session Spec.
#
# Usage: source spec-loader.sh && spec_load <spec.yaml>
#        source keybinding-installer.sh
#        keybindings_install <session-name>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! declare -f spec_get &>/dev/null; then
    source "$SCRIPT_DIR/spec-loader.sh"
fi

keybindings_install() {
    local session="${1:?Usage: keybindings_install <session-name>}"

    keybindings_set_prefix "$session"
    keybindings_set_mouse "$session"
    keybindings_install_prefix_bindings "$session"
    keybindings_install_root_bindings "$session"
    keybindings_install_custom_table "$session"
}

keybindings_set_prefix() {
    local session="$1"
    local prefix
    prefix="$(spec_get_or_default '.input.prefix' '')"
    if [[ -n "$prefix" ]]; then
        tmux set-option -t "$session" prefix "$prefix"
        # Also unbind old prefix send and rebind
        tmux bind-key -T prefix "$prefix" send-prefix 2>/dev/null || true
    fi
}

keybindings_set_mouse() {
    local session="$1"
    local mouse
    mouse="$(spec_get_or_default '.input.mouse' 'true')"
    if [[ "$mouse" == "true" ]]; then
        tmux set-option -t "$session" mouse on
    else
        tmux set-option -t "$session" mouse off
    fi
}

keybindings_install_prefix_bindings() {
    local session="$1"

    if ! spec_has_field '.input.bindings'; then
        return 0
    fi

    # Iterate over bindings map
    local keys
    keys="$(spec_get '.input.bindings | keys | .[]')"
    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        local cmd
        cmd="$(spec_get ".input.bindings[\"$key\"]")"
        tmux bind-key -T prefix "$key" $cmd
    done <<< "$keys"
}

keybindings_install_root_bindings() {
    local session="$1"

    if ! spec_has_field '.input.root-bindings'; then
        return 0
    fi

    local keys
    keys="$(spec_get '.input.root-bindings | keys | .[]')"
    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        local cmd
        cmd="$(spec_get ".input.root-bindings[\"$key\"]")"
        tmux bind-key -T root "$key" $cmd
    done <<< "$keys"
}

keybindings_install_custom_table() {
    local session="$1"

    local table
    table="$(spec_get_or_default '.input.key-table' '')"
    if [[ -z "$table" ]]; then
        return 0
    fi

    if ! spec_has_field '.input.table-bindings'; then
        return 0
    fi

    local keys
    keys="$(spec_get '.input.table-bindings | keys | .[]')"
    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        local cmd
        cmd="$(spec_get ".input.table-bindings[\"$key\"]")"
        tmux bind-key -T "$table" "$key" $cmd
    done <<< "$keys"

    # Bind a key to switch into the custom table
    # Prefix + Tab enters the agent's key table
    tmux bind-key -T prefix Tab switch-client -T "$table"
}
