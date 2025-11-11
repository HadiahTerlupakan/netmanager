#!/bin/bash

# Database Restore Script untuk NetManager
# 
# Usage:
#   ./scripts/restore-db.sh backup_file.sql.gz
#
# Environment variables:
#   POSTGRES_USER     - Database user (default: netmgr)
#   POSTGRES_PASSWORD - Database password (default: netmgr)
#   POSTGRES_DB       - Database name (default: netmanager)
#   POSTGRES_HOST     - Database host (default: localhost)
#   POSTGRES_PORT     - Database port (default: 5433)

set -e  # Exit on error

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo "Example: $0 ./backups/netmanager_backup_20240101_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Default values
POSTGRES_USER=${POSTGRES_USER:-netmgr}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-netmgr}
POSTGRES_DB=${POSTGRES_DB:-netmanager}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5433}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠ WARNING: This will replace the current database!${NC}"
echo "Database: $POSTGRES_DB"
echo "Host: $POSTGRES_HOST:$POSTGRES_PORT"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo -e "${GREEN}Starting database restore...${NC}"

# Set PGPASSWORD untuk psql
export PGPASSWORD="$POSTGRES_PASSWORD"

# Check if database exists, if not create it
if psql -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -lqt | cut -d \| -f 1 | grep -qw "$POSTGRES_DB"; then
  echo "Database $POSTGRES_DB exists, dropping..."
  dropdb -h "$POSTGRES_HOST" \
         -p "$POSTGRES_PORT" \
         -U "$POSTGRES_USER" \
         "$POSTGRES_DB" || true
fi

# Restore from compressed backup
if gunzip -c "$BACKUP_FILE" | psql -h "$POSTGRES_HOST" \
                                    -p "$POSTGRES_PORT" \
                                    -U "$POSTGRES_USER" \
                                    -d postgres \
                                    2>&1; then
  echo -e "${GREEN}✓ Restore completed successfully!${NC}"
  echo "Database $POSTGRES_DB has been restored from $BACKUP_FILE"
  exit 0
else
  echo -e "${RED}✗ Restore failed!${NC}"
  exit 1
fi

