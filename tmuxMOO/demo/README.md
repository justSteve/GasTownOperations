# tmuxMOO Demo

Proof-of-concept demonstrating MOO-inspired operations center using tmux.

## Quick Start

```bash
cd /root/projects/gtOps/tmuxMOO/demo
chmod +x *.sh
./moo-demo.sh
```

## What You'll See

A 4-pane layout:

```
+------------------+------------------+
|     Deacon       |   Butterfly      |
|   (price/flow)   |   (scanner)      |
+------------------+------------------+
|    Narrative     |    Command       |
|   (shared log)   |    (input)       |
+------------------+------------------+
```

- **Deacon**: Narrates price action and flow
- **Butterfly**: Scans for butterfly spreads
- **Narrative**: Shared log of all agent output
- **Command**: Human input pane

## Navigation

| Key | Action |
|-----|--------|
| `Alt+Arrow` | Move between panes (no prefix) |
| `Ctrl+Space` | Prefix key |
| `Ctrl+Space d` | Detach (session keeps running) |
| `Ctrl+Space z` | Zoom current pane (toggle) |
| `Ctrl+Space |` | Split vertical |
| `Ctrl+Space -` | Split horizontal |

## Reattach

After detaching, reattach with:

```bash
tmux attach -t moo-demo
```

The agents kept running while you were away.

## Commands (Placeholder)

```
/ask <agent> <question>   - Query an agent
/scan <type> <params>     - Run a scan
/status                   - Show agent status
/help                     - Show commands
```

*Note: Command parsing not yet implemented. This demo shows the interaction model.*

## Theme

The demo uses a modern dark theme with cyan accents. Not GameBoy.

## What This Demonstrates

1. **Shared presence**: Agents and human in same session
2. **Panes as rooms**: Each agent has its space
3. **Persistence**: Detach, walk away, reattach later
4. **Narrative stream**: Agents write to shared log
5. **Text-first**: Everything is text, voice can layer on top
