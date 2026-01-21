#!/bin/bash
# gt-sync.sh - Sync Gas Town fork with upstream and install
# Usage: ./gt-sync.sh [--check-only]

set -e

GASTOWN_SRC="/root/gastown"
GT_INSTALL="/usr/local/bin/gt"
GTUSER_HOME="/home/gtuser/gt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_only=false
if [[ "$1" == "--check-only" ]]; then
    check_only=true
fi

echo "=== Gas Town Sync ==="
echo

# Step 1: Fetch upstream
echo -e "${YELLOW}Fetching upstream...${NC}"
cd "$GASTOWN_SRC"
git fetch upstream 2>&1

# Step 2: Compare versions
current=$(git rev-parse HEAD)
upstream=$(git rev-parse upstream/main)
current_short=$(git log --oneline -1 --format="%h")
upstream_short=$(git log --oneline upstream/main -1 --format="%h")

if [[ "$current" == "$upstream" ]]; then
    echo -e "${GREEN}Already up to date${NC} ($current_short)"
    gt version
    exit 0
fi

# Count commits behind
commits_behind=$(git rev-list HEAD..upstream/main --count)
echo -e "${YELLOW}$commits_behind commits behind upstream${NC}"
echo

# Show commits
echo "New commits:"
git log --oneline HEAD..upstream/main | head -20
if [[ $commits_behind -gt 20 ]]; then
    echo "... and $((commits_behind - 20)) more"
fi
echo

if $check_only; then
    echo -e "${YELLOW}Check only mode - not applying updates${NC}"
    exit 0
fi

# Step 3: Sync
echo -e "${YELLOW}Syncing fork with upstream...${NC}"
git stash push -m "Pre-sync $(date +%Y-%m-%d)" 2>/dev/null || true
git checkout main
git merge upstream/main --ff-only
git push origin main
echo -e "${GREEN}Fork synced${NC}"
echo

# Step 4: Build and install
echo -e "${YELLOW}Building new gt binary...${NC}"
go build -o /tmp/gt-new ./cmd/gt
new_version=$(/tmp/gt-new version)
echo "Built: $new_version"

echo -e "${YELLOW}Installing to $GT_INSTALL...${NC}"
sudo cp /tmp/gt-new "$GT_INSTALL"
sudo chmod 755 "$GT_INSTALL"
echo -e "${GREEN}Installed: $(gt version)${NC}"
echo

# Step 5: Show changelog summary
echo "=== Release Notes ==="
# Extract latest version notes from CHANGELOG
awk '/^## \[/{if(seen)exit; seen=1} seen' "$GASTOWN_SRC/CHANGELOG.md" | head -50
echo

echo -e "${GREEN}=== Sync Complete ===${NC}"
echo "Commits pulled: $commits_behind"
echo "Previous: $current_short"
echo "Current:  $upstream_short"
