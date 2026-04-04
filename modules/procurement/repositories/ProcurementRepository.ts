import { prisma } from '@/lib/prisma'
import { PurchaseOrderStatus } from '@prisma/client'
import type { PurchaseOrder, PurchaseRequestItem } from '@prisma/client'

export interface PRWithItems {
    id: string
    tenantId: string | null
    status: string
    purchaseOrderId: string | null
    items: (PurchaseRequestItem & {
        barang: { id: string; nama: string; supplierId: string | null }
    })[]
}

export class ProcurementRepository {
    async findApprovedPRs(prIds: string[]): Promise<PRWithItems[]> {
        return prisma.purchaseRequest.findMany({
            where: { id: { in: prIds }, status: 'APPROVED', purchaseOrderId: null },
            include: {
                items: {
                    include: {
                        barang: { select: { id: true, nama: true, supplierId: true } }
                    }
                }
            }
        }) as Promise<PRWithItems[]>
    }

    async findLastPOByNumberPrefix(prefix: string, tenantId?: string | null): Promise<PurchaseOrder | null> {
        return prisma.purchaseOrder.findFirst({
            where: {
                tenantId: tenantId,
                poNumber: { startsWith: prefix }
            },
            orderBy: { poNumber: 'desc' }
        })
    }

    async createPOWithItems(data: {
        id: string
        poNumber: string
        supplierId: string | null
        status: string
        createdBy: string
        tenantId: string | null
        totalAmount: number
        items: {
            id: string
            barangId: string
            quantity: number
            unitPrice: number
            totalPrice: number
            tenantId: string | null
        }[]
        prIds: string[]
    }) {
        return prisma.$transaction(async (tx) => {
            const newPO = await tx.purchaseOrder.create({
                data: {
                    id: data.id,
                    poNumber: data.poNumber,
                    supplierId: data.supplierId,
                    status: PurchaseOrderStatus.DRAFT,
                    createdBy: data.createdBy,
                    tenantId: data.tenantId,
                    totalAmount: data.totalAmount,
                    items: {
                        create: data.items
                    },
                    purchaseRequests: {
                        connect: data.prIds.map(id => ({ id }))
                    }
                }
            })

            await tx.purchaseRequest.updateMany({
                where: { id: { in: data.prIds } },
                data: { status: 'ORDERED' }
            })

            return newPO
        })
    }

    async generatePONumber(tenantId?: string | null): Promise<string> {
        const date = new Date()
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const prefix = `PO/${year}/${month}`

        const lastPO = await this.findLastPOByNumberPrefix(prefix, tenantId)

        let sequence = '0001'
        if (lastPO) {
            const parts = lastPO.poNumber.split('/')
            const lastSeq = parseInt(parts[parts.length - 1] || '0')
            sequence = String(lastSeq + 1).padStart(4, '0')
        }

        return `${prefix}/${sequence}`
    }
}
