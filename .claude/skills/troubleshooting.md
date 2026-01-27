# Skill: GT Troubleshooting

Common issues and their solutions.

## Doctor Check Failures

### agent-beads-exist

**Symptom**: Doctor reports "agent-beads-exist" failure

**Cause**: Beads prefix mismatch - agents use `hq-` prefix but configuration expects different prefix

**Impact**: Non-blocking. GT functions without agent beads.

**Status**: Known upstream issue (#591, #764)

**Action**: Note in status report, no immediate fix needed

---

### patrol-not-stuck

**Symptom**: Doctor reports patrol agent as stuck (false positive)

**Cause**: Doctor doesn't filter by wisp status - closed wisps still appear

**Impact**: Warning only

**Action**: Verify wisp is actually closed. If so, can ignore.

---

### clone-divergence

**Symptom**: Doctor reports clones have diverged from main

**Cause**: Rig clones fell behind upstream or are on different branches

**Fix**:
```bash
# Check which clones diverged
sudo -u gtuser bash -c 'cd /home/gtuser/gt && gt doctor 2>&1' | grep diverge

# Pull the divergent clones
sudo -u gtuser bash -c 'cd /home/gtuser/gt/<rig> && git pull'
```

---

### priming

**Symptom**: Doctor reports AGENTS.md exceeds 20-line bootstrap limit

**Cause**: AGENTS.md files in rigs have too much content

**Action**: Manual edit needed - trim AGENTS.md to be a pointer, not full documentation

---

## Terminal Issues

### Orphaned Input in tmux Buffer

**Symptom**: Mystery text in agent terminal prompt with send indicator

**Cause**: Crashed session left partial typed input

**Fix**:
```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 Escape C-u
```

---

### Popup/Overlay Blocking Terminal

**Symptom**: Terminal appears frozen or unresponsive

**Fix**:
```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 Escape
sudo -u gtuser tmux send-keys -t gt-user:main.0 q
sudo -u gtuser tmux send-keys -t gt-user:main.0 Enter
```

---

### Session Doesn't Exist

**Symptom**: Commands fail with "session not found"

**Check**:
```bash
sudo -u gtuser tmux list-sessions
```

**Fix**: Re-initialize dashboard
```bash
/root/projects/gtOps/daemon/gt-dashboard.sh
```

---

## Service Issues

### Services Not Starting

**Diagnosis**:
```bash
# Check daemon
gt daemon status

# Check tmux sessions
sudo -u gtuser tmux list-sessions

# Run doctor with verbose
sudo -u gtuser bash -c 'cd /home/gtuser/gt && gt doctor --fix --verbose 2>&1'
```

---

### Mayor Not Responding

**Check status**:
```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 'gt mayor status' Enter
sleep 2
sudo -u gtuser tmux capture-pane -t gt-user:main.0 -p -S -20
```

**If stuck, nudge**:
```bash
sudo -u gtuser tmux send-keys -t gt-user:main.0 'gt nudge mayor "status check"' Enter
```

---

## Beads Issues

### Message ID Prefixes

**Note**: Message IDs use town-level prefix (`hq-`) regardless of recipient. The prefix comes from beads database location, not recipient address.

### Address Resolution

Addresses simplify in storage:
- Sent to: `DReader/crew/steve`
- Stored as assignee: `DReader/steve`

Be flexible when querying - exact form may vary.

---

## When to Escalate

- Doctor failures persist after 2 fix attempts
- Services won't start after dashboard re-init
- Unknown errors in agent sessions
- Data loss concerns

Document the issue and create a bead for follow-up.
