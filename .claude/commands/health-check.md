---
description: "Quick GT health status without full update workflow"
allowed-tools: ["Bash", "Read"]
---

# Quick Health Check

Fast health status check without syncing upstream or running fixes.

## Workflow

1. **Check GT version**
   ```bash
   gt version
   ```

2. **Run doctor (no fix)**
   ```bash
   sudo -u gtuser bash -c 'cd /home/gtuser/gt && gt doctor 2>&1'
   ```

3. **Check active agents via gt-user terminal**
   ```bash
   sudo -u gtuser tmux send-keys -t gt-user:main.0 'gt agents' Enter
   sleep 2
   sudo -u gtuser tmux capture-pane -t gt-user:main.0 -p -S -30
   ```

4. **Check daemon status**
   ```bash
   sudo -u gtuser bash -c 'cd /home/gtuser/gt && gt daemon status 2>&1'
   ```

5. **Report summary**

   Provide a quick status table:

   | Check | Result |
   |-------|--------|
   | GT Version | (version string) |
   | Doctor Passed | (count) |
   | Doctor Warnings | (count + list) |
   | Doctor Failed | (count + list) |
   | Active Agents | (count) |
   | Daemon | (status) |

## When to Use

- Quick status check before starting work
- Verifying GT is healthy after changes
- When you don't need to sync upstream

## When to Use /gt-update Instead

- Starting a new day/session
- Need to sync with upstream
- Want to run auto-fixes
- Need full dashboard initialization
