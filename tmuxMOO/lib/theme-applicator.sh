#!/usr/bin/env bash
# theme-applicator.sh — Apply display/theme settings from a Zgent Session Spec.
#
# Usage: source spec-loader.sh && spec_load <spec.yaml>
#        source theme-applicator.sh
#        theme_apply <session-name>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source spec-loader if not already loaded
if ! declare -f spec_get &>/dev/null; then
    source "$SCRIPT_DIR/spec-loader.sh"
fi

theme_apply() {
    local session="${1:?Usage: theme_apply <session-name>}"

    theme_apply_status "$session"
    theme_apply_pane_borders "$session"
    theme_apply_window_style "$session"
}

theme_apply_status() {
    local session="$1"

    # Status bar content
    local left right style interval
    left="$(spec_get_or_default '.display.status.left' "#{session_name}")"
    right="$(spec_get_or_default '.display.status.right' "%H:%M")"
    style="$(spec_get_or_default '.display.status.style' "")"
    interval="$(spec_get_or_default '.display.status.interval' "5")"

    tmux set-option -t "$session" status-left "$left"
    tmux set-option -t "$session" status-right "$right"
    tmux set-option -t "$session" status-interval "$interval"
    tmux set-option -t "$session" status-left-length 40
    tmux set-option -t "$session" status-right-length 40

    if [[ -n "$style" ]]; then
        tmux set-option -t "$session" status-style "$style"
    fi

    # Enable status bar
    tmux set-option -t "$session" status on
}

theme_apply_pane_borders() {
    local session="$1"

    local accent border_style
    accent="$(spec_get_or_default '.display.theme.accent' '#00d4ff')"
    border_style="$(spec_get_or_default '.display.theme.border-style' 'single')"

    # Enable pane border status (labels on borders)
    tmux set-option -t "$session" pane-border-status top
    tmux set-option -t "$session" pane-border-style "fg=#555555"
    tmux set-option -t "$session" pane-active-border-style "fg=$accent"

    # Set border lines style if tmux supports it (3.3+)
    if tmux set-option -t "$session" pane-border-lines "$border_style" 2>/dev/null; then
        : # success
    fi
}

theme_apply_window_style() {
    local session="$1"

    local bg fg
    bg="$(spec_get_or_default '.display.theme.bg' '#1a1a2e')"
    fg="$(spec_get_or_default '.display.theme.fg' '#eaeaea')"

    # Apply per-pane styles
    local pane_count i
    pane_count="$(spec_pane_count)"
    for ((i = 0; i < pane_count; i++)); do
        local pane_bg pane_fg
        pane_bg="$(spec_get_or_default ".panes[$i].style.bg" "$bg")"
        pane_fg="$(spec_get_or_default ".panes[$i].style.fg" "$fg")"

        tmux select-pane -t "$session:0.$i" \
            -P "bg=$pane_bg,fg=$pane_fg" 2>/dev/null || true

        # Apply border label if specified
        local border_label
        border_label="$(spec_get_or_default ".panes[$i].border-label" "")"
        if [[ -n "$border_label" ]]; then
            tmux select-pane -t "$session:0.$i" -T "$border_label" 2>/dev/null || true
        fi
    done
}
