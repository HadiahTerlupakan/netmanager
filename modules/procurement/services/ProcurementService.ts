import { prisma } from "@/lib/prisma";
import { randomUUID } from 'crypto';
import { PurchaseOrderStatus, Prisma } from "@prisma/client";
import { SupplierRepository } from "../repositories/SupplierRepository";
import { PurchaseOrderRepository } from "../repositories/PurchaseOrderRepository";

export class ProcurementService {
    private supplierRepo: SupplierRepository;
    private poRepo: PurchaseOrderRepository;

    constructor() {
        this.supplierRepo = new SupplierRepository();
        this.poRepo = new PurchaseOrderRepository();
    }

    // ====== SUPPLIER ======
    async getSuppliers(params?: { search?: string; skip?: number; take?: number }) {
        return this.supplierRepo.findAll(params);
    }

    async getSupplierById(id: string) {
        return this.supplierRepo.findById(id);
    }

    async createSupplier(data: Prisma.SupplierCreateInput) {
        // Check duplicate code
        const existing = await this.supplierRepo.findByCode(data.code);
        if (existing) throw new Error(`Supplier code ${data.code} already exists`);
        return this.supplierRepo.create(data);
    }

    async updateSupplier(id: string, data: Prisma.SupplierUpdateInput) {
        return this.supplierRepo.update(id, data);
    }

    async deleteSupplier(id: string) {
        return this.supplierRepo.delete(id);
    }

    // ====== PURCHASE ORDER ======
    async getPurchaseOrders(params?: { search?: string; status?: PurchaseOrderStatus; skip?: number; take?: number }) {
        return this.poRepo.findAll(params);
    }

    async getPurchaseOrderById(id: string) {
        return this.poRepo.findById(id);
    }

    async createPurchaseOrder(data: Omit<Prisma.PurchaseOrderCreateInput, 'poNumber' | 'createdBy'>, userId: string) {
        const poNumber = await this.generatePONumber();
        return this.poRepo.create({
            ...data,
            poNumber,
            createdBy: userId
        } as Prisma.PurchaseOrderCreateInput);
    }

    async updatePOStatus(id: string, status: PurchaseOrderStatus, userId?: string) {
        if (userId) {
            return this.poRepo.updateStatusWithActor(id, status, userId);
        }
        return this.poRepo.updateStatus(id, status);
    }

    async updatePurchaseOrder(id: string, data: Prisma.PurchaseOrderUpdateInput) {
        return this.poRepo.update(id, data);
    }

    async deletePurchaseOrder(id: string) {
        return this.poRepo.delete(id);
    }

    // ====== COMPLEX LOGIC ======

    async getAvailablePRs() {
        return prisma.purchaseRequest.findMany({
            where: {
                status: 'APPROVED',
                purchaseOrderId: null
            },
            include: {
                requester: { select: { name: true } },
                items: {
                    include: {
                        barang: { select: { nama: true, supplierId: true } }
                    }
                }
            },
            orderBy: { tanggal: 'desc' }
        });
    }
    
    /**
     * Generate Purchase Orders from approved Purchase Requests.
     * Groups PRs by Supplier (based on Barang.supplierId).
     * If a PR has items with mixed suppliers, it assigns to the supplier of the first item (simplification)
     * or uses a fallback. Ideally PRs should be per-supplier or we need Line-Level PO linkage.
     * Given schema (PR -> PO), we assume Whole PR -> PO.
     */
    async generatePOFromPRs(prIds: string[], userId: string, overrideSupplierId?: string) {
        // 1. Fetch PRs with items and product info
        const prs = await prisma.purchaseRequest.findMany({
            where: { id: { in: prIds }, status: 'APPROVED', purchaseOrderId: null },
            include: {
                items: {
                    include: {
                        barang: { select: { id: true, nama: true, supplierId: true } }
                    }
                }
            }
        });

        if (prs.length === 0) throw new Error("No eligible APPROVED Purchase Requests found");

        // 2. Group by Supplier
        const prsBySupplier = new Map<string | null, typeof prs>();
        
        for (const pr of prs as any[]) {
            // Determine supplier for this PR
            let supplierId = overrideSupplierId || null;
            
            if (!supplierId) {
                // Try to find common supplier in items
                const suppliers = new Set(pr.items.map((i: any) => i.barang.supplierId).filter(Boolean));
                if (suppliers.size === 1) {
                    supplierId = Array.from(suppliers)[0] as string;
                } else if (suppliers.size > 1) {
                    // Mixed suppliers. Defaulting to first found.
                    supplierId = Array.from(suppliers)[0] as string;
                }
            }

            // supplierId can be null here, which is allowed now.

            const key = supplierId || 'NO_SUPPLIER';
            if (!prsBySupplier.has(key)) {
                prsBySupplier.set(key, []);
            }
            prsBySupplier.get(key)!.push(pr);
        }

        // 3. Create POs
        const results = [];
        
        for (const [key, groupPrs] of prsBySupplier) {
            const poNumber = await this.generatePONumber();
            const realSupplierId = key === 'NO_SUPPLIER' ? null : key;
            
            // Consolidate Items
            // We want to merge same items? Or list them individually?
            // Usually PO lists items individually or aggregates.
            // Let's aggregate by BarangId to avoid duplicates in PO.
            const itemMap = new Map<string, { qty: number, price: number, barangId: string }>();

            for (const pr of groupPrs) {
                for (const item of pr.items) {
                    const current = itemMap.get(item.barangId) || { qty: 0, price: item.hargaPerUnit, barangId: item.barangId };
                    current.qty += item.jumlah;
                    // Use max price to be safe? Or average? 
                    // Using the pr item's predicted unit price. 
                    // If multiple PRs have different prices for same item, we might want to prioritize higher or average.
                    // For now, simply overwriting or keeping first?
                    // Let's take the MAX price to ensure budget cover? Or just use the last one found.
                    // Using simple override for now (last one wins). 
                    // Should probably be weighted average but let's stick to simple.
                    itemMap.set(item.barangId, { ...current, price: item.hargaPerUnit });
                }
            }

            // Create PO
            const po = await prisma.$transaction(async (tx) => {
                const newPO = await tx.purchaseOrder.create({
                    data: {
                        poNumber,
                        supplierId: realSupplierId,
                        status: 'DRAFT',
                        createdBy: userId,
                        totalAmount: Array.from(itemMap.values()).reduce((sum, i: any) => sum + (i.qty * i.price), 0),
                        items: {
                            create: Array.from(itemMap.values()).map((i: any) => ({
                                id: randomUUID(),
                                barangId: i.barangId,
                                quantity: i.qty,
                                unitPrice: i.price,
                                totalPrice: i.qty * i.price
                            }))
                        },
                        purchaseRequests: {
                            connect: groupPrs.map(pr => ({ id: pr.id }))
                        }
                    }
                });

                // Update PR Status
                await tx.purchaseRequest.updateMany({
                    where: { id: { in: groupPrs.map(p => p.id) } },
                    data: { status: 'ORDERED' }
                });

                return newPO;
            });

            results.push(po);
        }

        return results;
    }

    private async generatePONumber(): Promise<string> {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const prefix = `PO/${year}/${month}`;
        
        // Find last PO info
        const lastPO = await prisma.purchaseOrder.findFirst({
            where: { poNumber: { startsWith: prefix } },
            orderBy: { poNumber: 'desc' }
        });

        let sequence = '0001';
        if (lastPO) {
            const parts = lastPO.poNumber.split('/');
            const lastSeq = parseInt(parts[parts.length - 1]);
            sequence = String(lastSeq + 1).padStart(4, '0');
        }

        return `${prefix}/${sequence}`;
    }
}
