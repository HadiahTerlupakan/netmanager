import { randomUUID } from "crypto";
import type { PrismaClient, WorkOrderStatus } from "@prisma/client";
import type { InventoryStockService } from "@/modules/inventory";
import type {
  MobileWorkOrderMaterialReturnInput,
  MobileWorkOrderMaterialReturnResult,
  UserContext,
} from "./work-order-service.contracts";

const DEFAULT_MATERIAL_CONDITION = "BEKAS" as const;

interface WorkOrderMaterialReturnContext {
  id: string;
  tenantId: string | null;
  workOrderNumber: string;
  title: string;
  status: WorkOrderStatus;
}

/** Proses pengembalian material mobile dalam satu transaksi. */
export async function processMobileMaterialReturn(input: {
  prismaClient: PrismaClient;
  inventoryService: InventoryStockService;
  workOrder: WorkOrderMaterialReturnContext;
  items: MobileWorkOrderMaterialReturnInput[];
  userContext: UserContext;
  tenantId?: string;
}): Promise<MobileWorkOrderMaterialReturnResult[]> {
  return input.prismaClient.$transaction(async (tx) => {
    const createdItems = await createReturnedItems({
      transaction: tx,
      inventoryService: input.inventoryService,
      workOrder: input.workOrder,
      items: input.items,
      userContext: input.userContext,
      tenantId: input.tenantId,
    });
    await appendReturnedMaterials(tx, input.workOrder.id, createdItems);
    await createMaterialReturnUpdate({
      transaction: tx,
      workOrder: input.workOrder,
      userContext: input.userContext,
      tenantId: input.tenantId,
      items: createdItems,
    });
    return createdItems;
  });
}

async function createReturnedItems(input: {
  transaction: Parameters<PrismaClient["$transaction"]>[0] extends (
    arg: infer T,
  ) => Promise<unknown>
    ? T
    : never;
  inventoryService: InventoryStockService;
  workOrder: WorkOrderMaterialReturnContext;
  items: MobileWorkOrderMaterialReturnInput[];
  userContext: UserContext;
  tenantId?: string;
}): Promise<MobileWorkOrderMaterialReturnResult[]> {
  const createdItems: MobileWorkOrderMaterialReturnResult[] = [];
  for (const item of input.items) {
    const kondisi = item.kondisi || DEFAULT_MATERIAL_CONDITION;
    const stockIn = await input.inventoryService.addStockInTransaction(
      input.transaction,
      {
        barangId: item.barangId,
        gudangId: item.gudangId,
        jumlah: item.jumlah,
        kondisi,
        userId: input.userContext.id,
        keterangan: buildReturnDescription(input.workOrder),
        tenantId: input.tenantId,
      },
    );
    createdItems.push(mapReturnedMaterial(stockIn, item, kondisi));
  }
  return createdItems;
}

async function appendReturnedMaterials(
  transaction: Parameters<PrismaClient["$transaction"]>[0] extends (
    arg: infer T,
  ) => Promise<unknown>
    ? T
    : never,
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
  transaction: Parameters<PrismaClient["$transaction"]>[0] extends (
    arg: infer T,
  ) => Promise<unknown>
    ? T
    : never;
  workOrder: WorkOrderMaterialReturnContext;
  userContext: UserContext;
  tenantId?: string;
  items: MobileWorkOrderMaterialReturnResult[];
}): Promise<void> {
  await input.transaction.workOrderUpdates.create({
    data: {
      id: randomUUID(),
      workOrderId: input.workOrder.id,
      createdById: input.userContext.id,
      updateType: "MATERIAL_RETURN",
      message: `Mengembalikan barang: ${buildDetailedMaterialList(input.items)}`,
      oldStatus: input.workOrder.status,
      newStatus: input.workOrder.status,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    },
  });
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
