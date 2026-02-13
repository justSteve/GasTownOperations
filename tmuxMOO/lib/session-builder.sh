#!/usr/bin/env bash
# session-builder.sh — Build a tmux session from a Zgent Session Spec.
#
# Usage: session-builder.sh <spec.yaml> [--dry-run] [--destroy]
#
# Options:
#   --dry-run   Print tmux commands without executing
#   --destroy   Kill existing session with this zgent name first
#
# Requires: yq, tmux

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=false
DESTROY=false

# Source all lib components
source "$SCRIPT_DIR/spec-loader.sh"
source "$SCRIPT_DIR/theme-applicator.sh"
source "$SCRIPT_DIR/keybinding-installer.sh"
source "$SCRIPT_DIR/hook-wirer.sh"

usage() {
    echo "Usage: session-builder.sh <spec.yaml> [--dry-run] [--destroy]"
    echo ""
    echo "Build a tmux session from a Zgent Session Spec."
    echo ""
    echo "Options:"
    echo "  --dry-run   Print tmux commands without executing"
    echo "  --destroy   Kill existing session first"
    exit 1
}

# Override tmux command for dry-run mode
if [[ "$DRY_RUN" == "true" ]]; then
    tmux() {
        echo "tmux $*"
    }
fi

session_build() {
    local spec_file="$1"

    spec_check_deps
    spec_load "$spec_file"

    local session
    session="$(spec_zgent_name)"

    echo "=== Building session: $session ==="

    # Kill existing session if --destroy
    if [[ "$DESTROY" == "true" ]]; then
        if tmux has-session -t "$session" 2>/dev/null; then
            echo "Destroying existing session: $session"
            tmux kill-session -t "$session"
        fi
    fi

    # Check if session already exists
    if tmux has-session -t "$session" 2>/dev/null; then
        echo "ERROR: Session '$session' already exists. Use --destroy to replace." >&2
        return 1
    fi

    # Export environment variables
    session_export_env

    # Create session with first pane
    session_create "$session"

    # Create additional panes
    session_create_panes "$session"

    # Apply layout
    session_apply_layout "$session"

    # Apply theme
    echo "Applying theme..."
    theme_apply "$session"

    # Install keybindings
    echo "Installing keybindings..."
    keybindings_install "$session"

    # Wire hooks
    echo "Wiring hooks..."
    hooks_install "$session"

    # Set up comms directories
    session_setup_comms "$session"

    # Focus the designated pane
    session_set_focus "$session"

    echo "=== Session '$session' ready ==="
}

session_export_env() {
    if ! spec_has_field '.env'; then
        return 0
    fi

    local keys
    keys="$(spec_get '.env | keys | .[]')"
    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        local val
        val="$(spec_get ".env[\"$key\"]")"
        export "$key=$val"
    done <<< "$keys"
}

session_create() {
    local session="$1"
    local first_cmd
    first_cmd="$(spec_get_or_default '.panes[0].command' '')"
    local first_name
    first_name="$(spec_get '.panes[0].name')"

    if [[ -n "$first_cmd" ]]; then
        tmux new-session -d -s "$session" -n "$first_name" "$first_cmd"
    else
        tmux new-session -d -s "$session" -n "$first_name"
    fi

    echo "  Created session with pane: $first_name"
}

session_create_panes() {
    local session="$1"
    local pane_count
    pane_count="$(spec_pane_count)"

    for ((i = 1; i < pane_count; i++)); do
        local name cmd size split_dir
        name="$(spec_get ".panes[$i].name")"
        cmd="$(spec_get_or_default ".panes[$i].command" '')"
        size="$(spec_get_or_default ".panes[$i].size" '')"
        split_dir="$(spec_get_or_default ".panes[$i].split" 'vertical')"

        local split_flag="-v"
        if [[ "$split_dir" == "horizontal" ]]; then
            split_flag="-h"
        fi

        local size_args=""
        if [[ -n "$size" ]]; then
            # Check if percentage or absolute
            if [[ "$size" == *% ]]; then
                size_args="-p ${size%%%}"
            else
                size_args="-l $size"
            fi
        fi

        if [[ -n "$cmd" ]]; then
            tmux split-window -t "$session:0" $split_flag $size_args "$cmd"
        else
            tmux split-window -t "$session:0" $split_flag $size_args
        fi

        echo "  Created pane: $name ($split_dir, size=$size)"
    done
}

session_apply_layout() {
    local session="$1"
    local layout
    layout="$(spec_get_or_default '.display.layout' '')"

    if [[ -n "$layout" && "$layout" != "custom" ]]; then
        tmux select-layout -t "$session:0" "$layout"
        echo "  Applied layout: $layout"
    fi
}

session_setup_comms() {
    local session="$1"

    # Create publish log directory
    local publish
    publish="$(spec_get_or_default '.comms.publish' '')"
    if [[ -n "$publish" ]]; then
        local dir
        dir="$(dirname "$publish")"
        mkdir -p "$dir" 2>/dev/null || true
        echo "  Comms publish: $publish"
    fi

    # Create inbox pipe
    local inbox
    inbox="$(spec_get_or_default '.comms.inbox' '')"
    if [[ -n "$inbox" ]]; then
        local dir
        dir="$(dirname "$inbox")"
        mkdir -p "$dir" 2>/dev/null || true
        if [[ ! -p "$inbox" ]]; then
            mkfifo "$inbox" 2>/dev/null || true
        fi
        echo "  Comms inbox: $inbox"
    fi
}

session_set_focus() {
    local session="$1"
    local pane_count
    pane_count="$(spec_pane_count)"

    for ((i = 0; i < pane_count; i++)); do
        local focus
        focus="$(spec_get_or_default ".panes[$i].focus" 'false')"
        if [[ "$focus" == "true" ]]; then
            tmux select-pane -t "$session:0.$i"
            return 0
        fi
    done

    # Default: focus first pane
    tmux select-pane -t "$session:0.0"
}

# --- Main ---

main() {
    local spec_file=""

    for arg in "$@"; do
        case "$arg" in
            --dry-run) DRY_RUN=true ;;
            --destroy) DESTROY=true ;;
            --help|-h) usage ;;
            *)
                if [[ -z "$spec_file" ]]; then
                    spec_file="$arg"
                else
                    echo "ERROR: Unexpected argument: $arg" >&2
                    usage
                fi
                ;;
        esac
    done

    if [[ -z "$spec_file" ]]; then
        usage
    fi

    # Re-source with dry-run override if needed
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "=== DRY RUN MODE ==="
        tmux() {
            # has-session should return false in dry-run so build proceeds
            if [[ "$1" == "has-session" ]]; then
                return 1
            fi
            echo "  [dry-run] tmux $*"
        }
        mkdir() {
            echo "  [dry-run] mkdir $*"
        }
        mkfifo() {
            echo "  [dry-run] mkfifo $*"
        }
    fi

    session_build "$spec_file"
}

# Run if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
