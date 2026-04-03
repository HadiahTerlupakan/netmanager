import { InvoiceRepository } from '../repositories/InvoiceRepository'
import { PelangganRepository } from '../../pelanggan/repositories/PelangganRepository'
import { logger } from '@/lib/logger'
import { notifyCustomerFinanceNotification } from '../utils/customerFinanceNotifications'

export class VoidInvoiceService {
    private invoiceRepo: InvoiceRepository
    private pelangganRepo: PelangganRepository

    constructor() {
        this.invoiceRepo = new InvoiceRepository()
        this.pelangganRepo = new PelangganRepository()
    }

    static async voidInvoice(invoiceId: string, reason: string, adminUserId: string) {
        const service = new VoidInvoiceService()
        return service.executeVoid(invoiceId, reason, adminUserId)
    }

    private async executeVoid(invoiceId: string, reason: string, adminUserId: string) {
        try {
            const invoice = await this.invoiceRepo.findUnique(invoiceId)

            if (!invoice) throw new Error('NOT_FOUND: Invoice tidak ditemukan')

            if (invoice.status !== 'PAID' && invoice.status !== 'PARTIAL_PAID') {
                throw new Error('FORBIDDEN: Hanya invoice PAID atau PARTIAL_PAID yang dapat dibatalkan melalui fitur ini')
            }

            await this.invoiceRepo.voidInvoiceTransaction(invoiceId, reason, invoice.notes)

            const pelanggan = await this.pelangganRepo.findById(invoice.pelangganId)

            if (!pelanggan) {
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

            const currentJatuhTempo = pelanggan.jatuhTempo
            const newJatuhTempo = new Date(currentJatuhTempo)
            newJatuhTempo.setMonth(newJatuhTempo.getMonth() - 1)

            const statusChanged = pelanggan.status === 'AKTIF'
            const newStatus = statusChanged ? 'ISOLIR' : pelanggan.status

            await this.pelangganRepo.update(pelanggan.id, {
                jatuhTempo: newJatuhTempo,
                status: newStatus
            })

            if (statusChanged) {
                try {
                    const { RadiusSyncService } = await import('@/modules/network/services/radius-sync-service')
                    const { prisma: mainPrisma } = await import('@/lib/prisma')
                    const radiusService = new RadiusSyncService(mainPrisma)
                    await radiusService.handleStatusChange(pelanggan.id, 'ISOLIR')
                } catch (radiusErr) {
                    console.error('[VoidInvoiceService] Failed to sync to RADIUS:', radiusErr)
                }
            }

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
