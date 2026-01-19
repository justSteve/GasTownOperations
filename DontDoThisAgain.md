# Don't Do This Again

A running log of mistakes, missteps, and things that didn't work. No blame, just learning.

---

## Format

Each entry should include:
- **Date**: When it happened
- **What happened**: Brief description
- **Why it was a problem**: The impact
- **Lesson**: What we learned
- **Prevention**: How to avoid it next time

---

## Entries

### 2026-01-18: Plan mode vs explicit action
**What happened**: System was in plan mode but user gave explicit action directive ("yep -- and push"). Initially hesitated.

**Why it was a problem**: Plan mode is a guard, not a straitjacket. Clear user directives should override.

**Lesson**: Read user intent, not just system state. "Yep -- and push" is unambiguous.

**Prevention**: When user gives clear action language, act. Plan mode protects against *premature* action, not *directed* action.

---

*Add new entries above this line*
