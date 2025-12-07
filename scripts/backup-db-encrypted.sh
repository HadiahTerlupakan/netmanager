#!/bin/bash

# Enhanced Database Backup Script with Encryption for NetManager
#
# This script creates encrypted database backups with proper retention policies
# and integrity verification.
#
# Usage:
#   ./scripts/backup-db-encrypted.sh                    # Backup with default settings
#   ./scripts/backup-db-encrypted.sh /path/to/backup   # Backup to custom location
#   ./scripts/backup-db-encrypted.sh --no-encrypt      # Backup without encryption
#   ./scripts/backup-db-encrypted.sh --verify-only     # Verify existing backup
#
# Environment variables:
#   POSTGRES_USER     - Database user (default: netmgr)
#   POSTGRES_PASSWORD - Database password (default: netmgr)
#   POSTGRES_DB       - Database name (default: netmanager)
#   POSTGRES_HOST     - Database host (default: localhost)
#   POSTGRES_PORT     - Database port (default: 5433)
#   BACKUP_ENCRYPTION_KEY - Encryption key (required if encryption enabled)
#   BACKUP_RETENTION_DAYS - Backup retention period (default: 30)
#   BACKUP_COMPRESSION_LEVEL - Compression level 1-9 (default: 6)

set -e  # Exit on error

# Default values
POSTGRES_USER=${POSTGRES_USER:-netmgr}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-netmgr}
POSTGRES_DB=${POSTGRES_DB:-netmanager}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5433}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_COMPRESSION_LEVEL=${BACKUP_COMPRESSION_LEVEL:-6}
ENCRYPTION_ENABLED=${ENCRYPTION_ENABLED:-true}

# Parse command line arguments
BACKUP_DIR=""
VERIFY_ONLY=false
NO_ENCRYPT=false

for arg in "$@"; do
  case $arg in
    --no-encrypt)
      NO_ENCRYPT=true
      shift
      ;;
    --verify-only)
      VERIFY_ONLY=true
      shift
      ;;
    -*)
      echo "Unknown option: $arg"
      exit 1
      ;;
    *)
      if [ -z "$BACKUP_DIR" ]; then
        BACKUP_DIR="$arg"
      fi
      shift
      ;;
  esac
done

# Default backup directory
BACKUP_DIR=${BACKUP_DIR:-./backups}
mkdir -p "$BACKUP_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Error handling function
error_exit() {
    echo -e "${RED}✗ $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

# Success message function
success() {
    echo -e "${GREEN}✓ $1${NC}"
    log "SUCCESS: $1"
}

# Warning message function
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    log "WARNING: $1"
}

# Info message function
info() {
    echo -e "${BLUE}ℹ $1${NC}"
    log "INFO: $1"
}

# Check if encryption is available and properly configured
check_encryption() {
    if [ "$NO_ENCRYPT" = true ]; then
        ENCRYPTION_ENABLED=false
        info "Encryption disabled by command line flag"
        return 0
    fi

    if [ "$ENCRYPTION_ENABLED" = true ]; then
        # Check if OpenSSL is available
        if ! command -v openssl &> /dev/null; then
            warning "OpenSSL not found, disabling encryption"
            ENCRYPTION_ENABLED=false
            return 1
        fi

        # Check if encryption key is provided
        if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
            error_exit "BACKUP_ENCRYPTION_KEY environment variable is required for encryption"
        fi

        # Test encryption
        echo "test" | openssl enc -aes-256-gcm -k "$BACKUP_ENCRYPTION_KEY" -pbkdf2 -e -a -pass pass:"$BACKUP_ENCRYPTION_KEY" 2>/dev/null || {
            error_exit "Failed to test encryption. Check your OpenSSL version and encryption key."
        }

        success "Encryption is properly configured"
    else
        info "Encryption is disabled"
    fi
}

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/netmanager_backup_${TIMESTAMP}.sql"
BACKUP_FILE_FINAL="$BACKUP_FILE"

if [ "$ENCRYPTION_ENABLED" = true ]; then
    BACKUP_FILE_FINAL="${BACKUP_FILE}.enc"
else
    BACKUP_FILE_FINAL="${BACKUP_FILE}.gz"
fi

# Verify backup integrity
verify_backup() {
    local backup_file="$1"

    info "Verifying backup integrity: $backup_file"

    if [ "$ENCRYPTION_ENABLED" = true ]; then
        # For encrypted backups, decrypt and verify
        if openssl enc -aes-256-gcm -k "$BACKUP_ENCRYPTION_KEY" -pbkdf2 -d -in "$backup_file" -out "${backup_file}.temp" 2>/dev/null; then
            # Check if the decrypted file is a valid SQL dump
            if grep -q "PostgreSQL database dump" "${backup_file}.temp" 2>/dev/null; then
                success "Encrypted backup verification successful"
                rm -f "${backup_file}.temp"
                return 0
            else
                rm -f "${backup_file}.temp"
                error_exit "Encrypted backup verification failed: Invalid SQL dump format"
            fi
        else
            error_exit "Failed to decrypt backup for verification"
        fi
    else
        # For compressed backups
        if gzip -t "$backup_file" 2>/dev/null; then
            # Check if the uncompressed file is a valid SQL dump
            if gzip -dc "$backup_file" | grep -q "PostgreSQL database dump" 2>/dev/null; then
                success "Compressed backup verification successful"
                return 0
            else
                error_exit "Compressed backup verification failed: Invalid SQL dump format"
            fi
        else
            error_exit "Failed to verify compressed backup"
        fi
    fi
}

# Create backup
create_backup() {
    info "Starting database backup..."
    echo "Database: $POSTGRES_DB"
    echo "Host: $POSTGRES_HOST:$POSTGRES_PORT"
    echo "Backup file: $BACKUP_FILE_FINAL"
    echo "Encryption: $([ "$ENCRYPTION_ENABLED" = true ] && echo "Enabled" || echo "Disabled")"
    echo "Compression Level: $BACKUP_COMPRESSION_LEVEL"

    # Set PGPASSWORD for pg_dump
    export PGPASSWORD="$POSTGRES_PASSWORD"

    # Create SQL dump
    info "Creating SQL dump..."
    if ! pg_dump -h "$POSTGRES_HOST" \
               -p "$POSTGRES_PORT" \
               -U "$POSTGRES_USER" \
               -d "$POSTGRES_DB" \
               --clean \
               --if-exists \
               --create \
               --format=plain \
               --no-owner \
               --no-privileges \
               --verbose \
               > "$BACKUP_FILE" 2>"$BACKUP_DIR/backup_${TIMESTAMP}.log"; then
        error_exit "Database dump failed. Check $BACKUP_DIR/backup_${TIMESTAMP}.log for details"
    fi

    # Get original file size
    ORIG_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    info "Original dump size: $ORIG_SIZE"

    if [ "$ENCRYPTION_ENABLED" = true ]; then
        # Encrypt the backup
        info "Encrypting backup with AES-256-GCM..."
        if openssl enc -aes-256-gcm -k "$BACKUP_ENCRYPTION_KEY" -pbkdf2 -in "$BACKUP_FILE" -out "$BACKUP_FILE_FINAL" -pass pass:"$BACKUP_ENCRYPTION_KEY"; then
            rm -f "$BACKUP_FILE"
            success "Backup encrypted successfully"
        else
            rm -f "$BACKUP_FILE" "$BACKUP_FILE_FINAL"
            error_exit "Backup encryption failed"
        fi
    else
        # Compress the backup
        info "Compressing backup (level: $BACKUP_COMPRESSION_LEVEL)..."
        if gzip -$BACKUP_COMPRESSION_LEVEL "$BACKUP_FILE"; then
            success "Backup compressed successfully"
        else
            rm -f "$BACKUP_FILE" "$BACKUP_FILE_FINAL"
            error_exit "Backup compression failed"
        fi
    fi

    # Get final file size
    FINAL_SIZE=$(du -h "$BACKUP_FILE_FINAL" | cut -f1)

    # Calculate compression ratio if applicable
    if [ "$ENCRYPTION_ENABLED" != true ]; then
        # Note: For encrypted files, size comparison isn't meaningful due to encryption overhead
        compression_ratio=$(awk "BEGIN {printf \"%.1f\", (${ORIG_SIZE%[^0-9]*} / ${FINAL_SIZE%[^0-9]*})}")
        info "Final backup size: $FINAL_SIZE (compression ratio: ${compression_ratio}x)"
    else
        info "Final backup size: $FINAL_SIZE"
    fi

    # Verify backup integrity
    verify_backup "$BACKUP_FILE_FINAL"

    # Create backup metadata
    METADATA_FILE="$BACKUP_DIR/metadata_${TIMESTAMP}.json"
    cat > "$METADATA_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "database": "$POSTGRES_DB",
  "host": "$POSTGRES_HOST:$POSTGRES_PORT",
  "user": "$POSTGRES_USER",
  "filename": "$(basename "$BACKUP_FILE_FINAL")",
  "size": "$FINAL_SIZE",
  "encryption": $ENCRYPTION_ENABLED,
  "compression_level": $BACKUP_COMPRESSION_LEVEL,
  "checksum": "$(sha256sum "$BACKUP_FILE_FINAL" | cut -d' ' -f1)",
  "retention_days": $BACKUP_RETENTION_DAYS,
  "expires_at": "$(date -d "+$BACKUP_RETENTION_DAYS days" -Iseconds)"
}
EOF

    success "Backup metadata created: $METADATA_FILE"

    # Clean up old backups
    info "Cleaning old backups (keeping last $BACKUP_RETENTION_DAYS days)..."

    # Remove old backup files
    find "$BACKUP_DIR" -name "netmanager_backup_*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "netmanager_backup_*.sql.enc" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true

    # Remove old metadata files
    find "$BACKUP_DIR" -name "metadata_*.json" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true

    # Remove old log files
    find "$BACKUP_DIR" -name "backup_*.log" -type f -mtime +7 -delete 2>/dev/null || true

    success "Old backups cleaned up"

    # Create backup index
    INDEX_FILE="$BACKUP_DIR/backup_index.json"
    if [ -f "$INDEX_FILE" ]; then
        # Update existing index
        if command -v jq &> /dev/null; then
            jq --arg timestamp "$(date -Iseconds)" \
               --arg backup_file "$(basename "$BACKUP_FILE_FINAL")" \
               --arg metadata_file "$(basename "$METADATA_FILE")" \
               '.backups += [{"timestamp": $timestamp, "backup_file": $backup_file, "metadata_file": $metadata_file}]' \
               "$INDEX_FILE" > "${INDEX_FILE}.tmp" && mv "${INDEX_FILE}.tmp" "$INDEX_FILE"
        else
            warning "jq not found, skipping index update"
        fi
    else
        # Create new index
        cat > "$INDEX_FILE" <<EOF
{
  "created": "$(date -Iseconds)",
  "last_updated": "$(date -Iseconds)",
  "retention_days": $BACKUP_RETENTION_DAYS,
  "backups": [
    {
      "timestamp": "$(date -Iseconds)",
      "backup_file": "$(basename "$BACKUP_FILE_FINAL")",
      "metadata_file": "$(basename "$METADATA_FILE")"
    }
  ]
}
EOF
    fi

    success "Backup completed successfully!"
    echo ""
    echo -e "${GREEN}Backup Details:${NC}"
    echo "  File: $BACKUP_FILE_FINAL"
    echo "  Size: $FINAL_SIZE"
    echo "  Encrypted: $([ "$ENCRYPTION_ENABLED" = true ] && echo "Yes" || echo "No")"
    echo "  Retention: $BACKUP_RETENTION_DAYS days"
    echo "  Checksum: $(sha256sum "$BACKUP_FILE_FINAL" | cut -d' ' -f1)"
    echo ""
}

# Main execution
main() {
    log "Starting NetManager database backup process"

    # Check encryption setup
    check_encryption

    if [ "$VERIFY_ONLY" = true ]; then
        # Find the latest backup and verify it
        LATEST_BACKUP=$(find "$BACKUP_DIR" -name "netmanager_backup_*" -type f | sort -r | head -n 1)
        if [ -n "$LATEST_BACKUP" ]; then
            info "Verifying latest backup: $LATEST_BACKUP"
            verify_backup "$LATEST_BACKUP"
            success "Backup verification completed"
        else
            error_exit "No backups found to verify"
        fi
    else
        # Create backup
        create_backup
    fi

    log "Database backup process completed"
}

# Run main function
main "$@"