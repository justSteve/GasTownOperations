# Rule: Knowledge Capture

## When to Update LearnedSomethingNewToday.md

Add an entry when you:
- Discover unexpected behavior
- Find a pattern that will help future sessions
- Solve a non-obvious problem
- Learn something about GT internals
- Figure out a workaround for a quirk

## When to Update DontDoThisAgain.md

Add an entry when you:
- Make a mistake worth remembering
- Find an anti-pattern
- Waste time on something preventable
- Encounter a footgun

## Entry Format

```markdown
### YYYY-MM-DD: Brief Title

**Discovery/What happened**: What you learned or did wrong

**Context**: How you discovered it or what led to the mistake

**Application/Prevention**: How this helps going forward
```

## Session End Prompt

At session end, ask yourself:
- "Did I learn anything worth documenting?"
- "Did I make any mistakes I shouldn't repeat?"

If yes, update the appropriate file immediately.

## Location

- `/root/projects/gtOps/LearnedSomethingNewToday.md`
- `/root/projects/gtOps/DontDoThisAgain.md`
