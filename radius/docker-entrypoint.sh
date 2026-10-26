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
    sed -i "s|__DB_HOST__|${DB_HOST}|g" "$SQL_FILE"
    sed -i "s|__DB_PORT__|${DB_PORT}|g" "$SQL_FILE"
    sed -i "s|__DB_USER__|${DB_USER}|g" "$SQL_FILE"
    sed -i "s|__DB_PASSWORD__|${DB_PASSWORD}|g" "$SQL_FILE"
    sed -i "s|__DB_NAME__|${DB_NAME}|g" "$SQL_FILE"
    echo "[entrypoint] SQL module configured: host=${DB_HOST}, port=${DB_PORT}, db=${DB_NAME}"
fi

# 2. Substitute variables in clients.conf
CLIENTS_FILE="$CONFIG_DIR/clients.conf"
if [ -f "$CLIENTS_FILE" ]; then
    RADIUS_SECRET_VAL="${RADIUS_SECRET:-testing123}"
    sed -i "s|__RADIUS_SECRET__|${RADIUS_SECRET_VAL}|g" "$CLIENTS_FILE"
    echo "[entrypoint] clients.conf configured with RADIUS_SECRET"
fi

# 3. Enable 'sqlippool' in sites-enabled/default (accounting and post-auth)
# 4. Disable 'detail' module in accounting to prevent text log directory errors
if [ -f "$CONFIG_DIR/sites-enabled/default" ]; then
    # Un-comment sqlippool globally in default site (it appears in accounting and post-auth)
    sed -i 's/^[[:space:]]*#[[:space:]]*sqlippool[[:space:]]*$/\tsqlippool/' "$CONFIG_DIR/sites-enabled/default"
    # Disable 'detail' module in sites-enabled/default
    # This prevents errors related to writing to /var/log/freeradius/radacct/
    sed -i '/^[[:space:]]*detail[[:space:]]*$/s/^/#/' "$CONFIG_DIR/sites-enabled/default"
    # On an Interim-Update for a session with no lease in radippool (address
    # from the router's own pool, or a static one) sqlippool returns
    # notfound, which ends the accounting section before sql runs and sends
    # no Accounting-Response: usage never updates and the NAS counts a
    # timeout. Give notfound a priority instead, so sql still runs.
    awk '/^accounting \{/ { acct = 1 }
         acct && /^\tsqlippool[ \t]*$/ { print "\tsqlippool {\n\t\tnotfound = 1\n\t}"; next }
         /^}/ { acct = 0 }
         { print }' "$CONFIG_DIR/sites-enabled/default" > /tmp/default.site
    cat /tmp/default.site > "$CONFIG_DIR/sites-enabled/default"
    rm -f /tmp/default.site
    echo "[entrypoint] Enabled 'sqlippool' and disabled 'detail' in sites-enabled/default"
fi

# 4. Fix permissions
chown -R freerad:freerad "$CONFIG_DIR"

echo "[entrypoint] Starting FreeRADIUS in foreground mode..."

# Run FreeRADIUS in foreground (-f) so container stays alive
# Use -l stdout to log to container stdout (for kubectl logs)
exec freeradius -f -l stdout
