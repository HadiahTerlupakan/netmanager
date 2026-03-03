#!/bin/bash

# ==============================================================================
# NetManager Staging DB Backup Script (Kubernetes)
# ==============================================================================

set -e

# Configuration
NAMESPACE="netmanager-staging"
POD_NAME="netmanager-db-0"
DB_USER="netmgr"
DB_NAME="netmanager"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/netmanager_staging_${TIMESTAMP}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating backup of staging database..."
echo "Namespace: $NAMESPACE, Pod: $POD_NAME, Database: $DB_NAME"

# Perform backup using pg_dump inside the pod
kubectl exec -n "$NAMESPACE" "$POD_NAME" -- pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

echo ""
echo "Backup successfully created at: $BACKUP_FILE"
echo "Backup size: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
