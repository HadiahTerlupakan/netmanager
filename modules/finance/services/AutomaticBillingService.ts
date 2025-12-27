import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { createNotification } from '@/modules/notification';
import { logger } from '@/lib/logger';

export class AutomaticBillingService {
    /**
     * Generate invoices for customers who are due for billing
     * run daily via cron
     */
    static async generateDailyInvoices() {
        try {
            console.log('[Billing] Starting automatic invoice generation...');

            // 1. Get settings
            const invoiceOtomatisSetting = await prisma.settings.findUnique({
                where: { key: 'GENERAL_INVOICE_OTOMATIS' },
            });

            const daysBeforeDue = parseInt(invoiceOtomatisSetting?.value || '5');

            // Calculate target date (e.g. if today is 1st and setting is 5 days, we look for due date on 6th)
            const today = new Date();
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysBeforeDue);

            // Format target date to match database storage if needed, or just use date parts
            // Assuming jatuhTempo is stored as full DateTime, we compare day and month? 
            // Or usually billing is monthly. 
            // Let's assume we generate invoice for the NEXT due date.

            // Strategy: Find customers whose bill needs to be generated today.
            // If bill is due on D, and we generate N days before.
            // Then we generate when Today = D - N. 
            // So D = Today + N.

            const targetDay = targetDate.getDate();
            const targetMonth = targetDate.getMonth() + 1; // 0-indexed
            const targetYear = targetDate.getFullYear();

            // 2. Find active customers
            const activeCustomers = await prisma.pelanggan.findMany({
                where: {
                    status: 'AKTIF',
                    hargaPaketId: { not: '' } // Ensure they have a package
                },
                include: {
                    hargaPaket: true,
                }
            });

            console.log(`[Billing] Found ${activeCustomers.length} active customers.`);

            let generatedCount = 0;

            for (const customer of activeCustomers) {
                try {
                    // Check if customer is due for a new invoice
                    // Logic: Get their 'jatuhTempo'. Check if it matches our target Window.
                    // Usually 'jatuhTempo' in DB is their *next* due date or *recurring* day.
                    // If it is a specific date, we need to see if we haven't generated it yet.

                    const dueDate = new Date(customer.jatuhTempo);

                    // We only care if the day of month matches the target day
                    // AND if we haven't generated an invoice for this period yet.

                    // Simple logic for monthly billing:
                    // If customer.jatuhTempo day matches targetDay.

                    if (dueDate.getDate() !== targetDay) {
                        continue;
                    }

                    // Construct the full due date string for this month/period
                    // If today is Dec 25, and daysBefore = 5, Target = Dec 30.
                    // We want to generate invoice for Dec 30.

                    const invoiceDueDate = new Date(targetYear, targetMonth - 1, targetDay);

                    // Check if invoice already exists for this customer and this month/year combo
                    // We can check by invoice issue date or just check if there is an invoice with this due date?
                    // Better to check period.

                    const existingInvoice = await prisma.invoice.findFirst({
                        where: {
                            pelangganId: customer.id,
                            dueDate: {
                                gte: new Date(targetYear, targetMonth - 1, targetDay, 0, 0, 0),
                                lte: new Date(targetYear, targetMonth - 1, targetDay, 23, 59, 59),
                            }
                        }
                    });

                    if (existingInvoice) {
                        continue;
                    }

                    // Generate Invoice
                    await this.createInvoiceForCustomer(customer, invoiceDueDate);
                    generatedCount++;

                } catch (err) {
                    console.error(`[Billing] Error processing customer ${customer.nama}:`, err);
                }
            }

            console.log(`[Billing] Completed. Generated ${generatedCount} invoices.`);

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
