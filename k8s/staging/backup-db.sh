#!/bin/bash

# ==============================================================================
# NetManager Staging DB Backup Script (Kubernetes)
#
# Backup semua 4 database (netmanager, billing, mitra, radius) dari masing-masing
# StatefulSet pod ke gzipped SQL dump di ./backups/.
# ==============================================================================

set -euo pipefail

NAMESPACE="netmanager-staging"
DB_USER="netmgr"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

# Pasangan: <statefulset-pod-name>:<database-name>
DATABASES=(
  "db-netmanager-0:netmanager"
  "db-billing-0:billing"
  "db-mitra-0:mitra"
  "db-radius-0:radius"
)

EXIT_CODE=0
for entry in "${DATABASES[@]}"; do
  POD_NAME="${entry%%:*}"
  DB_NAME="${entry##*:}"
  BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_staging_${TIMESTAMP}.sql.gz"

  echo "==> Backup ${DB_NAME} dari pod ${POD_NAME}..."
  if kubectl exec -n "$NAMESPACE" "$POD_NAME" -- pg_dump -U "$DB_USER" -d "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"; then
    echo "    OK: ${BACKUP_FILE} ($(ls -lh "$BACKUP_FILE" | awk '{print $5}'))"
  else
    echo "    GAGAL: backup ${DB_NAME} dari ${POD_NAME}"
    rm -f "$BACKUP_FILE"
    EXIT_CODE=1
  fi
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo ""
  echo "Semua backup selesai di ${BACKUP_DIR}/"
else
  echo ""
  echo "PERINGATAN: minimal satu backup gagal — periksa output di atas." >&2
fi

exit "$EXIT_CODE"
