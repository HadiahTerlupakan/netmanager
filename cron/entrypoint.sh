#!/bin/sh
# ==============================================================================
# NetManager Cron Entrypoint
# ==============================================================================

# Validate required environment variables
if [ -z "$CRON_SECRET" ]; then
    echo "ERROR: CRON_SECRET is not set!"
    exit 1
fi

if [ -z "$APP_URL" ]; then
    echo "ERROR: APP_URL is not set!"
    exit 1
fi

echo "Setting up cron jobs..."

# Create crontab entries
cat > /etc/crontabs/root << EOF
# Attendance alert - auto check setiap 15 menit
*/15 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/attendance-alert?type=auto" >> /var/log/cron.log 2>&1

# Attendance alert - process pada jam 22:00 setiap hari
0 22 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/attendance-alert?type=process" >> /var/log/cron.log 2>&1
EOF

echo "Cron jobs configured:"
cat /etc/crontabs/root

echo "Starting crond..."
exec crond -f -l 2
