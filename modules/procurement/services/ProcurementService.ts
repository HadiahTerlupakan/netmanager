import { randomUUID } from 'crypto';
import { ProcurementRepository } from '../repositories/ProcurementRepository';

export class ProcurementService {
    private repo: ProcurementRepository

    constructor() {
        this.repo = new ProcurementRepository()
    }

    async generatePOFromPRs(prIds: string[], userId: string, overrideSupplierId?: string) {
        const prs = await this.repo.findApprovedPRs(prIds);

        if (prs.length === 0) throw new Error("No eligible APPROVED Purchase Requests found");

        const prsBySupplier = new Map<string | null, typeof prs>();

        for (const pr of prs) {
            let supplierId = overrideSupplierId || null;

            if (!supplierId) {
                const suppliers = new Set(pr.items.map((i) => i.barang.supplierId).filter(Boolean));
                if (suppliers.size === 1) {
                    supplierId = Array.from(suppliers)[0] as string;
                } else if (suppliers.size > 1) {
                    supplierId = Array.from(suppliers)[0] as string;
                }
            }

            const key = supplierId || 'NO_SUPPLIER';
            if (!prsBySupplier.has(key)) {
                prsBySupplier.set(key, []);
            }
            prsBySupplier.get(key)!.push(pr);
        }

        const results = [];

        for (const [key, groupPrs] of prsBySupplier) {
            const tenantId = groupPrs[0]?.tenantId;
            const poNumber = await this.repo.generatePONumber(tenantId);
            const realSupplierId = key === 'NO_SUPPLIER' ? null : key;

            const itemMap = new Map<string, { qty: number, price: number, barangId: string }>();

            for (const pr of groupPrs) {
                for (const item of pr.items) {
                    const current = itemMap.get(item.barangId) || { qty: 0, price: item.hargaPerUnit, barangId: item.barangId };
                    current.qty += item.jumlah;
                    itemMap.set(item.barangId, { ...current, price: item.hargaPerUnit });
                }
            }

            const po = await this.repo.createPOWithItems({
                id: randomUUID(),
                poNumber,
                supplierId: realSupplierId,
                status: 'DRAFT',
                createdBy: userId,
                tenantId: tenantId,
                totalAmount: Array.from(itemMap.values()).reduce((sum, i) => sum + (i.qty * i.price), 0),
                items: Array.from(itemMap.values()).map((i) => ({
                    id: randomUUID(),
                    barangId: i.barangId,
                    quantity: i.qty,
                    unitPrice: i.price,
                    totalPrice: i.qty * i.price,
                    tenantId: tenantId
                })),
                prIds: groupPrs.map(pr => pr.id)
            });

            results.push(po);
        }

        return results;
    }
}
