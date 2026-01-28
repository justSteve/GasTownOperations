#!/bin/bash
#
# Shell Test Helper Functions
# Adapted from obra/superpowers testing patterns
#

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Print test result
print_result() {
    local status="$1"
    local message="$2"

    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✓${NC} $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $message"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
}

# Print summary
print_summary() {
    echo ""
    echo "======================================"
    echo -e "Tests run: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    else
        echo -e "Failed: $TESTS_FAILED"
    fi
    echo "======================================"

    if [ $TESTS_FAILED -gt 0 ]; then
        return 1
    fi
    return 0
}

# Assert file exists
assert_file_exists() {
    local file="$1"
    local message="${2:-File should exist: $file}"

    if [ -f "$file" ]; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Expected file to exist: $file"
        return 1
    fi
}

# Assert file does not exist
assert_file_not_exists() {
    local file="$1"
    local message="${2:-File should not exist: $file}"

    if [ ! -f "$file" ]; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Expected file NOT to exist: $file"
        return 1
    fi
}

# Assert directory exists
assert_dir_exists() {
    local dir="$1"
    local message="${2:-Directory should exist: $dir}"

    if [ -d "$dir" ]; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Expected directory to exist: $dir"
        return 1
    fi
}

# Assert file contains pattern
assert_contains() {
    local file="$1"
    local pattern="$2"
    local message="${3:-File should contain pattern}"

    if grep -q "$pattern" "$file" 2>/dev/null; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Expected '$file' to contain: $pattern"
        return 1
    fi
}

# Assert file does NOT contain pattern
assert_not_contains() {
    local file="$1"
    local pattern="$2"
    local message="${3:-File should not contain pattern}"

    if ! grep -q "$pattern" "$file" 2>/dev/null; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Expected '$file' NOT to contain: $pattern"
        return 1
    fi
}

# Assert pattern count in file
assert_count() {
    local file="$1"
    local pattern="$2"
    local expected_count="$3"
    local message="${4:-Pattern should occur $expected_count times}"

    local actual_count
    actual_count=$(grep -c "$pattern" "$file" 2>/dev/null || echo "0")

    if [ "$actual_count" = "$expected_count" ]; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Expected $expected_count occurrences of '$pattern', found $actual_count"
        return 1
    fi
}

# Assert JSON is valid
assert_json_valid() {
    local file="$1"
    local message="${2:-JSON should be valid: $file}"

    if jq empty "$file" 2>/dev/null; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Invalid JSON in: $file"
        return 1
    fi
}

# Assert command succeeds
assert_success() {
    local message="$1"
    shift

    if "$@" >/dev/null 2>&1; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Command failed: $*"
        return 1
    fi
}

# Assert command fails
assert_failure() {
    local message="$1"
    shift

    if ! "$@" >/dev/null 2>&1; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Expected command to fail: $*"
        return 1
    fi
}

# Assert string equals
assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Values should be equal}"

    if [ "$expected" = "$actual" ]; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Expected: $expected"
        echo "  Actual:   $actual"
        return 1
    fi
}

# Assert string not empty
assert_not_empty() {
    local value="$1"
    local message="${2:-Value should not be empty}"

    if [ -n "$value" ]; then
        print_result "pass" "$message"
        return 0
    else
        print_result "fail" "$message"
        echo "  Value is empty"
        return 1
    fi
}

# Create temporary test directory
create_temp_dir() {
    local prefix="${1:-ecc-test}"
    mktemp -d "/tmp/${prefix}.XXXXXX"
}

# Clean up temporary directory
cleanup_temp_dir() {
    local dir="$1"
    if [ -d "$dir" ] && [[ "$dir" == /tmp/* ]]; then
        rm -rf "$dir"
    fi
}

# Skip test if condition not met
skip_if() {
    local condition="$1"
    local reason="$2"

    if eval "$condition"; then
        echo -e "${YELLOW}⊘${NC} SKIPPED: $reason"
        return 0
    fi
    return 1
}

# Export functions for use in test scripts
export -f print_result print_summary
export -f assert_file_exists assert_file_not_exists assert_dir_exists
export -f assert_contains assert_not_contains assert_count
export -f assert_json_valid assert_success assert_failure
export -f assert_equals assert_not_empty
export -f create_temp_dir cleanup_temp_dir skip_if
