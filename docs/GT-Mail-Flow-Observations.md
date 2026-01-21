# GT Mail Flow Observations

**Date:** 2026-01-20
**Experiment:** Tracer 001 - Static Mail Flow Analysis

## Summary

We traced a message from send to storage to recipient inbox without running agents. This documents how GT's mail system works at the storage layer.

---

## Key Findings

### 1. Message Storage Structure

Messages are stored in beads as issues with `type=message`. Example (our tracer):

```json
{
  "id": "hq-3g9",
  "title": "Tracer 001",
  "description": "Test message for gtOps observation experiment...",
  "status": "open",
  "priority": 2,
  "issue_type": "message",
  "assignee": "DReader/steve",
  "owner": "steve@juststeve.com",
  "created_at": "2026-01-20T21:45:52.450289444-06:00",
  "created_by": "overseer",
  "ephemeral": true,
  "labels": [
    "from:overseer",
    "thread:thread-6121b2aff57c"
  ]
}
```

### 2. ID Prefix System

| Prefix | Level | Example |
|--------|-------|---------|
| `hq-`  | Town (HQ) | `hq-3g9` (messages, town-level beads) |
| `dr-`  | Rig (DReader) | `dr-DReader-witness` (session names) |

**Key insight:** Messages use the town-level `hq-` prefix even when addressed to rig-level agents. The prefix comes from the beads database location, not the recipient.

### 3. Address Resolution

When sending to `DReader/crew/steve`, GT resolves this to:
- `assignee`: `DReader/steve` (simplified form)
- The message appears in steve's inbox when queried with `--identity DReader/crew/steve`

### 4. Mail vs Hooks

**Mail** and **Hooks** are separate concepts:
- **Mail** (`gt mail inbox`): Messages waiting to be read - passive
- **Hooks** (`gt hook`): Active work assignments that trigger agent behavior

Our tracer message appeared in steve's mail inbox but NOT on his hook. This means:
- Mail doesn't automatically become hooked work
- Agents must process mail and decide what to hook
- Hooks are for **actionable tasks**, mail is for **communication**

### 5. Message Metadata

| Field | Purpose |
|-------|---------|
| `assignee` | Recipient (address format) |
| `created_by` | Sender (identity) |
| `owner` | Human owner (email) |
| `ephemeral` | true = wisp (not synced to remote), false = permanent |
| `labels` | Includes `from:`, `thread:`, `read` status |
| `thread` | Thread ID for conversation tracking |
| `reply-to` | Links replies to original message |

### 6. Inbox Queries

```bash
# Default inbox (for current identity)
gt mail inbox

# Specific identity's inbox
gt mail inbox --identity DReader/crew/steve

# All messages in beads
bd list --type=message
```

---

## Current State Snapshot

### Agents (all stopped)
| Agent | Session Name | Hook |
|-------|--------------|------|
| Mayor | hq-mayor | hq-14l (mail) |
| Deacon | hq-deacon | (none) |
| Witness | dr-DReader-witness | (none) |
| Refinery | dr-DReader-refinery | (none) |
| Crew/steve | dr-DReader-crew-steve | (none) |
| Polecat/furiosa | dr-DReader-polecat-furiosa | (none) |

### Mail Summary
- 13 messages total in beads
- 3 unread to overseer (steve@juststeve.com)
- 3 unread to mayor
- 1 unread to DReader/steve (our tracer)

---

## Questions for Dynamic Observation (Future Work)

These require running agents (`gt up`) to answer:

1. **When an agent starts, how does it discover and process waiting mail?**
2. **What triggers a hook? Does the agent hook mail manually or is it automatic?**
3. **How does the nudge system wake up agents? What's the tmux interaction?**
4. **What happens when work is completed? How does status change propagate?**
5. **How does the merge queue work when multiple agents complete work?**

---

## Commands Reference

```bash
# Send mail
gt mail send <address> -s "subject" -m "body"

# Check inbox
gt mail inbox [--identity <addr>]

# List all messages
bd list --type=message

# Show message details
bd show <message-id> --json

# Check hooks
gt hook                    # Current identity
gt hook show <identity>    # Specific agent

# Agent status
gt status -v
```
