import { prisma } from '@/lib/prisma';
import { RadiusSyncService } from '@/modules/network/services/radius-sync-service';
import { createNotification } from '@/modules/notification';
import { logger } from '@/lib/logger';
import { Status } from '@prisma/client';

export class AutomaticIsolationService {
    /**
     * Run daily check for overdue customers and isolate them.
     */
    static async runDailyCheck() {
        try {
            console.log('[AutoIsolation] Starting daily isolation check...');

            // 1. Check if feature is enabled
            const enabledSetting = await prisma.settings.findUnique({
                where: { key: 'GENERAL_AUTO_ISOLASI_ENABLED' }
            });

            // Default to enabled if not set, or check specific value 'false'
            const isEnabled = enabledSetting?.value !== 'false';

            if (!isEnabled) {
                console.log('[AutoIsolation] Feature is disabled in settings. Skipping.');
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Calculation Logic:
            // Find Active customers where jatuhTempo < Today (Overdue)
            const activeCustomers = await prisma.pelanggan.findMany({
                where: {
                    status: Status.AKTIF, // Use Enum
                    autoIsolir: true, // Only process if auto-isolation is enabled for this customer
                    jatuhTempo: {
                        lt: today // Strictly less than today means they missed the date
                    }
                }
            });

            console.log(`[AutoIsolation] Found ${activeCustomers.length} candidates (overdue). Processing...`);

            let isolatedCount = 0;
            const radiusService = new RadiusSyncService(prisma); // Fixed instantiation

            for (const customer of activeCustomers) {
                try {
                    const dueDate = new Date(customer.jatuhTempo);
                    dueDate.setHours(0, 0, 0, 0);

                    // Difference in days (untuk logging saja)
                    const diffTime = Math.abs(today.getTime() - dueDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    console.log(`[AutoIsolation] Isolating ${customer.nama} (Due: ${customer.jatuhTempo}, Late: ${diffDays} days)`);

                    // Perform Isolation
                    // 1. Update DB Status
                    await prisma.pelanggan.update({
                        where: { id: customer.id },
                        data: { status: Status.ISOLIR } // Use Enum
                    });

                    // 2. Sync to Radius (Disconnect)
                    await radiusService.handleStatusChange(customer.id, Status.ISOLIR); // Use Enum

                    // 3. Notification
                    if (customer.userId) { // If linked to a user account
                        await createNotification({
                            type: 'SYSTEM',
                            title: 'Layanan Diisolir',
                            message: `Layanan internet Anda telah diisolir karena melewati batas pembayaran. Mohon segera lakukan pembayaran.`,
                            userId: customer.userId,
                            link: '/tagihan',
                            sourceType: 'BILLING', // Or similar
                            sourceId: customer.id,
                            priority: 'HIGH'
                        });
                    }

                    // 4. Log
                    await logger.logActivity({
                        action: 'UPDATE',
                        subject: 'Pelanggan (Auto Isolir)',
                        details: {
                            id: customer.id,
                            name: customer.nama,
                            reason: `Overdue ${diffDays} days`
                        }
                    });

                    isolatedCount++;

                } catch (err) {
                    console.error(`[AutoIsolation] Error isolating customer ${customer.id}:`, err);
                }
            }

            console.log(`[AutoIsolation] Finished. Isolated ${isolatedCount} customers.`);

        } catch (error) {
            console.error('[AutoIsolation] Fatal error:', error);
            console.error(error); // Log full error object
        }
    }
}
