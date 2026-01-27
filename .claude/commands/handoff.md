---
description: "Prepend session handoff to DaysActivity.md"
allowed-tools: ["Bash", "Read", "Write", "Glob"]
---

# Create Session Handoff

Prepend a session handoff entry to `DaysActivity.md` (cumulative daily log).

## Workflow

1. **Get current date and time**
   ```bash
   date +%Y-%m-%d
   date +%H:%M
   ```

2. **Check if DaysActivity.md exists for today**
   ```bash
   head -1 /root/projects/gtOps/DaysActivity.md 2>/dev/null
   ```
   - If missing or wrong date: Create fresh file with today's header
   - If exists with today's date: Prepend new entry

3. **Gather context**
   - Read `CurrentStatus.md` for current state
   - Review recent conversation for session summary
   - Note any discoveries or issues encountered

4. **Check GT status** (for inclusion in handoff)
   ```bash
   gt version 2>/dev/null || echo "GT not accessible"
   sudo -u gtuser bash -c 'cd /home/gtuser/gt && gt doctor 2>&1' | head -20
   ```

5. **Create handoff entry** with this structure:

```markdown
## HH:MM - Session Handoff

**Summary**: [1-2 sentence description of what was accomplished]

**State**: GT vX.X.X, Doctor P/W/F (passed/warnings/failed)

**Open Work**:
- [In-progress item 1]
- [In-progress item 2]

**Files Changed**:
path/to/file1.md
path/to/file2.sql

---
```

6. **Prepend to DaysActivity.md**
   - Read existing content
   - Write: new entry + blank line + existing content
   - Preserve the `# DaysActivity - YYYY-MM-DD` header at top

## Entry Format Rules

- **Timestamp**: 24-hour format (HH:MM)
- **Summary**: Standalone sentence, no bullet
- **State**: Compact format `GT vX.X.X, Doctor P/W/F`
- **Files Changed**: One file per line, no bullets, relative paths
- **Separator**: `---` between entries

## Creating Fresh DaysActivity.md

If file doesn't exist or has wrong date:

```markdown
# DaysActivity - YYYY-MM-DD

## HH:MM - Session Handoff

[Entry content...]

---
```

## Notes

- Entries are **prepended** (newest on top)
- Keep summaries concise and actionable
- Evaluate importance when summarizing - not everything needs detailed logging
- Files changed section only if files were actually modified
