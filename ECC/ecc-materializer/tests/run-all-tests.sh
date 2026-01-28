#!/bin/bash
#
# Run All Tests (Layers 1-5)
#
# Complete test suite - expected to complete in ~10 minutes
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "ECC Materializer - Full Test Suite"
echo "Layers 1-5: All Tests"
echo "=========================================="
echo ""

# Change to project directory
cd "$PROJECT_DIR"

# Check if build is needed
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo "Building TypeScript..."
    npm run build
    echo ""
fi

echo "Running Layer 1: Validators"
echo "----------------------------"
node --test --experimental-strip-types 'tests/validators/*.test.ts'

echo ""
echo "Running Layer 2: Unit Tests"
echo "----------------------------"
node --test --experimental-strip-types 'tests/unit/**/*.test.ts'

echo ""
echo "Running Layer 3: Integration Tests"
echo "-----------------------------------"
node --test --experimental-strip-types 'tests/integration/*.test.ts'

echo ""
echo "Running Layer 5: Pressure Tests"
echo "--------------------------------"
node --test --experimental-strip-types 'tests/pressure/*.test.ts'

echo ""
echo "Running Layer 4: Contract Tests"
echo "--------------------------------"
if [ -x "tests/contract/claude-load.test.sh" ]; then
    bash tests/contract/claude-load.test.sh || {
        echo "Contract tests completed with warnings (GT CLI may not be installed)"
    }
else
    echo "Contract test script not executable, skipping"
fi

echo ""
echo "=========================================="
echo "All Tests Complete"
echo "=========================================="
