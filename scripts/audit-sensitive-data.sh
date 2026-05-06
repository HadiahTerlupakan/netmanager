#!/bin/bash

# Security Audit Script - Check for Sensitive Data Exposure in DTOs
# Date: 2026-05-06

echo "=========================================="
echo "Security Audit: Sensitive Data Exposure"
echo "=========================================="
echo ""

# Define sensitive field patterns
SENSITIVE_PATTERNS=(
  "password"
  "passwordHash"
  "token"
  "secret"
  "apiKey"
  "privateKey"
  "bankAccount"
  "creditCard"
  "cvv"
  "pin"
  "otp"
  "fcmToken"
  "pushToken"
  "sessionToken"
  "refreshToken"
  "accessToken"
  "authToken"
  "basicSalary"
  "salary"
  "gaji"
  "upah"
  "bpjs"
  "npwp"
  "nik"
  "ktp"
)

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
ISSUES_FOUND=0

echo "Scanning DTO files for sensitive field exposure..."
echo ""

# Find all DTO files
DTO_FILES=$(find modules -type f -name "*DTO.ts")

for file in $DTO_FILES; do
  TOTAL_FILES=$((TOTAL_FILES + 1))
  FILE_HAS_ISSUE=0

  # Check each sensitive pattern
  for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    # Search for the pattern in interface definitions (not in comments)
    matches=$(grep -n "^\s*${pattern}" "$file" | grep -v "//")

    if [ ! -z "$matches" ]; then
      if [ $FILE_HAS_ISSUE -eq 0 ]; then
        echo -e "${RED}⚠️  POTENTIAL ISSUE: $file${NC}"
        FILE_HAS_ISSUE=1
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
      fi
      echo -e "${YELLOW}   Line: $matches${NC}"
    fi
  done

  if [ $FILE_HAS_ISSUE -eq 1 ]; then
    echo ""
  fi
done

echo "=========================================="
echo "Summary:"
echo "  Total DTO files scanned: $TOTAL_FILES"
echo "  Files with potential issues: $ISSUES_FOUND"
echo "=========================================="

if [ $ISSUES_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ No sensitive data exposure detected!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Please review the files above manually${NC}"
  exit 1
fi
