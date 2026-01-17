import { type PurchaseOrder, type Prisma, type PurchaseOrderStatus } from "@prisma/client";

export type PurchaseOrderWithDetails = PurchaseOrder & {
    supplier: { name: string; code: string };
    items: {
        id: string;
        barang: { nama: string; kode: string; satuan: string };
        quantity: number;
        unitPrice: number;
        totalPrice: number;
    }[];
    purchaseRequests: {
        id: string;
        nomorRequest: string;
    }[];
    // Actor info
    creator?: { name: string | null };
    processedBy?: { name: string | null } | null;
    receivedBy?: { name: string | null } | null;
};

export interface IPurchaseOrderRepository {
    findAll(params?: { search?: string; status?: PurchaseOrderStatus; skip?: number; take?: number }): Promise<{ data: PurchaseOrderWithDetails[]; total: number }>;
    findById(id: string): Promise<PurchaseOrderWithDetails | null>;
    create(data: Prisma.PurchaseOrderCreateInput): Promise<PurchaseOrder>;
    update(id: string, data: Prisma.PurchaseOrderUpdateInput): Promise<PurchaseOrder>;
    delete(id: string): Promise<PurchaseOrder>;
    updateStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder>;
    updateStatusWithActor(id: string, status: PurchaseOrderStatus, userId: string): Promise<PurchaseOrder>;
}
