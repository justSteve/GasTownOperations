# Rooms & Presence

**How Humans and Agents Share Space**

## Overview

This presentation tells the interaction model story -- how humans and agents will actually inhabit shared spaces together in the Strades platform. It synthesizes the MOO origin story (1995-97), the tmux-as-modern-transport insight, the tmuxMOO prototype, and the session topology design into a narrative about the future of human-agent collaboration.

## Core Thesis

MOO was not wrong -- it was early. The text-first, multi-user, persistent-room, programmable-object paradigm IS the right interaction model for human-agent collaboration. tmux is the transport that MOO needed. LLMs are the intelligence that MOO's objects lacked.

## Viewing

```bash
# Open directly in browser
open presentations/rooms-and-presence/index.html

# Or serve locally for speaker notes and full features
cd presentations/rooms-and-presence
python3 -m http.server 8080
# Then open http://localhost:8080
```

## Presenting

| Key | Action |
|-----|--------|
| Arrow keys / Space | Navigate slides |
| S | Open speaker notes (separate window) |
| F | Fullscreen |
| O | Overview mode |
| B | Pause (black screen) |
| Esc | Exit overview/fullscreen |

## Slide Overview (15 slides)

1. **Title** -- Rooms & Presence: How Humans and Agents Share Space
2. **The Memory (1995)** -- Steve's VEE work on MOO infrastructure, what it had and what it lacked
3. **The Realization** -- The MOO-to-Strades mapping table, "a slow dawning event"
4. **Why tmux, Not Just Better Telnet** -- Pipe vs. programmable stage, the categorical upgrade
5. **Shared Presence** -- Multiple humans and agents in the same session via send-keys
6. **Panes as Rooms** -- The 4-pane layout, spatial metaphor preserved, Alt+Arrow navigation
7. **Agents Reading the Room** -- capture-pane enables agent-to-agent observation and reaction
8. **Persistence Without Presence** -- Detach, walk away, reattach, nothing was lost
9. **Architecture: Two Layers** -- Workshop (tmux) vs. Trading Floor (web UI), complementary layers
10. **Session Topology** -- Hybrid design: shared headless agents, personal user views
11. **The Demo Today** -- What tmuxMOO demonstrates, the SPX selloff narrative arc
12. **Voice as a Layer** -- STT to send-keys, TTS from response pane, voice rides on text
13. **Honest Gaps** -- Command parsing, inter-agent IPC, failure isolation, state sync, replay
14. **The Vision Forward** -- 36 humans, 10 instruments, 30+ agents in shared persistent spaces
15. **Questions/Close** -- Reference materials and links

## Source Material

- `BRIEFING.md` -- The full MOO evolution briefing with 7 capabilities, architectural split, demo structure
- `tmuxMOO/topology/SESSION-TOPOLOGY.md` -- Option A/B/C analysis, hybrid recommendation
- `tmuxMOO/demo/` -- Working tmuxMOO prototype (moo-demo.sh, narrator.sh, .tmux.conf)

## Technical Details

- **reveal.js** 4.6.1 via CDN (zero local dependencies)
- **Mermaid.js** for architecture and topology diagrams
- Dark theme: `#1a1a2e` background, `#00d4ff` accent, `#eaeaea` text
- Speaker notes on every slide with detailed talking points
- Fade transitions

## Audience

This presentation is designed for Steve (founder) to present to stakeholders, team members, or potential collaborators. The speaker notes are detailed enough that someone could present it cold without prior context.
