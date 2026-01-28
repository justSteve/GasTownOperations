#!/bin/bash
#
# Run Fast Tests (Layers 1-2)
#
# Validators and Unit tests - expected to complete in ~2 minutes
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "ECC Materializer - Fast Tests"
echo "Layers 1-2: Validators + Unit Tests"
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
echo "=========================================="
echo "Fast Tests Complete"
echo "=========================================="
