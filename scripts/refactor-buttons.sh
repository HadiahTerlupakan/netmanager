#!/bin/bash

# Script untuk refactor button manual ke shared button system
# Usage: ./scripts/refactor-buttons.sh

set -e

echo "🔍 Scanning for manual button patterns..."

# Find all files with manual indigo button classes
FILES=$(rg "className.*bg-indigo-[56]00" --type-add 'tsx:*.tsx' --type-add 'ts:*.ts' -t tsx -t ts -g '!node_modules' -g '!.next' -l)

TOTAL=$(echo "$FILES" | wc -l | tr -d ' ')
echo "📊 Found $TOTAL files with manual button classes"

# Priority areas to refactor
PRIORITY_AREAS=(
  "app/admin/users"
  "app/admin/marketing"
  "app/admin/workorders"
  "app/admin/pelanggan"
  "app/admin/finance"
  "app/admin/inventory"
  "app/admin/salary"
  "app/admin/tenants"
  "app/admin/paket"
  "app/admin/pengaturan"
)

echo ""
echo "📋 Priority areas for refactor:"
for area in "${PRIORITY_AREAS[@]}"; do
  COUNT=$(echo "$FILES" | grep "$area" | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 0 ]; then
    echo "  - $area: $COUNT files"
  fi
done

echo ""
echo "⚠️  Manual refactor required for each file:"
echo "  1. Add import: import { buttonVariants } from '@/components/ui/Button'"
echo "  2. Replace manual classes with buttonVariants({ variant: 'default' })"
echo "  3. Remove redundant text-white, w-5 h-5 classes"
echo ""
echo "💡 Tip: Use global button dark mode styling from components/ui/Button.tsx"
echo "    All variant='default' buttons now auto-adapt to dark mode"
