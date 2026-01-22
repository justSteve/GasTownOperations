---
description: "Sync Gas Town fork with upstream, build, install, and summarize changes"
allowed-tools: ["Bash", "Read", "Glob", "Grep", "mcp__github__list_commits"]
---

# Gas Town Daily Update

Sync justSteve/gastown fork with steveyegge/gastown upstream, install the new version to /home/gtuser/gt, and provide a changelog summary.

## Workflow

1. **Check for updates**
   ```bash
   cd /root/gastown && git fetch upstream 2>&1
   ```

2. **Compare versions**
   - Get current local commit: `git log --oneline -1`
   - Get upstream head: `git log --oneline upstream/main -1`
   - List commits between: `git log --oneline HEAD..upstream/main`
   - If no new commits, report "Already up to date" and exit

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

5. **Verify installation**
   ```bash
   sudo -u gtuser /usr/local/bin/gt doctor 2>&1 | head -40
   ```

6. **Summarize changes**
   - Read the CHANGELOG.md for release notes
   - List the commits included in this update
   - Highlight key fixes and features

## Output Format

Provide a concise summary:
- Previous version -> New version
- Number of commits pulled
- Key changes (from CHANGELOG or commit messages)
- Doctor status (any warnings to address)
