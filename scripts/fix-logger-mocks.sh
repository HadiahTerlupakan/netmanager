#!/bin/bash

# Script untuk fix semua partial logger mock di test files

files=(
  "tests/api/mobile-inventory-authorization.test.ts"
  "tests/api/inventory-stock-by-kondisi-route.test.ts"
  "tests/modules/finance/PaymentRouteService.test.ts"
  "tests/modules/finance/services/PaymentRouteService.test.ts"
  "tests/modules/finance/services/BillingInvoiceCreationService.test.ts"
  "tests/modules/salary/services/SalaryService.test.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    # Backup original
    cp "$file" "$file.bak"

    # Replace partial mock dengan full mock
    # Pattern 1: Simple partial mock
    sed -i '' 's/vi\.mock("@\/lib\/logger", () => ({$/vi.mock("@\/lib\/logger", () => ({\
  logger: {\
    info: vi.fn(),\
    warn: vi.fn(),\
    error: vi.fn(),\
    debug: vi.fn(),\
    logActivity: vi.fn(),\
    logActivitySafe: vi.fn(),\
    logAuth: vi.fn(),\
    apiRequest: vi.fn(),\
    dbOperation: vi.fn(),\
  },/g' "$file"
  fi
done

echo "Done! Backup files created with .bak extension"
