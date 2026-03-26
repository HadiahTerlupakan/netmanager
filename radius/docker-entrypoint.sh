#!/bin/sh
set -e

CONFIG_DIR="/etc/freeradius"

# ==============================================================================
# Substitute environment variables in FreeRADIUS config files at runtime
# ==============================================================================

echo "[entrypoint] Configuring FreeRADIUS with environment variables..."

# Validate required environment variables
for VAR in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME; do
    eval VAL=\$$VAR
    if [ -z "$VAL" ]; then
        echo "[entrypoint] ERROR: Required environment variable $VAR is not set!"
        exit 1
    fi
done

# 1. Substitute variables in sql module config
SQL_FILE="$CONFIG_DIR/mods-available/sql"
if [ -f "$SQL_FILE" ]; then
    sed -i "s|\\\$ENV{DB_HOST}|${DB_HOST}|g" "$SQL_FILE"
    sed -i "s|\\\$ENV{DB_PORT}|${DB_PORT}|g" "$SQL_FILE"
    sed -i "s|\\\$ENV{DB_USER}|${DB_USER}|g" "$SQL_FILE"
    sed -i "s|\\\$ENV{DB_PASSWORD}|${DB_PASSWORD}|g" "$SQL_FILE"
    sed -i "s|\\\$ENV{DB_NAME}|${DB_NAME}|g" "$SQL_FILE"
    echo "[entrypoint] SQL module configured: host=${DB_HOST}, port=${DB_PORT}, db=${DB_NAME}"
fi

# 2. Substitute variables in clients.conf
CLIENTS_FILE="$CONFIG_DIR/clients.conf"
if [ -f "$CLIENTS_FILE" ]; then
    RADIUS_SECRET="${RADIUS_SECRET:-testing123}"
    sed -i "s|\\\$ENV{RADIUS_SECRET}|${RADIUS_SECRET}|g" "$CLIENTS_FILE"
    echo "[entrypoint] clients.conf configured with RADIUS_SECRET"
fi

# 3. Fix permissions
chown -R freerad:freerad "$CONFIG_DIR"

echo "[entrypoint] Starting FreeRADIUS in foreground mode..."

# Run FreeRADIUS in foreground (-f) so container stays alive
# Use -l stdout to log to container stdout (for kubectl logs)
exec freeradius -f -l stdout
