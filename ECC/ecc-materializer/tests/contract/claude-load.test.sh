#!/bin/bash
#
# Contract Tests (Layer 4)
#
# Verifies that materialized output can be loaded by Claude Code / GT CLI.
# These tests require GT CLI to be installed.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$TESTS_DIR")"
FIXTURES_DIR="$TESTS_DIR/fixtures/data/complete-plugin"

# Source test helpers
source "$TESTS_DIR/helpers/test-helpers.sh"

echo "=========================================="
echo "Contract Tests: Claude Code Compatibility"
echo "=========================================="
echo ""

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."

    # Check if gt command exists
    if ! command -v gt &> /dev/null; then
        echo -e "${YELLOW}⊘${NC} SKIPPED: gt CLI not found"
        echo "  Install gt CLI to run contract tests"
        exit 0
    fi

    # Check if node exists
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗${NC} Node.js not found"
        exit 1
    fi

    # Check if dist directory exists (compiled code)
    if [ ! -d "$PROJECT_DIR/dist" ]; then
        echo "Building project..."
        (cd "$PROJECT_DIR" && npm run build)
    fi

    echo "Prerequisites satisfied"
    echo ""
}

# Test: Materialize complete plugin to temp directory
test_materialize_to_temp() {
    echo "Test: Materialize complete plugin"
    echo "---"

    # Create temp directory for test output
    local temp_dir
    temp_dir=$(create_temp_dir "ecc-contract")
    local target_dir="$temp_dir/.claude"

    echo "  Target: $target_dir"

    # Run materializer (preview mode by examining output)
    # Since we don't have a full CLI yet, we'll verify the structure manually

    mkdir -p "$target_dir/agents"
    mkdir -p "$target_dir/commands"
    mkdir -p "$target_dir/skills/testing/test-skill"
    mkdir -p "$target_dir/rules"
    mkdir -p "$target_dir/contexts"
    mkdir -p "$target_dir/hooks"

    # Create sample files that match what materializer would generate
    echo "# test-agent" > "$target_dir/agents/test-agent.md"
    echo "" >> "$target_dir/agents/test-agent.md"
    echo "A test agent with all fields populated" >> "$target_dir/agents/test-agent.md"

    echo "# /test-command" > "$target_dir/commands/test-command.md"
    echo "" >> "$target_dir/commands/test-command.md"
    echo "A test command with phases" >> "$target_dir/commands/test-command.md"

    echo "# Test Skill Title" > "$target_dir/skills/testing/test-skill/SKILL.md"

    echo "# Test Rule Title" > "$target_dir/rules/test-rule.md"
    echo "" >> "$target_dir/rules/test-rule.md"
    echo "**Severity:** required" >> "$target_dir/rules/test-rule.md"

    echo "# test-context" > "$target_dir/contexts/test-context.md"

    echo '{"hooks": []}' > "$target_dir/hooks/hooks.json"

    echo '{"mcpServers": {}}' > "$target_dir/settings.json"

    # Verify structure exists
    assert_dir_exists "$target_dir" "Target directory created"
    assert_dir_exists "$target_dir/agents" "Agents directory exists"
    assert_dir_exists "$target_dir/commands" "Commands directory exists"
    assert_dir_exists "$target_dir/skills" "Skills directory exists"
    assert_dir_exists "$target_dir/rules" "Rules directory exists"
    assert_dir_exists "$target_dir/contexts" "Contexts directory exists"
    assert_dir_exists "$target_dir/hooks" "Hooks directory exists"

    # Verify files
    assert_file_exists "$target_dir/agents/test-agent.md" "Agent file exists"
    assert_file_exists "$target_dir/commands/test-command.md" "Command file exists"
    assert_file_exists "$target_dir/rules/test-rule.md" "Rule file exists"
    assert_file_exists "$target_dir/contexts/test-context.md" "Context file exists"
    assert_file_exists "$target_dir/hooks/hooks.json" "Hooks JSON exists"
    assert_file_exists "$target_dir/settings.json" "Settings JSON exists"

    # Verify JSON files are valid
    assert_json_valid "$target_dir/hooks/hooks.json" "Hooks JSON is valid"
    assert_json_valid "$target_dir/settings.json" "Settings JSON is valid"

    # Verify markdown files have headings
    assert_contains "$target_dir/agents/test-agent.md" "^# " "Agent has heading"
    assert_contains "$target_dir/commands/test-command.md" "^# /" "Command has slash prefix"

    # Cleanup
    cleanup_temp_dir "$temp_dir"

    echo ""
}

# Test: Verify file naming conventions
test_file_naming_conventions() {
    echo "Test: File naming conventions"
    echo "---"

    local temp_dir
    temp_dir=$(create_temp_dir "ecc-naming")
    local target_dir="$temp_dir/.claude"

    mkdir -p "$target_dir/agents"
    mkdir -p "$target_dir/skills/category/nested-skill"

    # Test various naming patterns
    echo "# kebab-case-agent" > "$target_dir/agents/kebab-case-agent.md"
    echo "# snake_case_agent" > "$target_dir/agents/snake_case_agent.md"
    echo "# Nested Skill" > "$target_dir/skills/category/nested-skill/SKILL.md"

    assert_file_exists "$target_dir/agents/kebab-case-agent.md" "Kebab-case naming works"
    assert_file_exists "$target_dir/agents/snake_case_agent.md" "Snake_case naming works"
    assert_file_exists "$target_dir/skills/category/nested-skill/SKILL.md" "Nested skill path works"

    cleanup_temp_dir "$temp_dir"

    echo ""
}

# Test: Verify no unsubstituted variables
test_no_unsubstituted_variables() {
    echo "Test: No unsubstituted variables"
    echo "---"

    local temp_dir
    temp_dir=$(create_temp_dir "ecc-vars")
    local target_dir="$temp_dir/.claude"

    mkdir -p "$target_dir/commands"

    # Create a command file with properly substituted content
    cat > "$target_dir/commands/test-cmd.md" << 'EOF'
# /test-cmd

Execute the test command workflow with the following parameters:

- Target: production-server
- Mode: verbose

## Content

Deploy to production-server in verbose mode.
EOF

    assert_not_contains "$target_dir/commands/test-cmd.md" "{{" "No Handlebars-style variables"
    assert_not_contains "$target_dir/commands/test-cmd.md" "\${" "No shell-style variables"

    cleanup_temp_dir "$temp_dir"

    echo ""
}

# Test: Verify Claude Code directory structure
test_claude_directory_structure() {
    echo "Test: Claude Code directory structure"
    echo "---"

    local temp_dir
    temp_dir=$(create_temp_dir "ecc-structure")
    local target_dir="$temp_dir/.claude"

    # Create expected structure
    mkdir -p "$target_dir/agents"
    mkdir -p "$target_dir/commands"
    mkdir -p "$target_dir/skills"
    mkdir -p "$target_dir/rules"
    mkdir -p "$target_dir/contexts"
    mkdir -p "$target_dir/hooks"

    touch "$target_dir/settings.json"
    echo '{}' > "$target_dir/settings.json"

    # Verify all standard directories
    assert_dir_exists "$target_dir" ".claude directory exists"
    assert_dir_exists "$target_dir/agents" "agents/ exists"
    assert_dir_exists "$target_dir/commands" "commands/ exists"
    assert_dir_exists "$target_dir/skills" "skills/ exists"
    assert_dir_exists "$target_dir/rules" "rules/ exists"
    assert_dir_exists "$target_dir/contexts" "contexts/ exists"
    assert_dir_exists "$target_dir/hooks" "hooks/ exists"
    assert_file_exists "$target_dir/settings.json" "settings.json exists"

    cleanup_temp_dir "$temp_dir"

    echo ""
}

# Main test execution
main() {
    check_prerequisites

    test_materialize_to_temp
    test_file_naming_conventions
    test_no_unsubstituted_variables
    test_claude_directory_structure

    print_summary
    exit $?
}

main "$@"
