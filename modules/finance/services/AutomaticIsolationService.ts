import { InvoiceStatus } from '@/prisma/generated/billing';;
import { prisma } from '@/lib/prisma';
import { prismaBilling } from '@/lib/prisma-billing';
import { RadiusSyncService } from '@/modules/network/services/radius-sync-service';
import { logger } from '@/lib/logger';
import { Status } from '@prisma/client';
import { toStartOfDay } from '@/lib/utils/datetime'
import { notifyCustomerFinanceNotification } from '../utils/customerFinanceNotifications'


export class AutomaticIsolationService {
    /**
     * Run daily check for overdue customers and isolate them.
     */
    static async runDailyCheck() {
        try {
            // console.log('[AutoIsolation] Starting daily isolation check...');

            // 1. Check if feature is enabled
            const enabledSetting = await prisma.settings.findUnique({
                where: { key: 'GENERAL_AUTO_ISOLASI_ENABLED' }
            });

            // Default to enabled if not set, or check specific value 'false'
            const isEnabled = enabledSetting?.value !== 'false';

            if (!isEnabled) {
                // console.log('[AutoIsolation] Feature is disabled in settings. Skipping.');
                return;
            }

            const today = new Date();
            today.setTime(toStartOfDay(today).getTime());

            // Calculation Logic:
            // NEW LOGIC: Find Active customers who have at least ONE UNPAID invoice that is overdue
            // This ensures we isolate them based on actual unpaid bills, not just based on falling behind the calendar.
            const overdueInvoices = await prismaBilling.invoice.findMany({
                where: {
                    status: InvoiceStatus.OVERDUE,
                    dueDate: { lt: today }
                }
            });

            // Group by pelanggan to avoid processing the same customer multiple times
            const activeCustomersMap = new Map();

            const { prisma: mainDb } = await import('@/lib/prisma');
            for (const inv of overdueInvoices) {
                const pelanggan = await mainDb.pelanggan.findUnique({ where: { id: inv.pelangganId } });
                if (pelanggan && pelanggan.status === 'AKTIF' && pelanggan.autoIsolir) {
                    activeCustomersMap.set(pelanggan.id, pelanggan);
                }
            }
            const activeCustomers = Array.from(activeCustomersMap.values());

            // console.log(`[AutoIsolation] Found ${activeCustomers.length} candidates (overdue). Processing...`);

            // let isolatedCount = 0;
            const radiusService = new RadiusSyncService(prisma); // Fixed instantiation

            for (const customer of activeCustomers) {
                try {
                    const dueDate = new Date(customer.jatuhTempo);
                    dueDate.setTime(toStartOfDay(dueDate).getTime());



                    // Difference in days (untuk logging saja)
                    const diffTime = Math.abs(today.getTime() - dueDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // console.log(`[AutoIsolation] Isolating ${customer.nama} (Due: ${customer.jatuhTempo}, Late: ${diffDays} days)`);

                    // Perform Isolation
                    // 1. Update DB Status
                    await prisma.pelanggan.update({
                        where: { id: customer.id },
                        data: { status: Status.ISOLIR } // Use Enum
                    });

                    // 2. Sync to Radius (Disconnect)
                    await radiusService.handleStatusChange(customer.id, Status.ISOLIR); // Use Enum

                    // 3. Notification
                    await notifyCustomerFinanceNotification({
                        userId: customer.userId,
                        title: 'Layanan Diisolir',
                        message: 'Layanan internet Anda telah diisolir karena melewati batas pembayaran. Mohon segera lakukan pembayaran.',
                        link: '/tagihan',
                        sourceType: 'BILLING',
                        sourceId: customer.id,
                        priority: 'HIGH'
                    });

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

                    // _isolatedCount++;

                } catch (err) {
                    console.error(`[AutoIsolation] Error isolating customer ${customer.id}:`, err);
                }
            }

            // console.log(`[AutoIsolation] Finished. Isolated ${isolatedCount} customers.`);

        } catch (error) {
            console.error('[AutoIsolation] Fatal error:', error);
            console.error(error); // Log full error object
        }
    }
}
