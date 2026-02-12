# Session Topology Design

## Constraints

From BRIEFING.md:
- <10 instruments (SPX, QQQ, IWM, etc.)
- <36 users (3 dozen humans)
- Room per Zgent, cross-room communication

## Design Options

### Option A: Session per Instrument

```
tmux sessions:
├── moo-spx          # SPX workshop
│   ├── window:spx   # Main workspace
│   │   ├── pane:deacon
│   │   ├── pane:butterfly
│   │   ├── pane:narrative
│   │   └── pane:command
│   └── window:review  # Historical review
├── moo-qqq          # QQQ workshop
├── moo-iwm          # IWM workshop
└── moo-ops          # Operations/admin
```

**Pros:**
- Clean separation by instrument
- Multiple users attach to same session
- Agents persist per instrument

**Cons:**
- User must switch sessions to change instruments
- Cross-instrument alerts harder to route

### Option B: Session per User

```
tmux sessions:
├── moo-steve        # Steve's workspace
│   ├── window:spx
│   ├── window:qqq
│   └── window:ops
├── moo-alice        # Alice's workspace
└── moo-bob          # Bob's workspace
```

**Pros:**
- Personalized layouts
- User owns their context

**Cons:**
- Agents must be spawned per-user (expensive)
- Shared narrative harder

### Option C: Hybrid - Shared Agents, Personal Views

```
Background sessions (headless):
├── agents-spx       # SPX agents (no human attach)
├── agents-qqq       # QQQ agents
└── agents-iwm       # IWM agents

User sessions:
├── moo-steve        # Steve's view
│   ├── window:main
│   │   ├── pane:spx-feed  (reads from agents-spx)
│   │   ├── pane:qqq-feed  (reads from agents-qqq)
│   │   └── pane:command
│   └── window:focus-spx
└── moo-alice        # Alice's view
```

**Pros:**
- Agents run once, shared across users
- Users get personal layouts
- Scalable to 36 users without agent explosion

**Cons:**
- More complex routing
- Requires feed/view separation

## Recommended: Option C (Hybrid)

**Rationale:**

1. **Agent efficiency**: Agents run once per instrument, not per user. A single Deacon narrates SPX for everyone.

2. **Personal context**: Users customize their view. Steve can focus on SPX butterflies. Alice can watch gamma across instruments.

3. **Scalability**: Adding users doesn't multiply agents.

4. **Cross-room talk**: Agents in background sessions communicate via pub/sub (Gas Town patterns). User views aggregate output.

## Implementation Sketch

### Agent Sessions

Background tmux sessions run agents headless:

```bash
# Spawn agent session
tmux new-session -d -s agents-spx
tmux send-keys -t agents-spx "deacon --instrument SPX" Enter

# Agents write to:
# - Their pane (for debugging)
# - Shared narrative log (/var/log/moo/spx-narrative.jsonl)
# - Pub/sub channel (for inter-agent)
```

### User Sessions

Users attach to personal sessions:

```bash
# Create user session
tmux new-session -d -s moo-steve

# Feed pane tails agent output
tmux send-keys -t moo-steve "tail -f /var/log/moo/spx-narrative.jsonl | jq -r '.msg'" Enter
```

### Shared Presence (Broadcasting)

When multiple users want to see the same thing:

```bash
# Link a window from agent session to user session
tmux link-window -s agents-spx:0 -t moo-steve:9
```

Or use `tmux pipe-pane` to replicate output.

## Open Questions

1. **Latency**: How fast must agent output reach user panes? Sub-second? Tail -f may be sufficient.

2. **Command routing**: User types `/ask deacon status`. How does this reach the agent in agents-spx?
   - Option: Named pipe or Unix socket per agent
   - Option: Redis pub/sub
   - Option: tmux send-keys to agent pane

3. **State sync**: If Steve and Alice both watch SPX, do they see identical narrative or can it diverge?

4. **Failure isolation**: If agents-spx crashes, user sessions continue with stale data. Acceptable?

## Next Steps

1. Prototype Option C with 1 instrument, 2 users
2. Test command routing via named pipes
3. Measure latency from agent write to user view
4. Evaluate Gas Town pub/sub integration
