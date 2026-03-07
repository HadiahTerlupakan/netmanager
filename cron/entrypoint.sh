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
cat > /etc/crontabs/root <<EOF
# Attendance alert - auto check setiap 15 menit
*/15 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/attendance-alert?type=auto" >> /var/log/cron.log 2>&1

# Attendance alert - process pada jam 22:00 setiap hari
0 22 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/attendance-alert?type=process" >> /var/log/cron.log 2>&1

# Absence (Alpha) Check - process pada jam 01:00 pagi (untuk hari sebelumnya)
0 1 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/process-absence" >> /var/log/cron.log 2>&1

# Auto Checkout (Mangkir) - process pada jam 23:59 setiap hari
59 23 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/auto-checkout" >> /var/log/cron.log 2>&1

# Auto Approve TUKAR_LIBUR - process pada jam 22:00 setiap hari (H-1 sebelum tanggal izin)
0 22 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/auto-approve-leave" >> /var/log/cron.log 2>&1

# Work Order Reminder - kirim reminder untuk WO > 1 hari pada jam 08:00 setiap hari
0 8 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/workorder-reminder" >> /var/log/cron.log 2>&1

# RAB Status Evaluation
0 1 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/rab-status-eval" >> /var/log/cron.log 2>&1
EOF

echo "Cron jobs configured:"
cat /etc/crontabs/root

echo "Starting crond..."
exec crond -f -l 2
