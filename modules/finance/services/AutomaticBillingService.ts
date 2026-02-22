import {  InvoiceStatus  } from '@/prisma/generated/billing';;
import { prisma } from '@/lib/prisma';
import { prismaBilling } from '@/lib/prisma-billing';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createNotification } from '@/modules/notification';
import { logger } from '@/lib/logger';

// Type for the raw query result
interface EligibleCustomerRow {
    id: string;
    nama: string;
    jatuhTempo: Date;
    userId: string | null;
    usePPN: boolean;
    tipe: string;
    status: string;
    hargaPaketId: string;
    paketName: string;
    paketHarga: number;
    paketUsePPN: boolean;
    paketPpnPercentage: number | null;
}

export class AutomaticBillingService {
    /**
     * Generate invoices for customers who are due for billing
     * run daily via cron
     * OPTIMIZED: Filter by day-of-month at database level using raw query
     * instead of fetching all customers and filtering in JavaScript
     */
    static async generateDailyInvoices() {
        try {
            console.log('[Billing] Starting automatic invoice generation...');

            // 1. Get settings
            const invoiceOtomatisSetting = await prisma.settings.findUnique({
                where: { key: 'GENERAL_INVOICE_OTOMATIS' },
            });

            const daysBeforeDue = parseInt(invoiceOtomatisSetting?.value || '5');

            // Calculate target date
            const today = new Date();
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysBeforeDue);

            const targetDay = targetDate.getDate();
            const targetMonth = targetDate.getMonth() + 1;
            const targetYear = targetDate.getFullYear();

            // OPTIMIZATION: Use raw query to filter by day-of-month at database level
            // This avoids fetching all active customers and filtering in JavaScript
            // With >5000 customers, this reduces data transfer from ~5000 rows to ~160 rows
            const BATCH_SIZE = 100;
            let offset = 0;
            let generatedCount = 0;
            let processedCount = 0;
            let hasMore = true;

            while (hasMore) {
                const customers = await prisma.$queryRaw<EligibleCustomerRow[]>(
                    Prisma.sql`
                        SELECT
                            p.id, p.nama, p."jatuhTempo", p."userId", p."usePPN", p."hargaPaketId", p.tipe, p.status,
                            h.name AS "paketName", h.harga AS "paketHarga",
                            h."usePPN" AS "paketUsePPN", h."ppnPercentage" AS "paketPpnPercentage"
                        FROM "Pelanggan" p
                        INNER JOIN "HargaPaket" h ON p."hargaPaketId" = h.id
                        WHERE (p.status = 'AKTIF' OR (p.status = 'ISOLIR' AND p.tipe = 'REGULER'))
                          AND p."hargaPaketId" != ''
                          AND EXTRACT(DAY FROM p."jatuhTempo") = ${targetDay}
                        ORDER BY p.id ASC
                        LIMIT ${BATCH_SIZE} OFFSET ${offset}
                    `
                );

                if (customers.length === 0) {
                    hasMore = false;
                    break;
                }

                console.log(`[Billing] Processing batch ${Math.floor(offset / BATCH_SIZE) + 1} (${customers.length} eligible customers)`);

                // OPTIMIZATION: Batch check existing invoices (instead of N queries)
                const eligibleIds = customers.map(c => c.id);
                const existingInvoices = await prismaBilling.invoice.findMany({
                    where: {
                        pelangganId: { in: eligibleIds },
                        dueDate: {
                            gte: new Date(targetYear, targetMonth - 1, targetDay, 0, 0, 0),
                            lte: new Date(targetYear, targetMonth - 1, targetDay, 23, 59, 59),
                        }
                    },
                    select: { pelangganId: true }
                });
                const existingInvoiceSet = new Set(existingInvoices.map(i => i.pelangganId));

                const invoiceDueDate = new Date(targetYear, targetMonth - 1, targetDay);

                for (const row of customers) {
                    try {
                        processedCount++;

                        // Skip if invoice already exists (O(1) lookup)
                        if (existingInvoiceSet.has(row.id)) {
                            continue;
                        }

                        // Map raw query row to customer object
                        const customer = {
                            id: row.id,
                            nama: row.nama,
                            jatuhTempo: row.jatuhTempo,
                            userId: row.userId,
                            usePPN: row.usePPN,
                            tipe: row.tipe,
                            status: row.status,
                            hargaPaket: {
                                id: row.hargaPaketId,
                                name: row.paketName,
                                harga: row.paketHarga,
                                usePPN: row.paketUsePPN,
                                ppnPercentage: row.paketPpnPercentage,
                            },
                        };

                        // Generate Invoice
                        await this.createInvoiceForCustomer(customer, invoiceDueDate);
                        generatedCount++;

                    } catch (err) {
                        console.error(`[Billing] Error processing customer ${row.nama}:`, err);
                    }
                }

                offset += BATCH_SIZE;

                // Force garbage collection between batches if available
                if (global.gc) {
                    global.gc();
                }
            }

            console.log(`[Billing] Completed. Processed ${processedCount} customers, generated ${generatedCount} invoices.`);

        } catch (error) {
            console.error('[Billing] Fatal error in generateDailyInvoices:', error);
        }
    }

    private static async createInvoiceForCustomer(customer: {
        id: string;
        nama: string;
        jatuhTempo: Date;
        userId: string | null;
        usePPN: boolean;
        hargaPaket: {
            id: string;
            name: string;
            harga: number;
            usePPN: boolean;
            ppnPercentage: number | null;
        };
    }, dueDate: Date) {
        // Use transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // 1. Generate Invoice Number with UUID suffix to prevent race condition
            const currentYear = new Date().getFullYear();
            const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
            const currentDay = String(new Date().getDate()).padStart(2, '0');
            
            // Use crypto.randomUUID for better uniqueness (12 chars from UUID v4 to avoid collisions)
            // 8 chars was colliding at ~100k scale. 12 chars (16^12) is safe.
            const uniqueSuffix = randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();
            const invoiceNumber = `INV/${currentYear}/${currentMonth}/${currentDay}-${uniqueSuffix}`;

            // 2. Calculate Items
            const amount = BigInt(customer.hargaPaket.harga);
            // Add tax logic
            let taxAmount = 0n;
            if (customer.usePPN || customer.hargaPaket.usePPN) {
                const ppnRate = customer.hargaPaket.ppnPercentage || 11;
                taxAmount = amount * BigInt(Math.round(ppnRate * 100)) / 10000n;
            }

            const totalAmount = amount + taxAmount;

            // 3. Create Invoice
            const invoice = await prismaBilling.invoice.create({
                data: {
                    id: randomUUID(),
                    invoiceNumber,
                    pelangganId: customer.id,
                    issueDate: new Date(),
                    dueDate: dueDate,
                    status: 'SENT', // Auto sent
                    subtotal: amount,
                    taxAmount: taxAmount,
                    totalAmount: totalAmount,
                    updatedAt: new Date(),
                    invoiceItem: {
                        create: [{
                            id: randomUUID(),
                            description: `Berlangganan Internet Paket ${customer.hargaPaket.name}`,
                            quantity: 1,
                            unitPrice: amount,
                            totalPrice: amount,
                            itemType: 'SERVICE'
                        }]
                    }
                }
            });

            // 4. Update jatuhTempo removed. Will be updated upon payment.

            return invoice;
        });

        // 5. Send Notification (outside transaction because it's not critical)
        try {
            await createNotification({
                type: 'SYSTEM',
                title: 'Tagihan Baru Tersedia',
                message: `Tagihan bulan ini sebesar Rp ${Number(result.totalAmount).toLocaleString('id-ID')} telah terbit. Jatuh tempo pada ${dueDate.toLocaleDateString('id-ID')}.`,
                userId: customer.userId,
                link: '/tagihan',
                sourceType: 'INVOICE',
                sourceId: result.id,
                priority: 'NORMAL'
            });
        } catch (notifErr) {
            console.error(`[Billing] Failed to send notification for ${customer.nama}:`, notifErr);
        }

        // 6. Log activity
        await logger.logActivity({
            action: 'CREATE',
            subject: 'Invoice (Auto)',
            details: {
                id: result.id,
                invoiceNumber: result.invoiceNumber,
                customer: customer.nama,
                actor: 'SYSTEM_CRON',
                nextDueDate: new Date(customer.jatuhTempo).toISOString()
            }
        });

        return result;
    }
    /**
     * Update jatuhTempo and status when an invoice is fully paid.
     * Call this from webhook or manual payment handlers.
     */
    static async handleInvoicePaid(invoiceId: string) {
        const invoice = await prismaBilling.invoice.findUnique({
            where: { id: invoiceId },
            include: { /* pelanggan: true removed */ }
        });

        if (!invoice || invoice.status !== 'PAID') return;

        
          const { prisma: mainDb } = await import("@/lib/prisma");
          const customer = await mainDb.pelanggan.findUnique({ where: { id: invoice.pelangganId } });
        if (!customer) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const safeAddMonth = (date: Date) => {
            const d = new Date(date);
            const day = d.getDate();
            d.setMonth(d.getMonth() + 1);
            if (d.getDate() !== day) {
                d.setDate(0);
            }
            return d;
        };

        let newJatuhTempo = new Date(customer.jatuhTempo);

        if (customer.tipe === 'NON_REGULER') {
            const baseDate = customer.status === 'ISOLIR' || new Date(customer.jatuhTempo) < today ? today : new Date(customer.jatuhTempo);
            newJatuhTempo = safeAddMonth(baseDate);
        } else {
            newJatuhTempo = safeAddMonth(invoice.dueDate);
            if (newJatuhTempo < customer.jatuhTempo) {
                newJatuhTempo = new Date(customer.jatuhTempo);
            }
        }

        const unpaidInvoices = await prismaBilling.invoice.count({
            where: {
                pelangganId: customer.id,
                status: { notIn: ['PAID', InvoiceStatus.CANCELLED, 'CANCELLED'] }
            }
        });

        const updates: any = {
            jatuhTempo: newJatuhTempo
        };

        let shouldActivate = false;

        if (customer.tipe === 'REGULER') {
            if (unpaidInvoices === 0 && customer.status !== 'AKTIF') {
                updates.status = 'AKTIF';
                shouldActivate = true;
            }
        } else {
            if (customer.status !== 'AKTIF') {
                updates.status = 'AKTIF';
                shouldActivate = true;
            }
        }

        await prisma.pelanggan.update({
            where: { id: customer.id },
            data: updates
        });

        if (shouldActivate) {
            const { RadiusSyncService } = await import('@/modules/network/services/radius-sync-service');
            const radiusService = new RadiusSyncService(prisma);
            await radiusService.handleStatusChange(customer.id, 'AKTIF');
        }
    }
}
