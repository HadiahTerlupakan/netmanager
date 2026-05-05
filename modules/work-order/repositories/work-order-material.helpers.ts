import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type {
  MobileWorkOrderMaterialInput,
  MobileWorkOrderMaterialResult,
  MobileWorkOrderMaterialTarget,
} from "./WorkOrderMaterialRepository";

type MobileMaterialCondition = NonNullable<
  MobileWorkOrderMaterialInput["kondisi"]
>;
type MaterialTransaction = Prisma.TransactionClient;

export async function createMobileMaterialUsage(params: {
  tx: MaterialTransaction;
  workOrder: MobileWorkOrderMaterialTarget;
  item: MobileWorkOrderMaterialInput;
  actorId: string;
}): Promise<MobileWorkOrderMaterialResult> {
  const normalizedItem = normalizeMobileMaterialItem(params.item);

  await reserveMaterialStock(
    params.tx,
    params.workOrder.tenantId,
    normalizedItem,
  );

  const keluar = await createBarangKeluarForMaterial(params.tx, {
    item: normalizedItem,
    workOrder: params.workOrder,
    actorId: params.actorId,
  });

  return mapMobileMaterialUsageResult(keluar, normalizedItem);
}

export async function appendUsedMaterialsToWorkOrder(
  tx: MaterialTransaction,
  workOrderId: string,
  createdItems: MobileWorkOrderMaterialResult[],
) {
  await tx.$executeRaw`
    UPDATE "work_orders"
    SET "usedMaterials" = COALESCE("usedMaterials", '[]'::jsonb) || ${JSON.stringify(createdItems)}::jsonb,
        "updatedAt" = NOW()
    WHERE "id" = ${workOrderId}
  `;
}

export function createMaterialPickupMessage(
  createdItems: MobileWorkOrderMaterialResult[],
) {
  return createdItems
    .map(
      (item) =>
        `${item.nama} - ${item.kondisi} (${item.jumlah} ${item.satuan})`,
    )
    .join(", ");
}

function normalizeMobileMaterialItem(item: MobileWorkOrderMaterialInput) {
  const jumlah = Math.floor(item.jumlah);
  if (jumlah <= 0) throw new Error("Jumlah harus angka bulat positif");
  if (jumlah !== item.jumlah) {
    throw new Error("Jumlah material harus angka bulat (tidak boleh desimal)");
  }

  return {
    barangId: item.barangId,
    gudangId: item.gudangId,
    jumlah,
    kondisi: item.kondisi || "BARU",
  };
}

async function reserveMaterialStock(
  tx: MaterialTransaction,
  tenantId: string,
  item: ReturnType<typeof normalizeMobileMaterialItem>,
) {
  const stockRecord = await findMaterialStock(tx, {
    barangId: item.barangId,
    gudangId: item.gudangId,
    tenantId,
  });

  assertMaterialStockAvailable(stockRecord, item);
  await decrementMaterialStock(tx, stockRecord.id, item);
}

function mapMobileMaterialUsageResult(
  keluar: Awaited<ReturnType<typeof createBarangKeluarForMaterial>>,
  item: ReturnType<typeof normalizeMobileMaterialItem>,
): MobileWorkOrderMaterialResult {
  return {
    id: keluar.id,
    nama: keluar.barang.nama,
    jumlah: item.jumlah,
    satuan: keluar.barang.satuan,
    kondisi: item.kondisi,
    barangId: item.barangId,
    gudangId: item.gudangId,
  };
}

async function createBarangKeluarForMaterial(
  tx: MaterialTransaction,
  params: {
    item: ReturnType<typeof normalizeMobileMaterialItem>;
    workOrder: MobileWorkOrderMaterialTarget;
    actorId: string;
  },
) {
  return tx.barangKeluar.create({
    data: {
      id: randomUUID(),
      barangId: params.item.barangId,
      gudangId: params.item.gudangId,
      jumlah: params.item.jumlah,
      kondisi: params.item.kondisi,
      userId: params.actorId,
      purpose: `Work Order: ${params.workOrder.workOrderNumber}`,
      keterangan: `Digunakan untuk work order ${params.workOrder.workOrderNumber} - ${params.workOrder.title}`,
      tenantId: params.workOrder.tenantId,
    },
    include: { barang: true },
  });
}

async function findMaterialStock(
  tx: MaterialTransaction,
  input: { barangId: string; gudangId: string; tenantId: string },
) {
  const stockRecord = await tx.barangGudang.findFirst({
    where: input,
    include: { barang: true },
  });

  if (!stockRecord) throw new Error("Data stok tidak ditemukan di gudang ini");
  return stockRecord;
}

function assertMaterialStockAvailable(
  stockRecord: Awaited<ReturnType<typeof findMaterialStock>>,
  item: ReturnType<typeof normalizeMobileMaterialItem>,
) {
  const availableStock = stockRecord[getStockField(item.kondisi)];
  if (availableStock >= item.jumlah) return;

  throw new Error(
    `Stok ${item.kondisi} tidak mencukupi untuk barang ${stockRecord.barang.nama}. Tersedia: ${availableStock}`,
  );
}

async function decrementMaterialStock(
  tx: MaterialTransaction,
  stockRecordId: string,
  item: ReturnType<typeof normalizeMobileMaterialItem>,
) {
  const stockField = getStockField(item.kondisi);
  const updatedStock = await tx.barangGudang.updateMany({
    where: { id: stockRecordId, [stockField]: { gte: item.jumlah } },
    data: buildStockDecrement(item),
  });

  if (updatedStock.count === 0) {
    throw new Error("Stok material tidak mencukupi atau telah berubah");
  }
}

function buildStockDecrement(
  item: ReturnType<typeof normalizeMobileMaterialItem>,
): Prisma.BarangGudangUpdateInput {
  const updateData: Prisma.BarangGudangUpdateInput = {
    stok: { decrement: item.jumlah },
  };

  updateData[getStockField(item.kondisi)] = { decrement: item.jumlah };
  return updateData;
}

function getStockField(condition: MobileMaterialCondition) {
  if (condition === "BARU") return "stokBaru";
  if (condition === "BEKAS") return "stokBekas";
  return "stokRusak";
}
