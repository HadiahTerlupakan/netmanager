import { prisma } from "@/lib/prisma";
import type { PurchaseOrder, Prisma, PurchaseOrderStatus } from "@prisma/client";
import type { IPurchaseOrderRepository, PurchaseOrderWithDetails } from "./IPurchaseOrderRepository";

export class PurchaseOrderRepository implements IPurchaseOrderRepository {
    async findAll(params?: { search?: string; status?: PurchaseOrderStatus; skip?: number; take?: number }): Promise<{ data: PurchaseOrderWithDetails[]; total: number }> {
        const { search, status, skip, take } = params || {};
        
        const where: Prisma.PurchaseOrderWhereInput = {
            ...(status && { status }),
            ...(search && {
                OR: [
                    { poNumber: { contains: search, mode: 'insensitive' } },
                    { supplier: { name: { contains: search, mode: 'insensitive' } } }
                ]
            })
        };

        const [data, total] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    supplier: { select: { name: true, code: true } },
                    items: {
                        include: {
                            barang: { select: { nama: true, kode: true, satuan: true } }
                        }
                    },
                    purchaseRequests: { select: { id: true, nomorRequest: true } },
                    creator: { select: { name: true } },
                    processedBy: { select: { name: true } },
                    receivedBy: { select: { name: true } }
                }
            }),
            prisma.purchaseOrder.count({ where })
        ]);

        return { data: data as unknown as PurchaseOrderWithDetails[], total };
    }

    async findById(id: string): Promise<PurchaseOrderWithDetails | null> {
        return prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: { select: { name: true, code: true } },
                items: {
                    include: {
                        barang: { select: { nama: true, kode: true, satuan: true } }
                    }
                },
                purchaseRequests: { select: { id: true, nomorRequest: true } },
                creator: { select: { name: true } },
                processedBy: { select: { name: true } },
                receivedBy: { select: { name: true } }
            }
        }) as Promise<PurchaseOrderWithDetails | null>;
    }

    async create(data: Prisma.PurchaseOrderCreateInput): Promise<PurchaseOrder> {
        // Prisma Client updated to allow optional supplierId
        return prisma.purchaseOrder.create({ data });
    }

    async update(id: string, data: Prisma.PurchaseOrderUpdateInput): Promise<PurchaseOrder> {
        return prisma.purchaseOrder.update({ where: { id }, data });
    }

    async delete(id: string): Promise<PurchaseOrder> {
        return prisma.purchaseOrder.delete({ where: { id } });
    }

    async updateStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder> {
        return prisma.purchaseOrder.update({
            where: { id },
            data: { status }
        });
    }

    async updateStatusWithActor(id: string, status: PurchaseOrderStatus, userId: string): Promise<PurchaseOrder> {
         const data: any = { status };
         if (status === 'ORDERED') {
             data.processedById = userId;
         } else if (status === 'RECEIVED') {
             data.receivedById = userId;
         }
         return prisma.purchaseOrder.update({
             where: { id },
             data
         });
    }
}
