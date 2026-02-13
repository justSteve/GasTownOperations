# MOOtmux Generation 1 Implementation Plan

**Status:** Ready for review
**Date:** 2026-02-12
**Goal:** Working demo that delivers the features described in the Rooms & Presence presentation

---

## Current State

### What Exists
- **demo/moo-demo.sh** - Launches 4-pane tmux session with correct layout
- **demo/narrator.sh** - Prints pre-canned messages, then `while true; do sleep 60; done`
- **demo/.tmux.conf** - Themed config with Ctrl+Space prefix, Alt+Arrow nav, mouse support
- **lib/** - Session builder infrastructure (spec-loader, theme-applicator, keybinding-installer, hook-wirer)
- **INTER-ZGENT-COMMS.md** - Comprehensive comms design (Layer 0: files, Layer 1: tmux-native, Layer 2: IPC)

### What's Missing (Gen 1 Requirements)
1. **Continuous narrative loops** - Agents should keep producing output, not die after initial burst
2. **Command parsing** - `/ask <agent> <question>` and `/scan` need to actually work
3. **Agent response to queries** - When human asks, agent should answer
4. **Inter-agent observation** - Agents reading each other via capture-pane
5. **Cross-room communication** - DReader (headless) sends alerts to Strader via Layer 0 comms
6. **Shared narrative log** - Central log that aggregates important messages

---

## Gen 1 Scope

### In Scope
- Single-session demo with 4 interactive panes
- Continuous simulated market narrative (randomized timing, not static arrays)
- Working `/ask` and `/scan` commands
- Agents that respond to queries
- Agents observing each other (Butterfly Scanner reacts to Strader's gamma flip announcement)
- **DReader mock** running headless, sending alerts to Strader via JSONL narrative logs
- Shared narrative pane aggregates cross-agent messages

### Out of Scope (Future Generations)
- Real market data feeds
- Real Discord integration (DReader connects to actual Discord)
- Multi-session topology (background agents, user views)
- Voice integration
- Layer 2 inter-Zgent comms (named pipes, sockets)
- Registry and capability discovery

---

## Implementation Tasks

### Phase 1: Continuous Narrative Engine

**Goal:** Replace static message arrays with continuous loops

#### 1.1 Strader Narrator Rewrite
Replace `deacon_narrative()` in narrator.sh:
- Rename function to `strader_narrative()`
- Remove static message array
- Add continuous loop with randomized intervals (3-8 seconds)
- Generate messages from templates with variable data (price, volume, levels)
- Track simulated state (current price, trend direction, volume regime)
- Never exit - always have something to say

```bash
# Pattern: State machine with templated output
while true; do
    update_state  # Adjust price, volume, etc.
    msg=$(generate_message)  # Select template, fill values
    echo -e "${DIM}$(date '+%H:%M:%S')${RESET} ${GREEN}$msg${RESET}"
    log_narrative "$msg"
    sleep $((RANDOM % 5 + 3))
done
```

#### 1.2 Butterfly Scanner Rewrite
Same pattern but focused on opportunities:
- Track butterfly positions (entry price, current price)
- Generate scanning messages
- React to price moves (butterfly value changes)
- Emit alerts when thresholds crossed

#### 1.3 Simulated Market State
Create `market-state.sh` that maintains shared state:
- Current SPX price (file: `/tmp/moo-market-state`)
- Trend direction
- Volume regime (normal, high, extreme)
- Key levels (gamma flip, support, resistance)

Agents read this file to stay synchronized.

---

### Phase 2: DReader Mock & Layer 0 Comms

**Goal:** Exercise the inter-Zgent communication subsystem from INTER-ZGENT-COMMS.md

This is the key architectural addition: DReader runs in a **different room** (headless background process, no pane) and communicates with Strader via the Layer 0 JSONL narrative log protocol.

#### 2.1 DReader Mock Script
Create `demo/dreader-mock.sh`:
- Runs as background process (no tmux pane)
- Simulates Discord channel monitoring
- Writes to `/var/log/moo/dreader-narrative.jsonl` (or `/tmp/moo/` for demo)
- Emits structured JSONL messages per INTER-ZGENT-COMMS.md spec

```bash
#!/bin/bash
# dreader-mock.sh - Simulates DReader sending alerts from Discord
LOG="/tmp/moo/dreader-narrative.jsonl"
mkdir -p "$(dirname "$LOG")"

discord_messages=(
    "Large SPX put buyer spotted in #spx-flow"
    "Gamma flip level discussion: 5838 consensus"
    "Unusual call sweep activity reported"
    "Market maker hedging discussion intensifying"
    "Whale alert: 10K SPX contracts at 5835"
)

while true; do
    # Pick random message
    msg="${discord_messages[$RANDOM % ${#discord_messages[@]}]}"

    # Write JSONL entry (Layer 0 format from INTER-ZGENT-COMMS.md)
    cat >> "$LOG" <<EOF
{"ts":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","from":"dreader","type":"narrative","content":"$msg","tags":["discord","spx"]}
EOF

    # Random interval (15-45 seconds - Discord is bursty)
    sleep $((RANDOM % 30 + 15))
done
```

#### 2.2 Strader Subscribes to DReader
Strader watches DReader's narrative log and incorporates alerts:

```bash
# Background subscription to DReader
subscribe_dreader() {
    local log="/tmp/moo/dreader-narrative.jsonl"
    tail -f "$log" 2>/dev/null | while read -r line; do
        content=$(echo "$line" | jq -r '.content // empty')
        if [[ -n "$content" ]]; then
            # Incorporate into Strader's narrative
            echo -e "${DIM}$(date '+%H:%M:%S')${RESET} ${YELLOW}[DISCORD]${RESET} $content"
            log_narrative "[DISCORD] $content"
        fi
    done
}
subscribe_dreader &
```

#### 2.3 Demo Launcher Update
Update `moo-demo.sh` to:
- Start DReader mock as background process (not in a pane)
- Track its PID for cleanup
- Clean up on session exit

```bash
# Start DReader mock (headless - different room)
"$SCRIPT_DIR/dreader-mock.sh" &
DREADER_PID=$!

# Cleanup on exit
trap "kill $DREADER_PID 2>/dev/null" EXIT
```

#### 2.4 Comms Directory Setup
Create the comms directory structure per INTER-ZGENT-COMMS.md:
```
/tmp/moo/
    dreader-narrative.jsonl    # DReader's public narrative
    strader-narrative.jsonl    # Strader's public narrative (optional)
```

---

### Phase 3: Command Parser

**Goal:** Make `/ask` and `/scan` commands functional

#### 3.1 Command Input Handler
Create `command-handler.sh`:
- Runs in the Human Command pane
- Reads user input
- Parses commands: `/ask <agent> <question>`, `/scan <params>`, `/status`, `/help`
- Routes to appropriate handler
- Displays responses

```bash
while true; do
    read -p "$ " cmd
    case "$cmd" in
        /ask*)   handle_ask "$cmd" ;;
        /scan*)  handle_scan "$cmd" ;;
        /status) handle_status ;;
        /help)   show_help ;;
        *)       echo "Unknown command. Try /help" ;;
    esac
done
```

#### 3.2 Ask Handler
Parse `/ask <agent> <question>`:
- Extract agent name and question
- Send query to agent via tmux send-keys OR file-based protocol
- Wait for response (capture-pane or read from response file)
- Display response

#### 3.3 Scan Handler
Parse `/scan butterfly <strike> +/- <range>`:
- Trigger Butterfly Scanner to run a focused scan
- Display results

#### 3.4 Status Handler
`/status` shows:
- Which agents are running (tmux has-session checks)
- DReader status (is mock running?)
- Last message from each agent
- Current market state

---

### Phase 4: Agent Query Response

**Goal:** Agents respond to questions

#### 4.1 Query Protocol (Simple)
For Gen 1, use file-based protocol:
- Query: Write to `/tmp/moo-query-<agent>.txt`
- Response: Agent watches for file, writes to `/tmp/moo-response-<agent>.txt`
- Command handler reads response file

#### 4.2 Agent Query Watcher
Add to each agent script:
```bash
# Background watcher for queries
watch_queries() {
    local query_file="/tmp/moo-query-$AGENT.txt"
    while true; do
        if [[ -f "$query_file" ]]; then
            question=$(cat "$query_file")
            rm "$query_file"
            response=$(generate_response "$question")
            echo "$response" > "/tmp/moo-response-$AGENT.txt"
        fi
        sleep 0.5
    done
}
watch_queries &
```

#### 4.3 Response Generation
Each agent has response templates:
- Strader: "Current SPX at {price}, trend is {direction}, watching {level}"
- Butterfly: "Best opportunity: {strike} butterfly at ${price}, currently at ${current}"

---

### Phase 5: Inter-Agent Observation

**Goal:** Agents react to each other's output (Layer 1 - tmux-native)

#### 5.1 Capture-Pane Observer
Butterfly Scanner watches Strader's pane for key events:
```bash
observe_strader() {
    while true; do
        output=$(tmux capture-pane -t moo-demo:1.1 -p -S -5)
        if echo "$output" | grep -q "gamma flip"; then
            # React to gamma flip
            adjust_scan_range
            announce "Gamma flip detected - narrowing scan"
        fi
        sleep 2
    done
}
observe_strader &
```

#### 5.2 Event Triggers
Define what triggers reactions:
- "gamma flip" / "turning negative" → Butterfly Scanner narrows range
- "breaking through" / "support broken" → Both agents increase output frequency
- "volume surge" → Butterfly Scanner looks for sweeps
- `[DISCORD]` prefix → Strader received external intel

---

### Phase 6: Shared Narrative Aggregation

**Goal:** Central log pane shows cross-agent highlights

#### 6.1 Narrative Log Format
Continue using `/tmp/moo-narrative.log` but with structured tagging:
```
[HH:MM:SS] agent: <message>
```

#### 6.2 Filtered Display
The Shared Narrative pane runs:
```bash
tail -f /tmp/moo-narrative.log | while read line; do
    # Optionally filter for important messages (alerts, flips, entries)
    echo "$line"
done
```

#### 6.3 Importance Tagging
Agents prefix important messages with markers:
- `[ALERT]` - Requires attention
- `[SIGNAL]` - Trading signal
- `[FLIP]` - Regime change
- `[DISCORD]` - From DReader

Shared Narrative can filter for these.

---

## File Changes Summary

### New Files
- `demo/dreader-mock.sh` - DReader mock (headless, Layer 0 comms)
- `demo/market-state.sh` - Simulated market state manager
- `demo/command-handler.sh` - Human command input processor
- `demo/agent-common.sh` - Shared functions (logging, query watching, subscription)

### Modified Files
- `demo/narrator.sh` - Rewrite: deacon→strader, continuous loops, DReader subscription
- `demo/moo-demo.sh` - Launch command-handler, start DReader mock, cleanup handling

### Renamed (housekeeping)
- `tmuxMOO/` → `MOOtmux/` (folder rename to match new branding)

---

## Architecture: What This Exercises

```
+------------------+          Layer 0 (JSONL)         +------------------+
|    DReader       |  ----dreader-narrative.jsonl---> |    Strader       |
|    (headless)    |                                   |    (pane 1)      |
|    no pane       |                                   |                  |
+------------------+                                   +-------+----------+
                                                               |
                                                               | Layer 1
                                                               | (capture-pane)
                                                               v
                                                       +------------------+
                                                       | Butterfly Scanner|
                                                       |    (pane 3)      |
                                                       +------------------+
```

- **DReader → Strader**: Layer 0 file-based JSONL narrative (cross-room)
- **Strader → Butterfly**: Layer 1 tmux capture-pane observation (same-session)

This validates the layered communication architecture from INTER-ZGENT-COMMS.md.

---

## Demo Walkthrough (Target State)

1. **Launch:** `./moo-demo.sh` creates 4-pane session + starts DReader headless
2. **Immediate activity:** Strader starts narrating SPX price action continuously
3. **Butterfly activity:** Butterfly Scanner announces opportunities, tracks values
4. **Discord alerts:** DReader (running headless) sends alerts → Strader displays them with `[DISCORD]` prefix
5. **Human interaction:** User types `/ask strader current level` → Strader responds
6. **Cross-agent reaction:** Strader announces gamma flip → Butterfly Scanner reacts
7. **Shared log:** Important messages from all agents appear in Shared Narrative pane
8. **Persistence:** User detaches (Ctrl+Space d), reattaches later, all agents still running

---

## Success Criteria

- [ ] Agents produce continuous output (no silent panes after 60 seconds)
- [ ] `/ask strader status` returns meaningful response
- [ ] `/scan butterfly 5835 +/-5` triggers focused scan output
- [ ] Gamma flip announcement causes Butterfly Scanner to react
- [ ] **DReader alerts appear in Strader's pane with `[DISCORD]` prefix**
- [ ] **DReader runs headless (no visible pane) - verifiable via `ps aux | grep dreader`**
- [ ] Shared Narrative shows aggregated important messages
- [ ] Session survives detach/reattach with agents still active

---

## Estimated Effort

| Phase | Goal | Complexity |
|-------|------|------------|
| Phase 1 | Continuous narrative loops | Medium - rewrite core scripts |
| Phase 2 | DReader mock + Layer 0 comms | Medium - new script + subscription |
| Phase 3 | Command parser | Low - straightforward shell |
| Phase 4 | Query response | Medium - file-based protocol |
| Phase 5 | Inter-agent observation | Medium - capture-pane + triggers |
| Phase 6 | Shared narrative | Low - mostly display formatting |

**Recommended approach:** Implement phases 1-2 first (they're the core architecture). Phases 3-6 add interactivity.

---

## Open Questions

1. **Simulation fidelity:** How realistic should the market simulation be? Full replay from historical data or simple random walk?
2. **Response latency:** Is file-based query/response fast enough, or do we need named pipes for Gen 1?
3. **Failure handling:** What happens if DReader mock crashes? Auto-restart?
4. **Log rotation:** Should narrative logs rotate, or is `/tmp/` cleanup sufficient for demo?

---

## Next Steps

1. Review and approve this plan
2. Rename `tmuxMOO/` → `MOOtmux/`
3. Begin Phase 1: Continuous Narrative Engine
4. Begin Phase 2: DReader Mock + Layer 0 Comms (can parallelize with Phase 1)
