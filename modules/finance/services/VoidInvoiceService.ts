import { prismaBilling } from '@/lib/prisma-billing'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { InvoiceStatus } from '@prisma/client-billing'
import { notifyCustomerFinanceNotification } from '../utils/customerFinanceNotifications'

export class VoidInvoiceService {
    /**
     * Void/Cancel a paid invoice atomically and rollback customer due date.
     */
    static async voidInvoice(invoiceId: string, reason: string, adminUserId: string) {
        try {
            // 1. Find and validate invoice
            const invoice = await prismaBilling.invoice.findUnique({
                where: { id: invoiceId },
                include: { payment: true }
            })

            if (!invoice) throw new Error('NOT_FOUND: Invoice tidak ditemukan')

            // Validate payable status
            if (invoice.status !== 'PAID' && invoice.status !== 'PARTIAL_PAID') {
                throw new Error('FORBIDDEN: Hanya invoice PAID atau PARTIAL_PAID yang dapat dibatalkan melalui fitur ini')
            }

            // 2. Atomic Billing Transaction
            // Cover billing database operations
            await prismaBilling.$transaction(async (tx) => {
                // Update ALL associated payments with gatewayStatus 'PAID' -> 'REFUNDED'
                await tx.payment.updateMany({
                    where: {
                        invoiceId,
                        gatewayStatus: 'PAID'
                    },
                    data: {
                        gatewayStatus: 'REFUNDED'
                    }
                })

                // Update the invoice: status -> 'CANCELLED', paidAmount -> 0, add void reason to notes
                await tx.invoice.update({
                    where: { id: invoiceId },
                    data: {
                        status: 'CANCELLED' as InvoiceStatus,
                        paidAmount: 0,
                        notes: invoice.notes
                            ? `${invoice.notes}\n[VOID] Reason: ${reason}`
                            : `[VOID] Reason: ${reason}`
                    }
                })
            })

            // 3. Rollback Pelanggan (Main DB)
            const pelanggan = await prisma.pelanggan.findUnique({
                where: { id: invoice.pelangganId }
            })

            if (!pelanggan) {
                // If customer is not found in main DB, we still logged the invoice cancellation
                // but we can't rollback jatuhTempo. We return success but log a warning.
                console.warn(`[VoidInvoiceService] Pelanggan ${invoice.pelangganId} not found in main DB for invoice ${invoiceId}`)
                return {
                    success: true,
                    data: {
                        invoiceId: invoice.id,
                        invoiceNumber: invoice.invoiceNumber,
                        pelangganId: invoice.pelangganId,
                        previousStatus: invoice.status,
                        newStatus: 'CANCELLED',
                        customerUpdateSkipped: true
                    }
                }
            }

            // Calculate rolled back jatuhTempo
            const currentJatuhTempo = pelanggan.jatuhTempo
            const newJatuhTempo = new Date(currentJatuhTempo)
            newJatuhTempo.setMonth(newJatuhTempo.getMonth() - 1)

            // Check for status change
            const statusChanged = pelanggan.status === 'AKTIF'
            const newStatus = statusChanged ? 'ISOLIR' : pelanggan.status

            // Update main DB
            await prisma.pelanggan.update({
                where: { id: pelanggan.id },
                data: {
                    jatuhTempo: newJatuhTempo,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    status: newStatus as any
                }
            })

            // 4. If status changed to ISOLIR, sync to RADIUS
            if (statusChanged) {
                try {
                    const { RadiusSyncService } = await import('@/modules/network/services/radius-sync-service')
                    const radiusService = new RadiusSyncService(prisma)
                    await radiusService.handleStatusChange(pelanggan.id, 'ISOLIR')
                } catch (radiusErr) {
                    console.error('[VoidInvoiceService] Failed to sync to RADIUS:', radiusErr)
                    // We don't throw here to ensure the rest of the feedback/logging happens
                }
            }

            // 5. Create notification for the pelanggan
            try {
                await notifyCustomerFinanceNotification({
                    userId: pelanggan.userId,
                    title: 'Tagihan Dibatalkan',
                    message: `Tagihan ${invoice.invoiceNumber} telah dibatalkan oleh admin. Alasan: ${reason}`,
                    link: '/tagihan',
                    sourceType: 'INVOICE',
                    sourceId: invoice.id,
                    priority: 'HIGH'
                })
            } catch (notifErr) {
                console.error('[VoidInvoiceService] Failed to send notification:', notifErr)
            }

            // 6. Log activity
            await logger.logActivity({
                action: 'VOID_INVOICE',
                subject: `Invoice ${invoice.invoiceNumber}`,
                details: {
                    invoiceId: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    pelangganId: invoice.pelangganId,
                    totalAmount: Number(invoice.totalAmount),
                    reason,
                    voidedBy: adminUserId,
                    previousStatus: invoice.status,
                    jatuhTempoOld: currentJatuhTempo,
                    jatuhTempoNew: newJatuhTempo,
                    customerStatusChanged: statusChanged ? 'AKTIF → ISOLIR' : 'unchanged'
                }
            })

            return {
                success: true,
                data: {
                    invoiceId: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    pelangganId: invoice.pelangganId,
                    previousStatus: invoice.status,
                    newStatus: 'CANCELLED',
                    jatuhTempoOld: currentJatuhTempo,
                    jatuhTempoNew: newJatuhTempo,
                    customerStatusChanged: statusChanged
                }
            }

        } catch (error: unknown) {
            console.error('[VoidInvoiceService] Fatal error:', error)
            throw error
        }
    }
}
