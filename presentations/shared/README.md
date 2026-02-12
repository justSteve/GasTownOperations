# Presentation Help/Bug Widget

Interactive help widget that appears in the bottom-left corner of every Gas Town presentation. Users can ask questions about the current slide or report bugs, and get answers powered by the Claude API.

## Architecture

```
widget.css    - Styles for the button, modal dialog, and response area
widget.js     - Self-contained JS module (auto-initializes in reveal.js presentations)
proxy.mjs     - Minimal Node.js proxy that forwards requests to the Claude API
```

## Setup

### 1. Start the Proxy

The widget calls Claude via a local proxy (required because browser-side code cannot safely hold API keys).

```bash
# From the gtOps root directory
ANTHROPIC_API_KEY=sk-ant-... node presentations/shared/proxy.mjs
```

The proxy runs on `http://localhost:3141` and forwards POST requests to `https://api.anthropic.com/v1/messages`.

Optional: set `CLAUDE_MODEL` to override the default model:
```bash
CLAUDE_MODEL=claude-sonnet-4-20250514 ANTHROPIC_API_KEY=sk-ant-... node presentations/shared/proxy.mjs
```

### 2. Include in a Presentation

Add before the closing `</body>` tag of any reveal.js presentation:

```html
<!-- Help Widget -->
<link rel="stylesheet" href="../shared/widget.css">
<script src="../shared/widget.js"></script>
```

The widget auto-initializes when it detects a `.reveal` container in the DOM.

### 3. Add a manifest.json (Optional but Recommended)

Place a `manifest.json` in each presentation directory for rich context:

```json
{
  "id": "my-presentation",
  "title": "Presentation Title",
  "subtitle": "Subtitle",
  "slideCount": 12,
  "description": "What this presentation covers.",
  "narrativeArc": "How the story flows across slides.",
  "tags": ["topic1", "topic2"],
  "connections": ["other-presentation-id"],
  "slides": [
    { "index": 0, "title": "Slide Title", "role": "What this slide accomplishes" }
  ]
}
```

Without a manifest, the widget still works but sends only slide content as context.

## How It Works

1. User clicks the "?" button in the bottom-left corner
2. A modal dialog opens with two tabs: "Ask a Question" and "Report a Bug"
3. User types their message and clicks Send (or Ctrl+Enter)
4. The widget gathers context:
   - Current slide index, title, and text content
   - Speaker notes (from `aside.notes`)
   - Manifest data (title, narrative arc, slide roles, connections)
5. Constructs a system message with all context and sends to the proxy
6. Proxy forwards to Claude API and returns the response
7. Response is displayed in the dialog

## Fallback Behavior

| Scenario | Behavior |
|----------|----------|
| Proxy not running | Shows message: "Help service unavailable. Start the proxy with..." |
| manifest.json missing | Widget works with slide content only (no narrative arc or slide roles) |
| API key not set | Proxy exits with clear error message on startup |
| API error | Error message displayed in the dialog |
| Request timeout | "Request timed out" message after 60 seconds |

## Style

The widget uses the standard Gas Town dark theme:
- Background: `#1a1a2e`
- Accent: `#00d4ff`
- Text: `#eaeaea`
- Error: `#ff8a8a`

The button is semi-transparent until hovered, positioned to avoid interfering with reveal.js navigation controls.
