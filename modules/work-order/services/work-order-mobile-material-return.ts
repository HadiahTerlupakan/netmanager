import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import type { WorkOrderStatus } from "../types/work-order.enums";
import type { InventoryStockService } from "@/modules/inventory";
import type { KondisiBarang } from "@/modules/inventory/types/asset.enums";
import type {
  MobileWorkOrderMaterialReturnInput,
  MobileWorkOrderMaterialReturnResult,
  UserContext,
} from "./work-order-service.contracts";

const DEFAULT_MATERIAL_CONDITION = "BEKAS" as KondisiBarang;

interface WorkOrderMaterialReturnContext {
  id: string;
  tenantId: string | null;
  workOrderNumber: string;
  title: string;
  status: WorkOrderStatus;
}

type TransactionClient = Parameters<PrismaClient["$transaction"]>[0] extends (
  arg: infer T,
) => Promise<unknown>
  ? T
  : never;

/** Proses pengembalian material mobile dalam satu transaksi. */
export async function processMobileMaterialReturn(input: {
  prismaClient: PrismaClient;
  inventoryService: InventoryStockService;
  workOrder: WorkOrderMaterialReturnContext;
  items: MobileWorkOrderMaterialReturnInput[];
  userContext: UserContext;
  tenantId?: string;
}): Promise<MobileWorkOrderMaterialReturnResult[]> {
  return input.prismaClient.$transaction((transaction) =>
    executeMaterialReturnTransaction({
      transaction,
      inventoryService: input.inventoryService,
      workOrder: input.workOrder,
      items: input.items,
      userContext: input.userContext,
      tenantId: input.tenantId,
    }),
  );
}

async function executeMaterialReturnTransaction(input: {
  transaction: TransactionClient;
  inventoryService: InventoryStockService;
  workOrder: WorkOrderMaterialReturnContext;
  items: MobileWorkOrderMaterialReturnInput[];
  userContext: UserContext;
  tenantId?: string;
}): Promise<MobileWorkOrderMaterialReturnResult[]> {
  const createdItems = await createReturnedItems(input);
  await appendReturnedMaterials(
    input.transaction,
    input.workOrder.id,
    createdItems,
  );
  await createMaterialReturnUpdate({
    transaction: input.transaction,
    workOrder: input.workOrder,
    userContext: input.userContext,
    tenantId: input.tenantId,
    items: createdItems,
  });
  return createdItems;
}

async function createReturnedItems(input: {
  transaction: TransactionClient;
  inventoryService: InventoryStockService;
  workOrder: WorkOrderMaterialReturnContext;
  items: MobileWorkOrderMaterialReturnInput[];
  userContext: UserContext;
  tenantId?: string;
}): Promise<MobileWorkOrderMaterialReturnResult[]> {
  const createdItems: MobileWorkOrderMaterialReturnResult[] = [];
  for (const item of input.items) {
    createdItems.push(await createReturnedItem({ ...input, item }));
  }
  return createdItems;
}

async function createReturnedItem(input: {
  transaction: TransactionClient;
  inventoryService: InventoryStockService;
  workOrder: WorkOrderMaterialReturnContext;
  item: MobileWorkOrderMaterialReturnInput;
  userContext: UserContext;
  tenantId?: string;
}): Promise<MobileWorkOrderMaterialReturnResult> {
  const kondisi = input.item.kondisi || DEFAULT_MATERIAL_CONDITION;
  const stockIn = await input.inventoryService.addStockInTransaction(
    input.transaction,
    buildReturnedStockInput(input, kondisi),
  );
  return mapReturnedMaterial(stockIn, input.item, kondisi);
}

function buildReturnedStockInput(
  input: {
    workOrder: WorkOrderMaterialReturnContext;
    item: MobileWorkOrderMaterialReturnInput;
    userContext: UserContext;
    tenantId?: string;
  },
  kondisi: KondisiBarang,
) {
  return {
    barangId: input.item.barangId,
    gudangId: input.item.gudangId,
    jumlah: input.item.jumlah,
    kondisi,
    userId: input.userContext.id,
    keterangan: buildReturnDescription(input.workOrder),
    tenantId: input.tenantId,
  };
}

async function appendReturnedMaterials(
  transaction: TransactionClient,
  workOrderId: string,
  items: MobileWorkOrderMaterialReturnResult[],
): Promise<void> {
  await transaction.$executeRaw`
    UPDATE "work_orders"
    SET "returnedMaterials" = COALESCE("returnedMaterials", '[]'::jsonb) || ${JSON.stringify(items)}::jsonb,
        "updatedAt" = NOW()
    WHERE "id" = ${workOrderId}
  `;
}

async function createMaterialReturnUpdate(input: {
  transaction: TransactionClient;
  workOrder: WorkOrderMaterialReturnContext;
  userContext: UserContext;
  tenantId?: string;
  items: MobileWorkOrderMaterialReturnResult[];
}): Promise<void> {
  await input.transaction.workOrderUpdates.create({
    data: buildMaterialReturnUpdateData(input),
  });
}

function buildMaterialReturnUpdateData(input: {
  workOrder: WorkOrderMaterialReturnContext;
  userContext: UserContext;
  tenantId?: string;
  items: MobileWorkOrderMaterialReturnResult[];
}) {
  return {
    id: randomUUID(),
    workOrderId: input.workOrder.id,
    createdById: input.userContext.id,
    updateType: "MATERIAL_RETURN",
    message: `Mengembalikan barang: ${buildDetailedMaterialList(input.items)}`,
    oldStatus: input.workOrder.status,
    newStatus: input.workOrder.status,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
  };
}

function mapReturnedMaterial(
  stockIn: unknown,
  item: MobileWorkOrderMaterialReturnInput,
  kondisi: string,
): MobileWorkOrderMaterialReturnResult {
  const stockRecord = stockIn as {
    id: string;
    barang: { nama: string; satuan: string };
  };
  return {
    id: stockRecord.id,
    nama: stockRecord.barang.nama,
    jumlah: item.jumlah,
    satuan: stockRecord.barang.satuan,
    kondisi,
    barangId: item.barangId,
    gudangId: item.gudangId,
  };
}

function buildReturnDescription(
  workOrder: WorkOrderMaterialReturnContext,
): string {
  return `Pengembalian dari Work Order ${workOrder.workOrderNumber} - ${workOrder.title}`;
}

function buildDetailedMaterialList(
  items: MobileWorkOrderMaterialReturnResult[],
): string {
  return items
    .map(
      (item) =>
        `${item.nama} - ${item.kondisi} (${item.jumlah} ${item.satuan})`,
    )
    .join(", ");
}
