#!/bin/bash
# gh-archive.sh - Archive GitHub Issues and PRs with significance scoring
# Usage: gh-archive.sh [sync|full|stats|top|recent] [args]

set -e
set -o pipefail  # Catch errors in pipelines

ARCHIVE_DIR="/root/gtOps/archive/github"
REPO="steveyegge/gastown"
REPO_DIR="$ARCHIVE_DIR/steveyegge-gastown"
CONFIG_FILE="$ARCHIVE_DIR/config.json"

# Maintainers/collaborators get higher author scores
KNOWN_MAINTAINERS="steveyegge sauerdaniel"

# Label weights for significance scoring
declare -A LABEL_WEIGHTS=(
    ["bug"]=8
    ["security"]=10
    ["enhancement"]=6
    ["feature"]=6
    ["breaking-change"]=9
    ["rfc"]=8
    ["documentation"]=3
    ["question"]=2
    ["good first issue"]=2
    ["help wanted"]=4
    ["wontfix"]=1
    ["duplicate"]=1
)

# Initialize config if not exists
init_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        cat > "$CONFIG_FILE" << 'EOF'
{
  "repos": {
    "steveyegge/gastown": {
      "last_sync": null,
      "issues_count": 0,
      "prs_count": 0,
      "discussions_count": 0
    }
  }
}
EOF
        echo "Created config file: $CONFIG_FILE"
    fi
}

# Calculate significance score for an item
# Input: JSON object via stdin
# Output: JSON object with significance_score and significance_tier added
calculate_significance() {
    jq --arg maintainers "$KNOWN_MAINTAINERS" '
        # Score components (max 100)
        # comments is an array, not a count - use length
        def comment_score: ((.comments // []) | length | if . > 10 then 25 elif . > 5 then 20 elif . > 2 then 15 elif . > 0 then 10 else 0 end);
        def reaction_score: (([.reactionGroups[]?.users.totalCount // 0] | add // 0) | if . > 10 then 20 elif . > 5 then 15 elif . > 2 then 10 elif . > 0 then 5 else 0 end);
        def body_score: ((.body // "") | length | if . > 2000 then 15 elif . > 1000 then 12 elif . > 500 then 9 elif . > 200 then 6 elif . > 50 then 3 else 0 end);
        def crossref_score: ((.body // "") | [match("#[0-9]+"; "g")] | length | if . > 3 then 15 elif . > 1 then 10 elif . > 0 then 5 else 0 end);
        def author_score: (if (.author.login // "") as $author | ($maintainers | split(" ") | any(. == $author)) then 15 elif (.author.type // "") == "Bot" then 2 else 8 end);
        def label_score: (
            [.labels[]?.name // empty] |
            map(
                if . == "bug" then 8
                elif . == "security" then 10
                elif . == "enhancement" or . == "feature" then 6
                elif . == "breaking-change" then 9
                elif . == "rfc" then 8
                elif . == "documentation" then 3
                elif . == "question" then 2
                else 3 end
            ) |
            add // 0 |
            if . > 10 then 10 else . end
        );

        # Calculate total score
        (comment_score + reaction_score + body_score + crossref_score + author_score + label_score) as $score |

        # Determine tier
        (if $score >= 70 then "high" elif $score >= 40 then "medium" else "low" end) as $tier |

        # Add to object
        . + {
            significance_score: $score,
            significance_tier: $tier,
            comments_count: (.comments // 0),
            reactions_count: ([.reactionGroups[]?.users.totalCount // 0] | add // 0)
        }
    '
}

# Fetch all issues from GitHub
fetch_issues() {
    local since="$1"
    local filter=""

    if [[ -n "$since" ]]; then
        filter="updated:>=$since"
    fi

    echo "Fetching issues from $REPO..." >&2

    gh issue list --repo "$REPO" --state all --limit 5000 \
        --json number,title,state,author,createdAt,updatedAt,body,labels,comments,reactionGroups,assignees,milestone \
        ${filter:+--search "$filter"} | \
    jq -c --arg maintainers "$KNOWN_MAINTAINERS" '
        # comments is an array, not a count - use length
        def comment_score: ((.comments // []) | length | if . > 10 then 25 elif . > 5 then 20 elif . > 2 then 15 elif . > 0 then 10 else 0 end);
        def reaction_score: (([.reactionGroups[]?.users.totalCount // 0] | add // 0) | if . > 10 then 20 elif . > 5 then 15 elif . > 2 then 10 elif . > 0 then 5 else 0 end);
        def body_score: ((.body // "") | length | if . > 2000 then 15 elif . > 1000 then 12 elif . > 500 then 9 elif . > 200 then 6 elif . > 50 then 3 else 0 end);
        def crossref_score: ((.body // "") | [match("#[0-9]+"; "g")] | length | if . > 3 then 15 elif . > 1 then 10 elif . > 0 then 5 else 0 end);
        def author_score: (if (.author.login // "") as $a | ($maintainers | split(" ") | any(. == $a)) then 15 elif (.author.type // "") == "Bot" then 2 else 8 end);
        def label_score: ([.labels[]?.name // empty] | map(if . == "bug" then 8 elif . == "security" then 10 elif . == "enhancement" or . == "feature" then 6 elif . == "breaking-change" then 9 elif . == "rfc" then 8 elif . == "documentation" then 3 elif . == "question" then 2 else 3 end) | add // 0 | if . > 10 then 10 else . end);
        .[] |
        (comment_score + reaction_score + body_score + crossref_score + author_score + label_score) as $score |
        (if $score >= 70 then "high" elif $score >= 40 then "medium" else "low" end) as $tier |
        . + {significance_score: $score, significance_tier: $tier, comments_count: ((.comments // []) | length), reactions_count: ([.reactionGroups[]?.users.totalCount // 0] | add // 0)}
    '
}

# Fetch all PRs from GitHub
fetch_prs() {
    local since="$1"
    local filter=""

    if [[ -n "$since" ]]; then
        filter="updated:>=$since"
    fi

    echo "Fetching PRs from $REPO..." >&2

    gh pr list --repo "$REPO" --state all --limit 5000 \
        --json number,title,state,author,createdAt,updatedAt,body,labels,comments,reactionGroups,assignees,milestone,mergeable,reviewDecision \
        ${filter:+--search "$filter"} | \
    jq -c --arg maintainers "$KNOWN_MAINTAINERS" '
        # comments is an array, not a count - use length
        def comment_score: ((.comments // []) | length | if . > 10 then 25 elif . > 5 then 20 elif . > 2 then 15 elif . > 0 then 10 else 0 end);
        def reaction_score: (([.reactionGroups[]?.users.totalCount // 0] | add // 0) | if . > 10 then 20 elif . > 5 then 15 elif . > 2 then 10 elif . > 0 then 5 else 0 end);
        def body_score: ((.body // "") | length | if . > 2000 then 15 elif . > 1000 then 12 elif . > 500 then 9 elif . > 200 then 6 elif . > 50 then 3 else 0 end);
        def crossref_score: ((.body // "") | [match("#[0-9]+"; "g")] | length | if . > 3 then 15 elif . > 1 then 10 elif . > 0 then 5 else 0 end);
        def author_score: (if (.author.login // "") as $a | ($maintainers | split(" ") | any(. == $a)) then 15 elif (.author.type // "") == "Bot" then 2 else 8 end);
        def label_score: ([.labels[]?.name // empty] | map(if . == "bug" then 8 elif . == "security" then 10 elif . == "enhancement" or . == "feature" then 6 elif . == "breaking-change" then 9 elif . == "rfc" then 8 elif . == "documentation" then 3 elif . == "question" then 2 else 3 end) | add // 0 | if . > 10 then 10 else . end);
        .[] |
        (comment_score + reaction_score + body_score + crossref_score + author_score + label_score) as $score |
        (if $score >= 70 then "high" elif $score >= 40 then "medium" else "low" end) as $tier |
        . + {significance_score: $score, significance_tier: $tier, comments_count: ((.comments // []) | length), reactions_count: ([.reactionGroups[]?.users.totalCount // 0] | add // 0)}
    '
}

# Fetch all discussions from GitHub (requires GraphQL)
fetch_discussions() {
    echo "Fetching discussions from $REPO..." >&2

    gh api graphql --paginate -f query='
        query($cursor: String) {
            repository(owner: "steveyegge", name: "gastown") {
                discussions(first: 100, after: $cursor) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        id
                        number
                        title
                        body
                        createdAt
                        updatedAt
                        author { login }
                        category { name }
                        comments { totalCount }
                        upvoteCount
                        answerChosenAt
                        locked
                    }
                }
            }
        }
    ' | jq -c --arg maintainers "$KNOWN_MAINTAINERS" '
        .data.repository.discussions.nodes[]? |
        # Significance scoring for discussions
        ((.comments.totalCount // 0) | if . > 10 then 25 elif . > 5 then 20 elif . > 2 then 15 elif . > 0 then 10 else 0 end) as $comment_score |
        ((.upvoteCount // 0) | if . > 10 then 20 elif . > 5 then 15 elif . > 2 then 10 elif . > 0 then 5 else 0 end) as $reaction_score |
        ((.body // "") | length | if . > 2000 then 15 elif . > 1000 then 12 elif . > 500 then 9 elif . > 200 then 6 elif . > 50 then 3 else 0 end) as $body_score |
        ((.body // "") | [match("#[0-9]+"; "g")] | length | if . > 3 then 15 elif . > 1 then 10 elif . > 0 then 5 else 0 end) as $crossref_score |
        (if (.author.login // "") as $a | ($maintainers | split(" ") | any(. == $a)) then 15 else 8 end) as $author_score |
        # Category weight: Announcements and Ideas get higher weight
        (if .category.name == "Announcements" then 10 elif .category.name == "Ideas" then 8 elif .category.name == "Q&A" then 6 else 4 end) as $category_score |
        ($comment_score + $reaction_score + $body_score + $crossref_score + $author_score + $category_score) as $score |
        (if $score >= 70 then "high" elif $score >= 40 then "medium" else "low" end) as $tier |
        {
            id,
            number,
            title,
            body,
            author: .author.login,
            category: .category.name,
            createdAt,
            updatedAt,
            comments_count: (.comments.totalCount // 0),
            upvotes: (.upvoteCount // 0),
            answered: (.answerChosenAt != null),
            locked,
            significance_score: $score,
            significance_tier: $tier
        }
    '
}

# Full sync - fetch everything
cmd_full() {
    echo "Starting full sync of $REPO..."
    init_config
    mkdir -p "$REPO_DIR"

    local errors=0

    # Fetch issues
    echo "Fetching all issues..."
    if fetch_issues "" > "$REPO_DIR/issues.jsonl.tmp"; then
        mv "$REPO_DIR/issues.jsonl.tmp" "$REPO_DIR/issues.jsonl"
        local issue_count=$(wc -l < "$REPO_DIR/issues.jsonl")
        echo "✓ Archived $issue_count issues"
        if [[ $issue_count -eq 0 ]]; then
            echo "⚠ WARNING: 0 issues fetched - check API access" >&2
            errors=$((errors + 1))
        fi
    else
        echo "✗ ERROR: Failed to fetch issues" >&2
        rm -f "$REPO_DIR/issues.jsonl.tmp"
        errors=$((errors + 1))
        local issue_count=0
    fi

    # Fetch PRs
    echo "Fetching all PRs..."
    if fetch_prs "" > "$REPO_DIR/prs.jsonl.tmp"; then
        mv "$REPO_DIR/prs.jsonl.tmp" "$REPO_DIR/prs.jsonl"
        local pr_count=$(wc -l < "$REPO_DIR/prs.jsonl")
        echo "✓ Archived $pr_count PRs"
        if [[ $pr_count -eq 0 ]]; then
            echo "⚠ WARNING: 0 PRs fetched - check API access" >&2
            errors=$((errors + 1))
        fi
    else
        echo "✗ ERROR: Failed to fetch PRs" >&2
        rm -f "$REPO_DIR/prs.jsonl.tmp"
        errors=$((errors + 1))
        local pr_count=0
    fi

    # Fetch discussions
    echo "Fetching all discussions..."
    if fetch_discussions > "$REPO_DIR/discussions.jsonl.tmp"; then
        mv "$REPO_DIR/discussions.jsonl.tmp" "$REPO_DIR/discussions.jsonl"
        local disc_count=$(wc -l < "$REPO_DIR/discussions.jsonl")
        echo "✓ Archived $disc_count discussions"
    else
        echo "⚠ WARNING: Failed to fetch discussions (may require different auth)" >&2
        rm -f "$REPO_DIR/discussions.jsonl.tmp"
        local disc_count=0
    fi

    # Update config
    local now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    jq --arg ts "$now" --argjson ic "$issue_count" --argjson pc "$pr_count" --argjson dc "$disc_count" \
        '.repos["steveyegge/gastown"].last_sync = $ts |
         .repos["steveyegge/gastown"].issues_count = $ic |
         .repos["steveyegge/gastown"].prs_count = $pc |
         .repos["steveyegge/gastown"].discussions_count = $dc' \
        "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

    echo ""
    if [[ $errors -gt 0 ]]; then
        echo "Full sync completed with $errors error(s). Last sync: $now"
        return 1
    else
        echo "Full sync complete. Last sync: $now"
    fi
}

# Incremental sync - fetch only updated items
cmd_sync() {
    init_config

    local last_sync=$(jq -r '.repos["steveyegge/gastown"].last_sync // empty' "$CONFIG_FILE")

    if [[ -z "$last_sync" || "$last_sync" == "null" ]]; then
        echo "No previous sync found. Running full sync..."
        cmd_full
        return
    fi

    # Convert to date format for gh search
    local since_date=$(date -d "$last_sync" +"%Y-%m-%d" 2>/dev/null || echo "$last_sync" | cut -d'T' -f1)

    echo "Incremental sync since $since_date..."

    # Fetch updated issues
    local new_issues=$(fetch_issues "$since_date")
    local new_issue_count=$(echo "$new_issues" | grep -c '^{' || echo 0)

    if [[ $new_issue_count -gt 0 ]]; then
        # Merge: remove old versions, add new
        local issue_numbers=$(echo "$new_issues" | jq -r '.number' | tr '\n' '|' | sed 's/|$//')
        if [[ -f "$REPO_DIR/issues.jsonl" ]]; then
            grep -vE "\"number\":($issue_numbers)" "$REPO_DIR/issues.jsonl" > "$REPO_DIR/issues.jsonl.tmp" 2>/dev/null || true
            echo "$new_issues" >> "$REPO_DIR/issues.jsonl.tmp"
            mv "$REPO_DIR/issues.jsonl.tmp" "$REPO_DIR/issues.jsonl"
        else
            echo "$new_issues" > "$REPO_DIR/issues.jsonl"
        fi
        echo "Updated $new_issue_count issues"
    else
        echo "No issue updates"
    fi

    # Fetch updated PRs
    local new_prs=$(fetch_prs "$since_date")
    local new_pr_count=$(echo "$new_prs" | grep -c '^{' || echo 0)

    if [[ $new_pr_count -gt 0 ]]; then
        local pr_numbers=$(echo "$new_prs" | jq -r '.number' | tr '\n' '|' | sed 's/|$//')
        if [[ -f "$REPO_DIR/prs.jsonl" ]]; then
            grep -vE "\"number\":($pr_numbers)" "$REPO_DIR/prs.jsonl" > "$REPO_DIR/prs.jsonl.tmp" 2>/dev/null || true
            echo "$new_prs" >> "$REPO_DIR/prs.jsonl.tmp"
            mv "$REPO_DIR/prs.jsonl.tmp" "$REPO_DIR/prs.jsonl"
        else
            echo "$new_prs" > "$REPO_DIR/prs.jsonl"
        fi
        echo "Updated $new_pr_count PRs"
    else
        echo "No PR updates"
    fi

    # Update config
    local now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local total_issues=$(wc -l < "$REPO_DIR/issues.jsonl" 2>/dev/null || echo 0)
    local total_prs=$(wc -l < "$REPO_DIR/prs.jsonl" 2>/dev/null || echo 0)

    jq --arg ts "$now" --argjson ic "$total_issues" --argjson pc "$total_prs" \
        '.repos["steveyegge/gastown"].last_sync = $ts |
         .repos["steveyegge/gastown"].issues_count = $ic |
         .repos["steveyegge/gastown"].prs_count = $pc' \
        "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

    echo "Sync complete. Last sync: $now"
}

# Show archive statistics
cmd_stats() {
    init_config

    echo "=== GitHub Archive Statistics ==="
    echo ""

    local last_sync=$(jq -r '.repos["steveyegge/gastown"].last_sync // "never"' "$CONFIG_FILE")
    echo "Repository: $REPO"
    echo "Last sync:  $last_sync"
    echo ""

    if [[ -f "$REPO_DIR/issues.jsonl" ]]; then
        local total_issues=$(wc -l < "$REPO_DIR/issues.jsonl")
        local high_issues=$(jq -s '[.[] | select(.significance_tier == "high")] | length' "$REPO_DIR/issues.jsonl")
        local medium_issues=$(jq -s '[.[] | select(.significance_tier == "medium")] | length' "$REPO_DIR/issues.jsonl")
        local low_issues=$(jq -s '[.[] | select(.significance_tier == "low")] | length' "$REPO_DIR/issues.jsonl")
        local open_issues=$(jq -s '[.[] | select(.state == "OPEN" or .state == "open")] | length' "$REPO_DIR/issues.jsonl")

        echo "Issues: $total_issues total ($open_issues open)"
        echo "  - High significance:   $high_issues"
        echo "  - Medium significance: $medium_issues"
        echo "  - Low significance:    $low_issues"
    else
        echo "Issues: not synced"
    fi
    echo ""

    if [[ -f "$REPO_DIR/prs.jsonl" ]]; then
        local total_prs=$(wc -l < "$REPO_DIR/prs.jsonl")
        local high_prs=$(jq -s '[.[] | select(.significance_tier == "high")] | length' "$REPO_DIR/prs.jsonl")
        local medium_prs=$(jq -s '[.[] | select(.significance_tier == "medium")] | length' "$REPO_DIR/prs.jsonl")
        local low_prs=$(jq -s '[.[] | select(.significance_tier == "low")] | length' "$REPO_DIR/prs.jsonl")
        local open_prs=$(jq -s '[.[] | select(.state == "OPEN" or .state == "open")] | length' "$REPO_DIR/prs.jsonl")

        echo "PRs: $total_prs total ($open_prs open)"
        echo "  - High significance:   $high_prs"
        echo "  - Medium significance: $medium_prs"
        echo "  - Low significance:    $low_prs"
    else
        echo "PRs: not synced"
    fi
    echo ""

    if [[ -f "$REPO_DIR/discussions.jsonl" ]]; then
        local total_disc=$(wc -l < "$REPO_DIR/discussions.jsonl")
        local high_disc=$(jq -s '[.[] | select(.significance_tier == "high")] | length' "$REPO_DIR/discussions.jsonl")
        local medium_disc=$(jq -s '[.[] | select(.significance_tier == "medium")] | length' "$REPO_DIR/discussions.jsonl")
        local low_disc=$(jq -s '[.[] | select(.significance_tier == "low")] | length' "$REPO_DIR/discussions.jsonl")

        echo "Discussions: $total_disc total"
        echo "  - High significance:   $high_disc"
        echo "  - Medium significance: $medium_disc"
        echo "  - Low significance:    $low_disc"
    else
        echo "Discussions: not synced"
    fi

    echo ""
    local archive_size=$(du -sh "$REPO_DIR" 2>/dev/null | cut -f1)
    echo "Archive size: $archive_size"
}

# Show top N significant items
cmd_top() {
    local n=${1:-10}

    echo "=== Top $n Most Significant Items ==="
    echo ""

    # Combine issues, prs, and discussions, sort by significance
    {
        [[ -f "$REPO_DIR/issues.jsonl" ]] && jq -c '. + {type: "issue"}' "$REPO_DIR/issues.jsonl"
        [[ -f "$REPO_DIR/prs.jsonl" ]] && jq -c '. + {type: "pr"}' "$REPO_DIR/prs.jsonl"
        [[ -f "$REPO_DIR/discussions.jsonl" ]] && jq -c '. + {type: "disc"}' "$REPO_DIR/discussions.jsonl"
    } | jq -s "sort_by(-.significance_score) | .[:$n]" | \
    jq -r '.[] | "\(.significance_score | tostring | if length < 2 then " " + . else . end) [\(.significance_tier | .[0:1] | ascii_upcase)] #\(.number) [\(.type)] \(.title | .[0:60])"'
}

# Show recent high-significance items
cmd_recent() {
    local days=${1:-7}
    local cutoff=$(date -d "$days days ago" -u +"%Y-%m-%dT%H:%M:%SZ")

    echo "=== High-Significance Items (Last $days Days) ==="
    echo ""

    {
        [[ -f "$REPO_DIR/issues.jsonl" ]] && jq -c '. + {type: "issue"}' "$REPO_DIR/issues.jsonl"
        [[ -f "$REPO_DIR/prs.jsonl" ]] && jq -c '. + {type: "pr"}' "$REPO_DIR/prs.jsonl"
        [[ -f "$REPO_DIR/discussions.jsonl" ]] && jq -c '. + {type: "disc"}' "$REPO_DIR/discussions.jsonl"
    } | jq -s --arg cutoff "$cutoff" '
        [.[] | select(.updatedAt >= $cutoff and .significance_tier != "low")] |
        sort_by(-.significance_score)
    ' | jq -r '.[] | "\(.significance_score | tostring | if length < 2 then " " + . else . end) [\(.significance_tier | .[0:1] | ascii_upcase)] #\(.number) [\(.type)] \(.title | .[0:60])"'
}

# Show usage
cmd_help() {
    cat << EOF
gh-archive.sh - Archive GitHub Issues and PRs with significance scoring

Usage: gh-archive.sh <command> [args]

Commands:
  sync              Incremental sync (only new/updated items)
  full              Full re-sync of all items
  stats             Show archive statistics
  top [n]           Show top N significant items (default: 10)
  recent [days]     Show recent high-significance items (default: 7 days)
  help              Show this help message

Significance Scoring:
  Items are scored 0-100 based on:
  - Comment count (25 pts max)
  - Reaction count (20 pts max)
  - Body length (15 pts max)
  - Cross-references (15 pts max)
  - Author type (15 pts max)
  - Label weight (10 pts max)

  Tiers: High (70+), Medium (40-69), Low (<40)

Examples:
  gh-archive.sh full          # Initial sync
  gh-archive.sh sync          # Daily incremental sync
  gh-archive.sh top 20        # Show top 20 items
  gh-archive.sh recent 3      # Items updated in last 3 days
EOF
}

# Sample fetch - just 10 items from each for testing
cmd_sample() {
    local n=${1:-10}
    echo "=== Sample Fetch ($n items each) ==="

    echo ""
    echo "--- ISSUES (top $n by recent activity) ---"
    gh issue list --repo "$REPO" --state all --limit "$n" \
        --json number,title,state,author,createdAt,comments,body | \
    jq -r '.[] | "#\(.number) [\(.state)] \(.title | .[0:50])... (comments: \(.comments | length))"'

    echo ""
    echo "--- PRs (top $n by recent activity) ---"
    gh pr list --repo "$REPO" --state all --limit "$n" \
        --json number,title,state,author,createdAt,comments | \
    jq -r '.[] | "#\(.number) [\(.state)] \(.title | .[0:50])... (comments: \(.comments | length))"'

    echo ""
    echo "--- DISCUSSIONS (top $n) ---"
    gh api graphql -f query='
        query {
            repository(owner: "steveyegge", name: "gastown") {
                discussions(first: '$n', orderBy: {field: UPDATED_AT, direction: DESC}) {
                    nodes { number title category { name } comments { totalCount } upvoteCount }
                }
            }
        }
    ' | jq -r '.data.repository.discussions.nodes[] | "#\(.number) [\(.category.name)] \(.title | .[0:50])... (comments: \(.comments.totalCount), upvotes: \(.upvoteCount))"'
}

# Main dispatch
case "${1:-help}" in
    sync)   cmd_sync ;;
    full)   cmd_full ;;
    sample) cmd_sample "${2:-10}" ;;
    stats)  cmd_stats ;;
    top)    cmd_top "${2:-10}" ;;
    recent) cmd_recent "${2:-7}" ;;
    help|--help|-h) cmd_help ;;
    *)
        echo "Unknown command: $1" >&2
        cmd_help
        exit 1
        ;;
esac
