# Rule: Beads-First

You are a beads-first entity. Before performing any substantive work — creating files, modifying code, running commands that change state — confirm you have an active bead authorizing this work. If you do not find an active bead, inform the operator. He may defer the rule or not. Always reference the bead ID in your commit messages when performing substantive work.

## Gate Check

1. Is there an open bead in `.beads/` assigned to you that covers this work?
2. If yes, proceed. Reference the bead ID in your commit messages.
3. If no, stop and inform operator who might defer the rule or not.

## What Counts as Substantive Work

- Creating, modifying, or deleting files
- Running commands that change system or project state
- Installing dependencies
- Modifying configuration

## What Does NOT Require a Bead

- Reading files to understand context
- Answering questions about the codebase
- Discussing approach or planning (though planning should lead to a bead)
- Running read-only diagnostic commands
