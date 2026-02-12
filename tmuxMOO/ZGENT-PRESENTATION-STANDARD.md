# Zgent Presentation Standard

## Overview

Every well-formed Zgent includes a `presentations/` directory containing reveal.js presentations that explain its domain to various audiences.

This standard ensures:
1. **Consistent format** across all Zgents
2. **Self-documenting** agents that can explain themselves
3. **Reusable template** for rapid presentation creation
4. **Executive-ready** artifacts without additional work

## Directory Structure

```
<zgent-root>/
├── .claude/
├── src/
├── tests/
└── presentations/
    ├── <domain>-exec-walkthrough/
    │   ├── index.html      # Self-contained reveal.js
    │   └── README.md       # Usage instructions
    └── <domain>-technical-deep-dive/
        ├── index.html
        └── README.md
```

## Required Presentations

### 1. Executive Walkthrough

**Audience**: Executive managers, stakeholders, non-technical decision makers

**Structure** (10-15 slides):
1. Vision/mission of this Zgent
2. Problem it solves
3. Key capabilities
4. Architecture overview (visual, no code)
5. Integration points
6. Business value
7. Current status
8. Next steps

**Template**: `presentations/crudengine-exec-walkthrough/` in gtOps

### 2. Technical Deep Dive (Optional)

**Audience**: Engineers, developers, technical operators

**Structure**:
- Implementation details
- API documentation
- Code examples
- Performance characteristics
- Debugging/troubleshooting

## Technical Requirements

### Format: reveal.js

All presentations use reveal.js with CDN links for zero dependencies:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.6.1/dist/reveal.css">
<script src="https://cdn.jsdelivr.net/npm/reveal.js@4.6.1/dist/reveal.js"></script>
```

### Diagrams: Mermaid.js

Architecture diagrams use Mermaid for version-controlled, editable visuals:

```html
<script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });
</script>
```

### Theme

Dark theme with accent color. Match the Zgent's visual identity if it has one.

Recommended base:
```css
:root {
    --r-background-color: #1a1a2e;
    --r-main-color: #eaeaea;
    --r-heading-color: #00d4ff;  /* or Zgent's accent */
}
```

### Speaker Notes

Every slide includes speaker notes for context:

```html
<section>
    <h2>Slide Title</h2>
    <aside class="notes">
        Detailed talking points for the presenter.
        Include timing guidance if needed.
    </aside>
</section>
```

### README

Each presentation directory includes a README with:
- How to present (open in browser)
- Keyboard shortcuts
- Slide overview
- Bead reference

## Usage

### Viewing

```bash
# Open directly in browser
open presentations/<name>/index.html

# Or serve locally for full features
cd presentations/<name>
python3 -m http.server 8080
# Then open http://localhost:8080
```

### Presenting

- **Arrows/Space**: Navigate
- **S**: Speaker notes view
- **F**: Fullscreen
- **O**: Overview mode
- **B**: Pause (black screen)

## Integration with Zgent Lifecycle

### When to Create

- After initial implementation (explains what was built)
- Before stakeholder review (enables informed discussion)
- When onboarding new team members

### Updating

Presentations are versioned with the Zgent. Update when:
- Major features added
- Architecture changes
- Status milestones reached

### Automation (Future)

Consider auto-generating presentation stubs from:
- Zgent metadata (description, capabilities)
- CrudEngine traffic logs (what operations it performs)
- Test coverage reports

## Reference Implementation

See: `gtOps/presentations/crudengine-exec-walkthrough/`

This presentation was created during the CrudEngine development cycle and demonstrates all the standards above.

## Alignment with BRIEFING.md

From Section 2.7 (Orchestration):
> "The world definition is a config file, version-controlled and reproducible."

Presentations are part of the reproducible Zgent artifact set. When you materialize a Zgent, its presentation comes with it.
