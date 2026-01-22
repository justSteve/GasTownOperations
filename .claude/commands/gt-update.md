---
description: "Sync Gas Town fork with upstream, build, install, and summarize changes"
allowed-tools: ["Bash", "Read", "Glob", "Grep", "mcp__github__list_commits"]
---

# Gas Town Daily Update

Sync justSteve/gastown fork with steveyegge/gastown upstream, install the new version to /home/gtuser/gt, and ensure healthy state.

## Workflow

1. **Check for updates**
   ```bash
   cd /root/gastown && git fetch upstream 2>&1
   ```

2. **Compare versions**
   - Get current local commit: `git log --oneline -1`
   - Get upstream head: `git log --oneline upstream/main -1`
   - List commits between: `git log --oneline HEAD..upstream/main`
   - If no new commits, skip to step 5 (doctor check)

3. **Sync fork with upstream**
   ```bash
   cd /root/gastown && git stash push -m "Pre-sync $(date +%Y-%m-%d)" 2>/dev/null
   git checkout main
   git merge upstream/main --ff-only
   git push origin main
   ```

4. **Build and install**
   ```bash
   cd /root/gastown && go build -o /tmp/gt-new ./cmd/gt
   /tmp/gt-new version
   sudo cp /tmp/gt-new /usr/local/bin/gt
   gt version
   ```

5. **Run doctor with auto-fix**
   ```bash
   sudo -u gtuser bash -c 'cd /home/gtuser/gt && gt doctor --fix --verbose 2>&1'
   ```

6. **Address remaining issues (max 2 attempts)**

   Review doctor output for failures and warnings. For each fixable issue:
   - Attempt a targeted fix (e.g., clear stuck wisp, sync clone, fix permissions)
   - Re-run `gt doctor` to verify
   - **Stop after 2 fix attempts per issue** - do not loop endlessly

   Common fixes to attempt:
   - `patrol-not-stuck`: Use `gt release` or investigate the stuck wisp
   - `misclassified-wisps`: Usually fixed by `--fix` flag
   - `clone-divergence`: Pull the divergent clones
   - `priming`: Note in report (requires manual AGENTS.md edit)

7. **Initialize dashboard terminals**
   ```bash
   /root/gtOps/daemon/gt-dashboard.sh
   ```
   This creates:
   - `gt-root` (red background) - root context for daemon monitoring
   - `gt-user` (blue background) - gtuser context for GT interaction

8. **Start town services via gt-user terminal**

   Use send-keys to interact with GT through the gtuser terminal:
   ```bash
   sudo -u gtuser tmux send-keys -t gt-user:main.0 'cd /home/gtuser/gt && gt up' Enter
   sleep 5
   sudo -u gtuser tmux send-keys -t gt-user:main.0 'gt mayor status' Enter
   sleep 2
   sudo -u gtuser tmux capture-pane -t gt-user:main.0 -p | tail -20
   ```

9. **Final status report**

   Provide a summary table (and save to `/root/gtOps/CurrentStatus.md`):

   | Category | Status |
   |----------|--------|
   | GT Version | (old → new, or "unchanged") |
   | Commits Pulled | (count or "none") |
   | Doctor Passed | (count) |
   | Doctor Warnings | (count + brief list) |
   | Doctor Failed | (count + brief list) |
   | Manual Fixes Attempted | (what was tried) |
   | Remaining Issues | (what needs human attention) |

10. **Attach to mayor**
    ```bash
    sudo -u gtuser tmux send-keys -t gt-user:main.0 'gt mayor attach' Enter
    ```
    This is the final step - hands control to the mayor session via the gt-user terminal.

## Environment Notes

**Critical**: GT runs as `gtuser`, not `root`. All GT commands must be run as gtuser:
```bash
# WRONG (runs as root, appears to work but doesn't)
gt mayor start

# RIGHT
sudo -u gtuser bash -c 'cd /home/gtuser/gt && gt mayor attach'
sudo -u gtuser bash -c 'cd /home/gtuser/gt && sleep 10 && gt mayor status'
```

**File Permissions**: Files in `/root/` are not accessible to GT agents. To share files with agents:
```bash
cp /root/gtOps/somefile.md /home/gtuser/gt/<rig>/
chown gtuser:gtuser /home/gtuser/gt/<rig>/somefile.md
```

**Verifying Sessions**: To check if GT sessions are actually running:
```bash
sudo -u gtuser tmux list-sessions
```

## Behavior Notes

- **No endless retries**: If a fix doesn't work after 2 attempts, log it and move on
- **Run as gtuser**: GT commands must run as gtuser, not root
- **Report honestly**: Include failures and unfixed issues in the final report
