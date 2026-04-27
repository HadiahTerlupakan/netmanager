import { randomUUID } from "crypto";

import type { PurchaseOrderDTO } from "../dto/ProcurementDTO";
import type { PurchaseRequestEntity } from "../domain/entities/PurchaseRequest";
import type {
  CreatePurchaseOrderItemInput,
  IProcurementRepository,
} from "../domain/ports/IProcurementRepository";
import { toPurchaseOrderDTO } from "../mappers/ProcurementMapper";
import { ProcurementRepository } from "../repositories/ProcurementRepository";

const EMPTY_RESULT_TOTAL = 0;
const NO_SUPPLIER_KEY = "NO_SUPPLIER";
const NO_ELIGIBLE_PR_ERROR = "No eligible APPROVED Purchase Requests found";

interface AggregatedPurchaseOrderItem {
  barangId: string;
  quantity: number;
  unitPrice: number;
}

export class ProcurementService {
  private readonly procurementRepository: IProcurementRepository;

  constructor(
    procurementRepository: IProcurementRepository = new ProcurementRepository(),
  ) {
    this.procurementRepository = procurementRepository;
  }

  /** Membuat purchase order dari kumpulan purchase request yang sudah approved. */
  async generatePOFromPRs(
    prIds: string[],
    userId: string,
    overrideSupplierId?: string,
  ): Promise<PurchaseOrderDTO[]> {
    const purchaseRequests =
      await this.procurementRepository.findApprovedPRs(prIds);
    validatePurchaseRequests(purchaseRequests);

    const purchaseRequestsBySupplier = groupPRsBySupplier(
      purchaseRequests,
      overrideSupplierId,
    );

    return await this.createPurchaseOrders(purchaseRequestsBySupplier, userId);
  }

  /** Menghasilkan purchase order untuk setiap grup supplier. */
  private async createPurchaseOrders(
    purchaseRequestsBySupplier: Map<string, PurchaseRequestEntity[]>,
    userId: string,
  ): Promise<PurchaseOrderDTO[]> {
    const results: PurchaseOrderDTO[] = [];

    for (const [supplierKey, purchaseRequests] of purchaseRequestsBySupplier) {
      const purchaseOrder = await this.createPurchaseOrderForSupplierGroup({
        supplierKey,
        purchaseRequests,
        userId,
      });
      results.push(toPurchaseOrderDTO(purchaseOrder));
    }

    return results;
  }

  /** Menghasilkan satu purchase order untuk satu grup supplier. */
  private async createPurchaseOrderForSupplierGroup(input: {
    supplierKey: string;
    purchaseRequests: PurchaseRequestEntity[];
    userId: string;
  }) {
    const tenantId = input.purchaseRequests[0]?.tenantId ?? null;
    const poNumber =
      await this.procurementRepository.generatePONumber(tenantId);
    const supplierId = normalizeSupplierId(input.supplierKey);
    const aggregatedItems = aggregatePurchaseOrderItems(input.purchaseRequests);

    return await this.procurementRepository.createPOWithItems({
      id: randomUUID(),
      poNumber,
      supplierId,
      createdBy: input.userId,
      tenantId,
      totalAmount: calculateTotalAmount(aggregatedItems),
      items: buildPurchaseOrderItems(aggregatedItems, tenantId),
      prIds: input.purchaseRequests.map(
        (purchaseRequest) => purchaseRequest.id,
      ),
    });
  }
}

function validatePurchaseRequests(
  purchaseRequests: PurchaseRequestEntity[],
): void {
  if (purchaseRequests.length > EMPTY_RESULT_TOTAL) {
    return;
  }

  throw new Error(NO_ELIGIBLE_PR_ERROR);
}

function groupPRsBySupplier(
  purchaseRequests: PurchaseRequestEntity[],
  overrideSupplierId?: string,
): Map<string, PurchaseRequestEntity[]> {
  const groupedPurchaseRequests = new Map<string, PurchaseRequestEntity[]>();

  for (const purchaseRequest of purchaseRequests) {
    const supplierKey = resolveSupplierGroupKey(
      purchaseRequest,
      overrideSupplierId,
    );
    const currentGroup = groupedPurchaseRequests.get(supplierKey) ?? [];
    groupedPurchaseRequests.set(supplierKey, [
      ...currentGroup,
      purchaseRequest,
    ]);
  }

  return groupedPurchaseRequests;
}

function resolveSupplierGroupKey(
  purchaseRequest: PurchaseRequestEntity,
  overrideSupplierId?: string,
): string {
  if (overrideSupplierId) {
    return overrideSupplierId;
  }

  const supplierIds = getUniqueSupplierIds(purchaseRequest);
  return supplierIds[0] ?? NO_SUPPLIER_KEY;
}

function getUniqueSupplierIds(
  purchaseRequest: PurchaseRequestEntity,
): string[] {
  return Array.from(
    new Set(
      purchaseRequest.items
        .map((item) => item.barang.supplierId)
        .filter((supplierId): supplierId is string => Boolean(supplierId)),
    ),
  );
}

function normalizeSupplierId(supplierKey: string): string | null {
  return supplierKey === NO_SUPPLIER_KEY ? null : supplierKey;
}

function aggregatePurchaseOrderItems(
  purchaseRequests: PurchaseRequestEntity[],
): AggregatedPurchaseOrderItem[] {
  const itemMap = new Map<string, AggregatedPurchaseOrderItem>();

  for (const purchaseRequest of purchaseRequests) {
    mergePurchaseRequestItems(itemMap, purchaseRequest);
  }

  return Array.from(itemMap.values());
}

function mergePurchaseRequestItems(
  itemMap: Map<string, AggregatedPurchaseOrderItem>,
  purchaseRequest: PurchaseRequestEntity,
): void {
  for (const item of purchaseRequest.items) {
    const currentItem = itemMap.get(item.barangId);
    const nextItem = buildAggregatedItem(item, currentItem);
    itemMap.set(item.barangId, nextItem);
  }
}

function buildAggregatedItem(
  item: PurchaseRequestEntity["items"][number],
  currentItem?: AggregatedPurchaseOrderItem,
): AggregatedPurchaseOrderItem {
  if (!currentItem) {
    return {
      barangId: item.barangId,
      quantity: item.jumlah,
      unitPrice: item.hargaPerUnit,
    };
  }

  return {
    barangId: item.barangId,
    quantity: currentItem.quantity + item.jumlah,
    unitPrice: item.hargaPerUnit,
  };
}

function calculateTotalAmount(items: AggregatedPurchaseOrderItem[]): number {
  return items.reduce(
    (currentTotal, item) => currentTotal + item.quantity * item.unitPrice,
    EMPTY_RESULT_TOTAL,
  );
}

function buildPurchaseOrderItems(
  items: AggregatedPurchaseOrderItem[],
  tenantId: string | null,
): CreatePurchaseOrderItemInput[] {
  return items.map((item) => ({
    id: randomUUID(),
    barangId: item.barangId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.quantity * item.unitPrice,
    tenantId,
  }));
}
