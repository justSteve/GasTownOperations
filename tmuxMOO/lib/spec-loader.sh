#!/usr/bin/env bash
# spec-loader.sh — Parse and validate a Zgent Session Spec YAML file.
# Provides functions for extracting spec values used by other lib scripts.
#
# Usage: source spec-loader.sh
#        spec_load <path-to-yaml>
#        spec_get <yq-expression>
#
# Requires: yq (https://github.com/mikefarah/yq)

set -euo pipefail

SPEC_FILE=""

spec_check_deps() {
    if ! command -v yq &>/dev/null; then
        echo "ERROR: yq is required but not installed." >&2
        echo "Install: https://github.com/mikefarah/yq#install" >&2
        return 1
    fi
}

spec_load() {
    local file="${1:?Usage: spec_load <path-to-yaml>}"
    if [[ ! -f "$file" ]]; then
        echo "ERROR: Spec file not found: $file" >&2
        return 1
    fi
    SPEC_FILE="$file"
    spec_validate
}

spec_validate() {
    local zgent
    zgent="$(spec_get '.zgent')"
    if [[ -z "$zgent" || "$zgent" == "null" ]]; then
        echo "ERROR: 'zgent' field is required in spec" >&2
        return 1
    fi

    local pane_count
    pane_count="$(spec_get '.panes | length')"
    if [[ "$pane_count" -lt 1 ]]; then
        echo "ERROR: At least one pane is required in spec" >&2
        return 1
    fi

    # Validate each pane has a name
    local i
    for ((i = 0; i < pane_count; i++)); do
        local name
        name="$(spec_get ".panes[$i].name")"
        if [[ -z "$name" || "$name" == "null" ]]; then
            echo "ERROR: Pane $i missing required 'name' field" >&2
            return 1
        fi
    done

    echo "Spec valid: zgent=$zgent, panes=$pane_count"
}

spec_get() {
    local expr="${1:?Usage: spec_get <yq-expression>}"
    yq eval "$expr" "$SPEC_FILE"
}

spec_get_or_default() {
    local expr="${1:?}" default="${2:-}"
    local val
    val="$(spec_get "$expr")"
    if [[ -z "$val" || "$val" == "null" ]]; then
        echo "$default"
    else
        echo "$val"
    fi
}

spec_zgent_name() {
    spec_get '.zgent'
}

spec_pane_count() {
    spec_get '.panes | length'
}

spec_has_field() {
    local expr="${1:?}"
    local val
    val="$(spec_get "$expr")"
    [[ -n "$val" && "$val" != "null" ]]
}
