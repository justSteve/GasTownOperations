# Strades MOO Evolution: From Telnet to tmux

## Briefing for Agent Team

**Date:** 2026-02-11
**Author:** Steve (human operator) + Claude (session partner)
**Status:** Conceptual exploration — ready for refinement
**Prior art:** See linked conversations in Appendix A

---

## 1. Origin Story

Steve built Virtual Educational Environments on MOO (MUD Object-Oriented) infrastructure in 1995–97. The core vision: programmable objects in persistent, text-based, multi-user environments with natural language interaction. The technology couldn't deliver the full vision at the time.

Three decades later, every concept maps directly to what Strades is building:

| 1995 MOO Concept | 2026 Strades Equivalent |
|---|---|
| Programmable objects with verbs | Agents with defined behaviors (Deacon, Butterfly-Scanner, Gamma-Watch) |
| Persistent rooms | Instrument-specific environments (SPX Room, Gamma Room) |
| Natural language parsing | LLM-powered NL interface |
| Multi-user presence | Human + multiple agents sharing a workspace |
| "Voice support is coming" | Voice-is-very-close-2nd priority |
| Telnet as client | **tmux as client** ← this is the new thread |

The insight: MOO's text-first interaction model was right. The transport (telnet) was a dead end. tmux is the modern realization of that transport — and it brings capabilities telnet never had.

---

## 2. Why tmux (Not Just "Better Telnet")

Telnet gave you a pipe. tmux gives you a programmable stage. The upgrade is categorical, not incremental.

### 2.1 Shared Presence

tmux sessions support multiple attachers. An agent and a human can inhabit the same session simultaneously. The agent uses `send-keys` to "speak" into the shared space. The human sees it arrive in real time. This is not simulated presence — it is actual co-habitation of a text environment.

### 2.2 Panes as Rooms

MOO had rooms for different contexts. tmux panes map directly:

- SPX narrative streaming in one pane
- Butterfly scanner output in another
- Gamma exposure monitoring in a third
- Human command input in a fourth

Navigation between "rooms" is a keystroke: `Alt+Arrow`. The spatial metaphor is preserved.

### 2.3 Agents Reading the Room

`tmux capture-pane` lets an agent read what's currently displayed in any pane. An agent can observe another agent's output, react to it, and post to its own pane. This is the programmable-objects-with-behavior pattern from MOO, running natively on terminal infrastructure.

### 2.4 Persistence Without Presence

Detach from tmux. Walk away. Reattach later. The agents kept narrating, scanning, and monitoring while you were gone. The "room" was active without human occupants. This directly answers a key design question from the original MOO-for-trading conversation: rooms should persist state when no one is in them.

### 2.5 Scriptable Layout as Context Switching

A shell script can tear down the current tmux layout and stand up a completely different one:

- `strades monitor` → 4 panes, tickers streaming, narrative flowing
- `strades focus butterfly` → order entry prominent, risk calc adjacent, scanner targeted
- `strades review` → scrollback history, trade log, P&L summary

This is frictionless context switching achieved at the terminal level — a core Strades requirement.

### 2.6 Voice Bridge

The text-first principle enables voice as a layer rather than a separate system:

- Speech-to-text → `send-keys` into command pane
- Agent reads, processes, responds with text in its pane
- TTS reads the response pane aloud

Voice becomes an I/O mode on top of the text medium. The MOO's text-first architecture is preserved, and voice rides on top for free.

### 2.7 Orchestration

`tmuxinator` or custom session managers become the "world builder":

- Define which agents spawn in which panes
- Specify layouts for each workflow context
- Set hooks that fire when pane content matches patterns
- The world definition is a config file, version-controlled and reproducible

---

## 3. Architectural Split: Workshop vs. Trading Floor

A key insight from this session: tmux and the web UI serve different roles.

**tmux = the workshop.** This is where agents and human collaborate on understanding price action, running scans, evaluating setups, and deciding what trades to take. The interaction is text-native, agent-dense, and exploratory.

**Web UI = the trading floor.** This is the productized surface for trade execution, position management, P&L visualization, and the polished experience that options traders find compelling. This is where the keyboard-first, voice-close-second UI lives.

The web UI reads from tmux sessions for data. tmux is infrastructure; the web UI is product. Both are necessary. They are not competing — they are layers.

---

## 4. Demo Artifact

This briefing includes a working proof-of-concept (`strades-tmux-demo/`) that demonstrates:

1. **Three simulated agents** narrating an SPX selloff into panes
2. **A human command pane** showing the interaction model
3. **Themed tmux config** that makes it visually acceptable (not GameBoy)
4. **Mouse support, Alt+Arrow navigation** — minimal learning curve
5. **Detach/reattach** persistence

### Demo Structure

```
strades-tmux-demo/
├── .tmux.conf          # Modern theme, Ctrl+Space prefix, mouse on
├── strades-demo.sh     # Launcher — the one command to run
├── spx-narrator.sh     # Simulated agent narrative (3 agents)
└── README.md           # Setup + controls
```

### Running the Demo

```bash
# Prerequisites: tmux installed, modern terminal (Windows Terminal, WezTerm)
cd strades-tmux-demo
chmod +x *.sh
./strades-demo.sh
```

### What the Demo Shows (Narrative)

The narrator simulates a price action sequence where:

- SPX drops from 5842.50 toward 5835 over ~60 seconds
- Deacon provides price updates and volume context
- Gamma-Watch identifies the gamma flip level and dealer hedging shift
- Butterfly-Scanner finds a 5835/5840/5845 butterfly at $0.45, updates as it rises to $2.10

This is the core Strades use case: capturing the moment when a cheap position becomes valuable, narrated in real time by specialized agents.

---

## 5. Open Questions for Agent Team

### 5.1 Agent-to-Pane Binding

How should agents be assigned to panes? Options:

- **Fixed mapping**: Deacon always owns pane 0.0, Butterfly-Scanner owns 0.1, etc.
- **Dynamic claim**: Agents request a pane when they have something to say, release it when idle.
- **Shared narrative pane**: All agents write to a single narrative stream (more MOO-like), with a sidebar pane per agent for detailed output.

### 5.2 Command Parsing in the Human Pane

The demo shows placeholder commands like `/scan butterfly 5835 ±5` and `/ask deacon what's the volume profile look like?`. How should these be implemented?

- A lightweight shell script that reads stdin, pattern-matches commands, and dispatches to agents via tmux `send-keys` or IPC?
- A Node.js/Python process running in the command pane that provides a REPL with command history?
- An LLM-backed parser that interprets natural language and routes to appropriate agents?

### 5.3 Inter-Agent Communication

In the demo, agents narrate independently. In production, they need to react to each other:

- Gamma-Watch detects a flip → Butterfly-Scanner adjusts its scan range
- Deacon notes volume surge → Gamma-Watch recalculates exposure

Should this happen via tmux pane observation (`capture-pane`), or via a separate IPC channel (Redis pub/sub, named pipes, etc.) with tmux panes as display-only?

### 5.4 tmux as Invisible Plumbing vs. Visible Interface

Steve's initial reaction: "tmux sucks — it's like looking at an 8-bit GameBoy." The demo addresses aesthetics, but the deeper question is whether the human operator should ever interact with raw tmux at all.

Alternative: tmux is pure infrastructure. Agents live in tmux sessions. The human sees agent output through a prettier surface (a custom TUI built with something like Ink, Blessed, or Textual) that reads from tmux panes via `capture-pane`. The human never types tmux commands.

### 5.5 Session Topology

For the initial scope (3 dozen humans, <10 instruments):

- One tmux session per instrument? Per user? Per user-instrument combination?
- How do multiple human users share a narrative? (Multiple attachers to the same session, or fan-out from a single agent session to multiple viewer sessions?)

### 5.6 Integration with Existing Strades Architecture

How does this layer connect to:

- **Schwab RTD feeds** — Who ingests RTD and writes to agent input?
- **Beads pattern** — Do agent sessions generate beads? Do beads trigger session events?
- **XState state machines** — Does the session manager use XState for workflow orchestration?
- **Gas Town agents** — Are Mayor/Deacon/Polecats the same agents that inhabit tmux panes?

### 5.7 Persistence and Replay

tmux scrollback provides basic history, but for serious replay ("show me what happened in the 2:30–3:00 window"), you need structured logging:

- Agent output piped to both the tmux pane and a timestamped log?
- A replay mode that feeds historical log entries into panes at accelerated speed?
- Integration with the trade journal / review workflow?

---

## 6. Recommended Next Steps

1. **Run the demo** to internalize the interaction model
2. **Prototype real agent → tmux binding** — replace `spx-narrator.sh` with an actual agent process that writes to a pane via `tmux send-keys`
3. **Build the command parser** — even a minimal version that routes `/scan` and `/ask` commands
4. **Test multi-user attachment** — have two terminals attach to the same session to validate shared presence
5. **Evaluate TUI overlay** — prototype a Textual or Blessed app that reads from tmux panes and presents with richer formatting
6. **Define session topology** for the <10 instrument, <36 user constraint

---

## Appendix A: Source Conversations

### A.1 — Text-based MOOs from the 1990s (Oct 2025)

https://claude.ai/chat/c19031dd-6b30-46a2-b512-24498f250bc8

Survey of active MOOs. Pivot to MOO-as-trading-narrative concept. Key constraints defined: 3 dozen users, <10 instruments, text-based interactions. MVP sketched: 3–4 rooms, 5–6 indicators, WebSocket streaming, basic room navigation.

### A.2 — Accessing archived web links on mobile (Feb 2026)

https://claude.ai/chat/849ac080-8800-4a7b-b80e-4f52e3662f01

Steve's 1997 VEE page and Berkeley MOO research library. Connection drawn between MOO concepts and current Strades agent architecture. Steve describes the realization as "a slow dawning event." Key thread: the MOO vision of environments where objects have behavior and respond to input is what modern agent frameworks are rediscovering.

### A.3 — This Session (Feb 2026)

The conversation that produced this briefing. Thread: telnet → tmux as the evolution of MOO client infrastructure. Capabilities enumerated. Demo built. Architectural split proposed (tmux as workshop, web UI as trading floor).

---

## Appendix B: Key Conceptual Vocabulary

| Term | Meaning in Strades Context |
|---|---|
| **Room** | A tmux pane or window dedicated to a specific instrument or workflow context |
| **Narrative** | The real-time text stream generated by agents describing price action, indicator status, and trade opportunities |
| **Presence** | An agent or human actively attached to and participating in a tmux session |
| **World builder** | The session manager / tmuxinator config that defines which agents spawn where |
| **Workshop** | The tmux layer where agents and human collaborate on analysis |
| **Trading floor** | The web UI layer where trade execution and position management happen |
| **Context switch** | A scripted tmux layout change that reconfigures all panes for a different workflow mode |

---

## Appendix C: Technical References

- **tmux source**: https://github.com/tmux/tmux (BSD/ISC license)
- **tmuxinator**: https://github.com/tmuxinator/tmuxinator (session manager)
- **Textual**: https://github.com/Textualize/textual (Python TUI framework)
- **Blessed**: https://github.com/chjj/blessed (Node.js terminal interface)
- **Ink**: https://github.com/vadimdemedes/ink (React for CLIs)
- **WezTerm**: https://wezfurlong.org/wezterm/ (GPU-accelerated terminal)
- **Windows Terminal**: Built-in, supports true color and Unicode
