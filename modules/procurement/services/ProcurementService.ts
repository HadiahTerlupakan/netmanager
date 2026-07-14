import { randomUUID } from "crypto";

import type { PurchaseOrderDTO } from "../dto/ProcurementDTO";
import type { PurchaseRequestEntity } from "../domain/entities/PurchaseRequest";
import type {
  CreatePurchaseOrderItemInput,
  IProcurementRepository,
  PurchaseRequestListFilter,
  PurchaseRequestListResult,
} from "../domain/ports/IProcurementRepository";
import type { ISupplierRepository } from "../domain/ports/ISupplierRepository";
import { toPurchaseOrderDTO } from "../mappers/ProcurementMapper";
import { ProcurementRepository } from "../repositories/ProcurementRepository";
import { SupplierRepository } from "../repositories/SupplierRepository";
import { SupplierNotActiveError } from "./SupplierService";

const EMPTY_RESULT_TOTAL = 0;
const NO_SUPPLIER_KEY = "NO_SUPPLIER";
const NO_ELIGIBLE_PR_ERROR = "No eligible APPROVED Purchase Requests found";

interface AggregatedPurchaseOrderItem {
  barangId: string;
  quantity: number;
  unitPrice: number;
}

interface AggregatedPurchaseOrderJasaItem {
  jasaId: string;
  quantity: number;
  unitPrice: number;
}

export class ProcurementService {
  private readonly procurementRepository: IProcurementRepository;
  private readonly supplierRepository: ISupplierRepository;

  constructor(
    procurementRepository: IProcurementRepository = new ProcurementRepository(),
    supplierRepository: ISupplierRepository = new SupplierRepository(),
  ) {
    this.procurementRepository = procurementRepository;
    this.supplierRepository = supplierRepository;
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

    await this.assertSupplierGroupsActive(purchaseRequestsBySupplier);

    return await this.createPurchaseOrders(purchaseRequestsBySupplier, userId);
  }

  /** Listing read-only purchase request — view procurement (PR pemilik tetap inventory/restock). */
  listPurchaseRequests(
    filter: PurchaseRequestListFilter,
  ): Promise<PurchaseRequestListResult> {
    return this.procurementRepository.listPurchaseRequests(filter);
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
    const aggregatedJasaItems = aggregatePurchaseOrderJasaItems(
      input.purchaseRequests,
    );
    const totalAmount =
      calculateTotalAmount(aggregatedItems) +
      calculateJasaTotalAmount(aggregatedJasaItems);

    if (aggregatedItems.length === 0 && aggregatedJasaItems.length === 0) {
      throw new Error("Purchase Request tidak memiliki item barang atau jasa");
    }

    return await this.procurementRepository.createPOWithItems({
      id: randomUUID(),
      poNumber,
      supplierId,
      createdBy: input.userId,
      tenantId,
      totalAmount,
      items: buildPurchaseOrderItems(aggregatedItems, tenantId),
      jasaItems: buildPurchaseOrderJasaItems(aggregatedJasaItems, tenantId),
      prIds: input.purchaseRequests.map(
        (purchaseRequest) => purchaseRequest.id,
      ),
    });
  }

  /**
   * Tolak generate PO jika ada supplier non-aktif/blacklisted di grup.
   * Cegah PR yang sudah approved nyangkut ke vendor bermasalah.
   */
  private async assertSupplierGroupsActive(
    groups: Map<string, PurchaseRequestEntity[]>,
  ): Promise<void> {
    const supplierIds = Array.from(groups.keys())
      .map(normalizeSupplierId)
      .filter((id): id is string => Boolean(id));

    for (const supplierId of supplierIds) {
      const supplier = await this.supplierRepository.findById(supplierId);
      if (supplier && supplier.status !== "ACTIVE") {
        throw new SupplierNotActiveError(
          supplier.id,
          supplier.status,
          supplier.blacklistReason,
        );
      }
    }
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
  const barangSupplierIds = purchaseRequest.items
    .map((item) => item.barang.supplierId)
    .filter((supplierId): supplierId is string => Boolean(supplierId));
  const jasaSupplierIds = (purchaseRequest.jasaItems ?? [])
    .map((item) => item.jasa.supplierId)
    .filter((supplierId): supplierId is string => Boolean(supplierId));
  return Array.from(new Set([...barangSupplierIds, ...jasaSupplierIds]));
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

function calculateJasaTotalAmount(
  items: AggregatedPurchaseOrderJasaItem[],
): number {
  return items.reduce(
    (currentTotal, item) => currentTotal + item.quantity * item.unitPrice,
    EMPTY_RESULT_TOTAL,
  );
}

function aggregatePurchaseOrderJasaItems(
  purchaseRequests: PurchaseRequestEntity[],
): AggregatedPurchaseOrderJasaItem[] {
  const itemMap = new Map<string, AggregatedPurchaseOrderJasaItem>();
  for (const purchaseRequest of purchaseRequests) {
    for (const item of purchaseRequest.jasaItems ?? []) {
      const current = itemMap.get(item.jasaId);
      if (!current) {
        itemMap.set(item.jasaId, {
          jasaId: item.jasaId,
          quantity: item.jumlah,
          unitPrice: item.hargaPerUnit,
        });
      } else {
        itemMap.set(item.jasaId, {
          jasaId: item.jasaId,
          quantity: current.quantity + item.jumlah,
          unitPrice: item.hargaPerUnit,
        });
      }
    }
  }
  return Array.from(itemMap.values());
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

function buildPurchaseOrderJasaItems(
  items: AggregatedPurchaseOrderJasaItem[],
  tenantId: string | null,
) {
  return items.map((item) => ({
    id: randomUUID(),
    jasaId: item.jasaId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.quantity * item.unitPrice,
    tenantId,
  }));
}
