# Steve's Answers - Session 2026-01-27

Captured responses to agent prompts during this session.

---

## Repo Cleanup Approach

**Question**: How would you like to handle the remaining files?

**Options presented**:
- Full cleanup (Recommended) - Rename all HANDOFFs, archive old COOs, move gas-town ref to docs/
- Handoffs only - Just rename HANDOFF files to COO, leave other files as-is
- Let me specify - I'll tell you which specific files to move/archive

**Answer**: Full cleanup (Recommended)

---

## Hourly Summary Content Rules

**Question**: What should hourly summary one-liners contain?

**Options presented**:
- Git activity - Commits, files changed in the last hour
- Session indicator - Simple 'Active session' or 'Idle' marker
- AI-generated summary - Brief description of conversation topics

**Answer**:
> If idle, don't add anything. If active but no files changed, ai-generated summary. Some effort should be made by the agent/author to evaluate the importance of the convo. Any file listing needs to be on a new line. Multiple lines mean one file per line. If only a single line - it needs to stand alone in the text.

**Distilled rules**:
1. **Idle**: Don't add anything (skip entirely)
2. **Active, no file changes**: AI-generated summary evaluating importance
3. **Active, with file changes**: List files (one per line)
4. Single-line summaries stand alone as complete thoughts
5. Agent should evaluate conversation importance when summarizing

---

## Archive Retention Policy

**Question**: How long should archived DaysActivity files be retained?

**Options presented**:
- 7 days - Keep one week, then delete
- 30 days - Keep one month, then delete
- Indefinite - Archive forever, manual cleanup only

**Answer**: Indefinite (manual cleanup only)

---

## Bead Creation Responsibility

**Context**: I attempted to create beads via GT commands.

**Correction**:
> It's the mayor's job to add beads... to add 'when running/managing a gt instance.'

**Clarified rule**:
- **GT-managed rigs**: Mayor handles bead creation
- **gtOps (this repo)**: Use GitHub issues directly (not GT-managed)

---

## ECC Dual Role Understanding

**Context**: Clarification on ECC's purpose and the "founding prompt".

**Guidance**:
> We don't currently have any experience with the handoff.md - that's what we need to inspect and integrate into our E/R model which is defined by schema.sql. Semantically it should be renamed 'buildECCDb.sql'.
>
> Focus on how to store and how to reference the parent. So the string is what's important, CRUD will operate against the string when the context is ECC. Other contexts will interact with the string in different ways.
>
> Recognize that dual role - on one hand we are interested in managing CRUD ops so we can apply the ECC template (the patterns it contains) to other domains -- dozens of other domains. At the same time, the agent that runs within this repo must adhere to the patterns as relayed by the current handoff.md.

**Distilled principles**:
1. **ECC stores patterns**: Commands, Rules, Skills as strings in database
2. **ECC governs this agent**: Same patterns are followed here
3. **Content (string) is king**: CRUD operates on the markdown content
4. **Dual application**: Template for replication + active governance

---

## Plan File Naming

**Feedback**: "Why on earth are you choosing non-sensical names for plans. Stop it!"

**Action taken**: Renamed from auto-generated `quirky-sauteeing-stroustrup.md` to meaningful `daysactivity-handoff-redesign.md`

**Rule**: Use descriptive, meaningful names for plan files.
