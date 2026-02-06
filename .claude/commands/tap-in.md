---
description: "Initialize session with context briefing"
allowed-tools: ["Bash", "Read", "Glob", "Write"]
---

# Tap In - Session Initialization

Read recent activity and current state to get oriented at session start.

## Workflow

1. **Get current date**
   ```bash
   date +%Y-%m-%d
   ```

2. **Check if daily housekeeping needed**
   ```bash
   head -1 /root/projects/gtOps/DaysActivity.md 2>/dev/null
   ```
   - If date doesn't match today: Run `/daily-housekeeping` first

3. **Read recent activity** (last 2-3 entries from DaysActivity.md)
   - Note open work items
   - Note recent state/issues
   - Identify any continuity threads

4. **Read CurrentStatus.md** for operational context

5. **GT doctor --fix**
   ```bash
   sudo -u gtuser tmux send-keys -t gt-user:main.0 'gt doctor --fix' Enter
   sleep 3
   sudo -u gtuser tmux capture-pane -t gt-user:main.0 -p -S -30
   ```

6. **Output to session-briefing.md** with this structure:

```markdown
## Session Briefing - HH:MM

**Last Activity**: [timestamp] - [brief summary from most recent handoff]

**Open Work**:
- [Carried over item 1]
- [Carried over item 2]

**Current State**: GT vX.X.X, Doctor P/W/F

**Attention Items**:
- [Anything unusual from health check]
- [Any blockers or issues noted]

**Ready to proceed.**
```

## Output Rules

- Keep briefing concise - surface what matters
- Look at filenames of any non-code artifacts. If the filename is non-sensical, flag it as unacceptable.
- Highlight open work prominently (this is the continuity thread)
- Note any state drift from last session (version changed, new failures)
- If health check shows problems, flag them before proceeding
- End with "Ready to proceed" or "Issues require attention" as appropriate

## When to Skip

- If user immediately gives a specific task, skip detailed briefing
- Can be run explicitly with `/tap-in` when context needed

## Notes

- Pairs with `/handoff` (session end)
- Output goes to `/root/projects/gtOps/session-briefing.md`
- Can be re-run anytime to refresh context
