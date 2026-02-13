# The tmux Surface Area

Comprehensive briefing on tmux's full customization surface area, oriented toward the tmuxMOO vision (tmux as a programmable stage for AI agents).

## Viewing

Open `index.html` in any modern browser. Press `S` to open speaker notes (recommended -- the notes contain the real teaching content).

For file:// protocol, just double-click the file. All dependencies are loaded from CDN (reveal.js 4.6.1, Mermaid.js 10).

Navigation:
- Arrow keys or Space to advance
- `S` for speaker notes
- `O` for slide overview
- `F` for fullscreen
- `Esc` to exit overview/fullscreen

## Slide Overview (20 slides)

| # | Title | Content |
|---|-------|---------|
| 1 | Title | Surface area metrics: 90+ options, 68 hooks, 120+ format variables |
| 2 | The Four Scope Levels | Server/Session/Window/Pane hierarchy with option examples |
| 3 | Status Line: The Room HUD | Multi-line status (up to 5), format strings, styling options |
| 4 | Pane Borders: Room Labels | pane-border-format, border styles, active border conditionals |
| 5 | Window & Pane Styling | Per-pane backgrounds, cursor styles, color palette overrides, scrollbars |
| 6 | Popups & Menus: Overlays | display-popup, display-menu, conditional menu items, styling |
| 7 | Key Tables: Agent Command Sets | Custom tables with -T, per-session key-table, modal bindings |
| 8 | Mouse & Input Control | Per-location mouse bindings, command-prompt, focus-follows-mouse |
| 9 | Hooks: 68 Event Points | Complete hook listing from options-table.c, color-coded by category |
| 10 | Hook Architecture | Array-valued hooks, scope levels, categories (38 after-*, 9 client, 7 pane, etc.) |
| 11 | Programmatic Control | Control mode (-CC), run-shell flags (-b/-d/-C), format expansion |
| 12 | Inter-Pane Communication | send-keys, capture-pane, pipe-pane, wait-for with examples |
| 13 | Format DSL: A Language in #{} | All operators (==, !=, >=, <=, &&, ||, m:, s/) and 20+ modifiers |
| 14 | Format Variables: 120+ Data Points | Categorized variable grid: pane, window, session, client, system |
| 15 | Format DSL: Real-World Example | Complex agent status line and pane iterator built in pure format DSL |
| 16 | tmux to MOO: The Mapping | Mermaid diagram: 10 tmux primitives mapped to 10 MOO concepts |
| 17 | Capability Mapping: Detail View | Detailed table of tmux features matched to MOO verbs |
| 18 | Coverage Assessment | What tmux provides vs. what needs a layer on top |
| 19 | The 80% Runtime | Architecture diagram: green (exists) vs. blue (build) layers |
| 20 | Key Takeaways | Summary + "Next: Declarative Zgent Session Spec" |

## Data Sources

All data in this presentation comes directly from the tmux source code:

- **options-table.c**: All 90+ options with their scope, type, and default values; all 68 hooks
- **format.c**: All 120+ format variables from the format_table array; all operators and modifiers from the format_replace function
- **key-bindings.c**: Key table architecture, binding storage, default menus
- **cmd-*.c**: Individual command implementations (pipe-pane, wait-for, run-shell, etc.)

## Tags

tmux, tmuxMOO, infrastructure, Zgent Factory
