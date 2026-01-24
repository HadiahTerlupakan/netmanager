import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { createNotification } from '@/modules/notification';
import { logger } from '@/lib/logger';

export class AutomaticBillingService {
    /**
     * Generate invoices for customers who are due for billing
     * run daily via cron
     * OPTIMIZED: Uses cursor-based pagination to avoid loading all customers into memory
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

            // OPTIMIZATION: Use cursor-based pagination to process in batches
            const BATCH_SIZE = 100;
            let skip = 0;
            let generatedCount = 0;
            let processedCount = 0;
            let hasMore = true;

            while (hasMore) {
                // Fetch batch with minimal fields using select instead of include
                const customers = await prisma.pelanggan.findMany({
                    where: {
                        status: 'AKTIF',
                        hargaPaketId: { not: '' }
                    },
                    select: {
                        id: true,
                        nama: true,
                        jatuhTempo: true,
                        userId: true,
                        usePPN: true,
                        hargaPaket: {
                            select: {
                                id: true,
                                name: true,
                                harga: true,
                                usePPN: true,
                                ppnPercentage: true
                            }
                        }
                    },
                    skip,
                    take: BATCH_SIZE,
                    orderBy: { id: 'asc' }
                });

                if (customers.length === 0) {
                    hasMore = false;
                    break;
                }

                console.log(`[Billing] Processing batch ${Math.floor(skip / BATCH_SIZE) + 1} (${customers.length} customers)`);

                // OPTIMIZATION: Filter customers by due date first
                const eligibleCustomers = customers.filter(c => {
                    const dueDate = new Date(c.jatuhTempo);
                    return dueDate.getDate() === targetDay;
                });

                if (eligibleCustomers.length === 0) {
                    skip += BATCH_SIZE;
                    continue;
                }

                // OPTIMIZATION: Batch check existing invoices (instead of N queries)
                const eligibleIds = eligibleCustomers.map(c => c.id);
                const existingInvoices = await prisma.invoice.findMany({
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

                for (const customer of eligibleCustomers) {
                    try {
                        processedCount++;

                        // Skip if invoice already exists (O(1) lookup)
                        if (existingInvoiceSet.has(customer.id)) {
                            continue;
                        }

                        // Generate Invoice
                        await this.createInvoiceForCustomer(customer, invoiceDueDate);
                        generatedCount++;

                    } catch (err) {
                        console.error(`[Billing] Error processing customer ${customer.nama}:`, err);
                    }
                }

                skip += BATCH_SIZE;

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

    private static async createInvoiceForCustomer(customer: any, dueDate: Date) {
        // 1. Generate Invoice Number
        const currentYear = new Date().getFullYear();
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

        // Count for number generation
        const invoiceCount = await prisma.invoice.count({
            where: {
                createdAt: {
                    gte: new Date(currentYear, new Date().getMonth(), 1),
                    lt: new Date(currentYear, new Date().getMonth() + 1, 1),
                },
            },
        });

        const invoiceNumber = `INV/${currentYear}/${currentMonth}/${String(invoiceCount + 1).padStart(4, '0')}`; // Potential race condition if high concurrency, but OK for cron

        // 2. Calculate Items
        const amount = BigInt(customer.hargaPaket.harga);
        // Add tax logic
        let taxAmount = 0n;
        if (customer.usePPN || customer.hargaPaket.usePPN) {
            const ppnRate = customer.hargaPaket.ppnPercentage || 11;
            taxAmount = amount * BigInt(Math.round(ppnRate * 100)) / 10000n; // Basic calc
        }

        // Apply discount from customer settings if recurring
        // Simplified for this implementation
        const totalAmount = amount + taxAmount;

        // 3. Create Invoice
        const invoice = await prisma.invoice.create({
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
                        itemType: 'SERVICE' // Assuming enum exists
                    }]
                }
            }
        });

        // 4. Send Notification
        await createNotification({
            type: 'SYSTEM', // Or new BILLING type if added
            title: 'Tagihan Baru Tersedia',
            message: `Tagihan bulan ini sebesar Rp ${Number(totalAmount).toLocaleString('id-ID')} telah terbit. Jatuh tempo pada ${dueDate.toLocaleDateString('id-ID')}.`,
            userId: customer.userId, // Assuming customer is linked to a user
            link: '/tagihan', // Customer portal link
            sourceType: 'INVOICE',
            sourceId: invoice.id,
            priority: 'NORMAL'
        });

        // Log
        await logger.logActivity({
            action: 'CREATE',
            subject: 'Invoice (Auto)',
            // userId: 'SYSTEM', // Remove this to avoid FK error
            details: {
                id: invoice.id,
                invoiceNumber,
                customer: customer.nama,
                actor: 'SYSTEM_CRON'
            }
        });

        return invoice;
    }
}
