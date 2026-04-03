import { prisma } from "@/lib/prisma"
import { prismaBilling } from '@/lib/prisma-billing'
import { randomUUID } from "crypto"

export class MixRadiusRepository {
    async upsertMixRadiusCustomer(data: {
        mixRadiusId: string
        tenantId: string
        username: string
        fullName: string
        address?: string
        phoneNumber?: string
        planName?: string
        ownerName?: string
        status?: string
        expiredOn?: Date | null
        lastSyncedAt: Date
    }) {
        return prismaBilling.mixRadiusCustomer.upsert({
            where: {
                tenantId_mixRadiusId: {
                    tenantId: data.tenantId,
                    mixRadiusId: data.mixRadiusId
                }
            },
            update: {
                username: data.username,
                fullName: data.fullName,
                address: data.address,
                phoneNumber: data.phoneNumber,
                planName: data.planName,
                ownerName: data.ownerName,
                status: data.status,
                expiredOn: data.expiredOn,
                lastSyncedAt: data.lastSyncedAt,
            },
            create: {
                id: randomUUID(),
                mixRadiusId: data.mixRadiusId,
                tenantId: data.tenantId,
                username: data.username,
                fullName: data.fullName,
                address: data.address,
                phoneNumber: data.phoneNumber,
                planName: data.planName,
                ownerName: data.ownerName,
                status: data.status,
                expiredOn: data.expiredOn,
                lastSyncedAt: data.lastSyncedAt,
            }
        })
    }

    async findPelangganByMixRadiusId(mixRadiusId: string) {
        return prisma.pelanggan.findUnique({
            where: { mixRadiusId }
        })
    }

    async findPelangganByUsername(username: string) {
        return prisma.pelanggan.findFirst({
            where: { idPelanggan: username }
        })
    }

    async updatePelangganMixRadiusLink(pelangganId: string, mixRadiusId: string) {
        return prisma.pelanggan.update({
            where: { id: pelangganId },
            data: {
                mixRadiusId,
                lastSyncedAt: new Date()
            }
        })
    }

    async updatePelangganSyncTimestamp(pelangganId: string) {
        return prisma.pelanggan.update({
            where: { id: pelangganId },
            data: { lastSyncedAt: new Date() }
        })
    }

    async upsertMixRadiusInvoice(data: {
        mixRadiusId: string
        tenantId: string
        invoiceNumber: string
        username: string
        fullName: string
        ownerName: string
        planName: string
        amount: number
        status: string
        paymentMethod: string
        issuedDate: Date
        dueDate: Date | null
        expiredOn: Date | null
        syncedAt: Date
    }) {
        return prismaBilling.mixRadiusInvoice.upsert({
            where: {
                tenantId_invoiceNumber: {
                    tenantId: data.tenantId,
                    invoiceNumber: data.invoiceNumber
                }
            },
            update: {
                username: data.username,
                fullName: data.fullName,
                ownerName: data.ownerName,
                planName: data.planName,
                amount: data.amount,
                status: data.status,
                paymentMethod: data.paymentMethod,
                issuedDate: data.issuedDate,
                dueDate: data.dueDate,
                expiredOn: data.expiredOn,
                syncedAt: data.syncedAt,
            },
            create: {
                id: randomUUID(),
                mixRadiusId: data.mixRadiusId,
                tenantId: data.tenantId,
                invoiceNumber: data.invoiceNumber,
                username: data.username,
                fullName: data.fullName,
                ownerName: data.ownerName,
                planName: data.planName,
                amount: data.amount,
                status: data.status,
                paymentMethod: data.paymentMethod,
                issuedDate: data.issuedDate,
                dueDate: data.dueDate,
                expiredOn: data.expiredOn,
                syncedAt: data.syncedAt,
            }
        })
    }

    async findOwnerGroupById(groupId: string) {
        return prismaBilling.mixRadiusOwnerGroup.findUnique({
            where: { id: groupId },
        })
    }

    async getInvoicePlanAverages() {
        return prismaBilling.mixRadiusInvoice.groupBy({
            by: ["planName"],
            _avg: { amount: true },
            where: { amount: { gt: 0 } },
        })
    }

    async getInvoiceGlobalAverage() {
        return prismaBilling.mixRadiusInvoice.aggregate({
            _avg: { amount: true },
            where: { amount: { gt: 0 } },
        })
    }
}
