#!/bin/bash

# Database Backup Script untuk NetManager
# 
# Usage:
#   ./scripts/backup-db.sh                    # Backup ke default location
#   ./scripts/backup-db.sh /path/to/backup   # Backup ke custom location
#
# Environment variables:
#   POSTGRES_USER     - Database user (default: netmgr)
#   POSTGRES_PASSWORD - Database password (default: netmgr)
#   POSTGRES_DB       - Database name (default: netmanager)
#   POSTGRES_HOST     - Database host (default: localhost)
#   POSTGRES_PORT     - Database port (default: 5433)

set -e  # Exit on error

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

# Backup directory
BACKUP_DIR=${1:-./backups}
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/netmanager_backup_${TIMESTAMP}.sql"
BACKUP_FILE_COMPRESSED="$BACKUP_FILE.gz"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting database backup...${NC}"
echo "Database: $POSTGRES_DB"
echo "Host: $POSTGRES_HOST:$POSTGRES_PORT"
echo "Backup file: $BACKUP_FILE_COMPRESSED"

# Set PGPASSWORD untuk pg_dump
export PGPASSWORD="$POSTGRES_PASSWORD"

# Create backup
if pg_dump -h "$POSTGRES_HOST" \
           -p "$POSTGRES_PORT" \
           -U "$POSTGRES_USER" \
           -d "$POSTGRES_DB" \
           --clean \
           --if-exists \
           --create \
           --format=plain \
           --no-owner \
           --no-privileges \
           > "$BACKUP_FILE" 2>&1; then
  
  # Compress backup
  gzip "$BACKUP_FILE"
  
  # Get file size
  FILE_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
  
  echo -e "${GREEN}✓ Backup completed successfully!${NC}"
  echo "  File: $BACKUP_FILE_COMPRESSED"
  echo "  Size: $FILE_SIZE"
  
  # Keep only last 30 backups (optional)
  if [ -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Cleaning old backups (keeping last 30)...${NC}"
    ls -t "$BACKUP_DIR"/netmanager_backup_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
    echo -e "${GREEN}✓ Cleanup completed${NC}"
  fi
  
  exit 0
else
  echo -e "${RED}✗ Backup failed!${NC}"
  rm -f "$BACKUP_FILE"
  exit 1
fi

