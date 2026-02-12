#!/bin/bash
# narrator.sh - Simulate agent narrative output
# Usage: narrator.sh <agent-name>
# ------------------------------------------------

AGENT="${1:-unknown}"
LOG_FILE="/tmp/moo-narrative.log"

# Ensure log file exists
touch "$LOG_FILE"

# ANSI colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
DIM='\033[0;90m'
RESET='\033[0m'
BOLD='\033[1m'

log_narrative() {
    local msg="$1"
    local timestamp=$(date '+%H:%M:%S')
    echo "[$timestamp] $AGENT: $msg" >> "$LOG_FILE"
}

print_header() {
    echo -e "${BOLD}${CYAN}=== $AGENT ===${RESET}"
    echo -e "${DIM}Agent active. Narrating...${RESET}"
    echo ""
}

# Agent-specific narratives
deacon_narrative() {
    print_header

    local messages=(
        "SPX opened at 5842.50, currently testing yesterday's close"
        "Volume picking up on the bid side"
        "5840 level showing significant interest"
        "Watching for gamma exposure shift at 5835"
        "Market makers adjusting hedges"
        "SPX now at 5839.25, down 3.25 from open"
        "Put activity increasing in the 5830-5835 range"
        "Dealer gamma turning negative below 5838"
        "Volume surge detected - institutional flow"
        "SPX testing 5835 support level"
        "Breaking through 5835, dealers will need to sell"
        "Accelerated move lower, now at 5833"
    )

    for msg in "${messages[@]}"; do
        echo -e "${DIM}$(date '+%H:%M:%S')${RESET} ${GREEN}$msg${RESET}"
        log_narrative "$msg"
        sleep $((RANDOM % 5 + 3))
    done

    echo -e "\n${YELLOW}[Deacon pausing - awaiting new data]${RESET}"
    while true; do sleep 60; done
}

butterfly_narrative() {
    print_header

    local messages=(
        "Scanning butterfly opportunities..."
        "5835/5840/5845 call butterfly: \$0.42"
        "5830/5835/5840 call butterfly: \$0.38"
        "Monitoring for price movement"
        "5835/5840/5845 now at \$0.55 (+\$0.13)"
        "Volume increasing on 5835 strike"
        "5835/5840/5845 at \$0.85 (+\$0.43 from entry)"
        "Target zone approaching"
        "5835/5840/5845 at \$1.20 (+\$0.78)"
        "Gamma acceleration detected"
        "5835/5840/5845 at \$1.85 (+\$1.43)"
        "ALERT: 5835/5840/5845 at \$2.10 (+\$1.68, +400%)"
    )

    for msg in "${messages[@]}"; do
        if [[ "$msg" == ALERT* ]]; then
            echo -e "${DIM}$(date '+%H:%M:%S')${RESET} ${YELLOW}${BOLD}$msg${RESET}"
        else
            echo -e "${DIM}$(date '+%H:%M:%S')${RESET} ${CYAN}$msg${RESET}"
        fi
        log_narrative "$msg"
        sleep $((RANDOM % 4 + 2))
    done

    echo -e "\n${YELLOW}[Butterfly scanner idle - awaiting triggers]${RESET}"
    while true; do sleep 60; done
}

generic_narrative() {
    print_header
    echo -e "${YELLOW}Unknown agent: $AGENT${RESET}"
    echo "Running in generic mode..."

    while true; do
        echo -e "${DIM}$(date '+%H:%M:%S')${RESET} $AGENT heartbeat"
        log_narrative "heartbeat"
        sleep 10
    done
}

# Route to appropriate narrative
case "$AGENT" in
    deacon)
        deacon_narrative
        ;;
    butterfly)
        butterfly_narrative
        ;;
    *)
        generic_narrative
        ;;
esac
