#!/bin/bash

# Script to capture Prisma validation errors as test fixtures
# Usage: ./scripts/capture-prisma-errors.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMAS_DIR="$PROJECT_ROOT/server/src/lib/__tests__/fixtures/prisma-schemas"
ERRORS_DIR="$PROJECT_ROOT/server/src/lib/__tests__/fixtures/prisma-errors"

echo "📝 Capturing Prisma validation errors..."
echo ""

# Create output directory if it doesn't exist
mkdir -p "$ERRORS_DIR"

# Counter for processed schemas
processed=0
errors=0

# Loop through all .prisma files in the schemas directory
for schema in "$SCHEMAS_DIR"/*.prisma; do
  if [ -f "$schema" ]; then
    # Extract filename without extension
    filename=$(basename "$schema" .prisma)
    output_file="$ERRORS_DIR/${filename}.txt"

    echo "🔍 Validating: $filename.prisma"

    # Run prisma validate and capture output (both stdout and stderr)
    # Use || true to continue even if validation fails
    npx prisma validate --schema="$schema" > "$output_file" 2>&1 || true

    # Check if output was captured
    if [ -s "$output_file" ]; then
      echo "   ✓ Captured error to: $(basename "$output_file")"
      ((processed++))
    else
      echo "   ⚠ No output (schema may be valid)"
      rm "$output_file"  # Remove empty file
      ((errors++))
    fi
    echo ""
  fi
done

echo "✨ Complete!"
echo "   Processed: $processed schemas"
if [ $errors -gt 0 ]; then
  echo "   Skipped: $errors schemas (no errors found)"
fi
echo ""
echo "Fixtures saved to: $ERRORS_DIR"
