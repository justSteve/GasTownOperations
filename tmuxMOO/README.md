# tmuxMOO

MOO-inspired Operations Center where humans and Zgents collaborate in shared text environments.

## Vision

tmux as the modern realization of 1990s MOO (MUD Object-Oriented) infrastructure:

| MOO Concept | tmuxMOO Equivalent |
|-------------|-------------------|
| Programmable objects with verbs | Zgents with defined behaviors |
| Persistent rooms | Panes/windows per context |
| Natural language parsing | LLM-powered command interface |
| Multi-user presence | Human + agents sharing sessions |
| Telnet as client | **tmux as client** |

## Key Principles

1. **Text-first**: Everything is text. Voice layers on top.
2. **Shared presence**: Agents and humans co-habit sessions.
3. **Persistence without presence**: Detach, walk away, reattach. Agents keep working.
4. **Room per Zgent**: Each agent gets its space, but can talk across rooms.
5. **Scriptable layouts**: Context switching via config files.

## Directory Structure

```
tmuxMOO/
├── README.md           # This file
├── demo/               # Proof-of-concept demo
│   ├── .tmux.conf      # Themed tmux config
│   ├── moo-demo.sh     # Demo launcher
│   ├── narrator.sh     # Simulated agents
│   └── README.md       # Demo instructions
├── config/             # Personalized tmux configs (future)
├── topology/           # Session topology designs (future)
└── presentations/      # Domain presentations (future)
```

## Quick Start

```bash
cd demo
./moo-demo.sh
```

## Beads

- **gt-moo**: Epic for tmuxMOO development
- **gt-moo.1**: Demo scaffold (this)
- **gt-moo.2**: Personalized tmux config
- **gt-moo.3**: Command parser prototype
- **gt-moo.4**: Session topology design
- **gt-moo.5**: Zgent presentation standard

## Reference

- [BRIEFING.md](../BRIEFING.md) - Full concept briefing
- [Appendix A](../BRIEFING.md#appendix-a-source-conversations) - Source conversations
