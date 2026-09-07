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
cat > /etc/crontabs/root <<CRON_EOF
# Attendance orchestrator - evaluasi semua job attendance setiap menit
* * * * * curl -s -H "Authorization: Bearer \$CRON_SECRET" "\$APP_URL/api/cron/attendance-orchestrator" >> /var/log/cron.log 2>&1

# Auto Approve TUKAR_LIBUR - process pada jam 22:00 setiap hari (H-1 sebelum tanggal izin)
0 22 * * * curl -s -H "Authorization: Bearer \$CRON_SECRET" "\$APP_URL/api/cron/auto-approve-leave" >> /var/log/cron.log 2>&1

# Work Order Reminder - kirim reminder untuk WO > 1 hari pada jam 08:00 setiap hari
0 8 * * * curl -s -H "Authorization: Bearer \$CRON_SECRET" "\$APP_URL/api/cron/workorder-reminder" >> /var/log/cron.log 2>&1

# RAB Status Evaluation
0 1 * * * curl -s -H "Authorization: Bearer \$CRON_SECRET" "\$APP_URL/api/cron/rab-status-eval" >> /var/log/cron.log 2>&1

# Billing Schedule Reconciliation - recovery schedule hilang atau terlewat setiap menit
* * * * * curl -s -H "Authorization: Bearer \$CRON_SECRET" "\$APP_URL/api/cron/reconcile-billing-schedules" >> /var/log/cron.log 2>&1

# Process Overdue compatibility - tetap tersedia untuk deployment lama
1 0 * * * curl -s -H "Authorization: Bearer \$CRON_SECRET" "\$APP_URL/api/cron/process-overdue" >> /var/log/cron.log 2>&1

# Tenant Domain Verification - verifikasi domain tenant setiap 5 menit
*/5 * * * * curl -s -X POST -H "Authorization: Bearer \$CRON_SECRET" "\$APP_URL/api/cron/tenant-domain-verify" >> /var/log/cron.log 2>&1

# Cleanup Stale FCM Tokens - hapus token >30 hari sekali sehari jam 02:00
0 2 * * * curl -s -H "Authorization: Bearer \$CRON_SECRET" "\$APP_URL/api/cron/cleanup-stale-fcm-tokens" >> /var/log/cron.log 2>&1

# Surat Pengesahan - tandai surat yang lewat masa berlaku, sekali sehari jam 03:00
0 3 * * * curl -s -X POST -H "Authorization: Bearer \$CRON_SECRET" "\$APP_URL/api/cron/endorsement-expire" >> /var/log/cron.log 2>&1
CRON_EOF

echo "Cron jobs configured:"
cat /etc/crontabs/root

echo "Starting crond..."
exec crond -f -l 2
