import { Prisma } from "@prisma/client";
import type { BarangKeluar } from "@prisma/client";

import { DEFAULT_KONDISI } from "@/lib/constants/inventory";
import type { CreateBarangKeluarInput } from "./IInventoryRepository";
import { resolveInventoryActor } from "./inventory-repository-core-helpers";
import {
  assertPositiveIntegerQuantity,
  buildDecrementBarangGudangPayload,
  getConditionStockAmount,
  getStockFieldByCondition,
} from "./inventory-stock-helpers";

type StockOutContext = {
  actor: ReturnType<typeof resolveInventoryActor>;
  currentStock: { id: string; stok: number } & Record<string, unknown>;
  quantity: number;
  kondisi: string;
  stockField: string;
  conditionStock: number;
};

type CreatedKeluarWithRelations = {
  barang: { jenis: string };
  gudang: { nama: string };
  keterangan: string | null;
};

/** Kurangi stok barang dari gudang dan sinkronkan aset terkait. */
export async function removeInventoryStock(input: {
  tx: Prisma.TransactionClient;
  data: CreateBarangKeluarInput;
}): Promise<BarangKeluar> {
  const context = await buildStockOutContext(input.tx, input.data);
  await decrementWarehouseStock(input.tx, context);
  const keluar = await createBarangKeluarRecord(input.tx, input.data, context);
  await allocateStockOutAssets(input.tx, input.data, context, keluar);
  return keluar as unknown as BarangKeluar;
}

async function buildStockOutContext(
  tx: Prisma.TransactionClient,
  data: CreateBarangKeluarInput,
): Promise<StockOutContext> {
  const actor = resolveInventoryActor(data);
  assertPositiveIntegerQuantity(data.jumlah);
  const currentStock = await findRequiredStock(tx, data);
  const kondisi = data.kondisi || DEFAULT_KONDISI;
  const stockField = getStockFieldByCondition(kondisi);
  const conditionStock = getConditionStockAmount(currentStock, stockField);

  validateAvailableStock({
    currentStock,
    conditionStock,
    kondisi,
    quantity: data.jumlah,
  });
  return {
    actor,
    currentStock,
    quantity: data.jumlah,
    kondisi,
    stockField,
    conditionStock,
  };
}

async function findRequiredStock(
  tx: Prisma.TransactionClient,
  data: CreateBarangKeluarInput,
) {
  const currentStock = await tx.barangGudang.findUnique({
    where: {
      barangId_gudangId: { barangId: data.barangId, gudangId: data.gudangId },
    },
  });
  if (!currentStock) throw new Error("Stok tidak ditemukan di gudang ini");
  return currentStock as { id: string; stok: number } & Record<string, unknown>;
}

function validateAvailableStock(input: {
  currentStock: { stok: number };
  conditionStock: number;
  kondisi: string;
  quantity: number;
}) {
  if (input.currentStock.stok < input.quantity) {
    throw new Error(
      `Total stok tidak mencukupi (Tersedia: ${input.currentStock.stok})`,
    );
  }
  if (Number.isNaN(input.conditionStock)) {
    throw new Error(`Data stok tidak valid untuk kondisi ${input.kondisi}`);
  }
  if (input.conditionStock < input.quantity) {
    throw new Error(
      `Stok ${input.kondisi} tidak mencukupi (Tersedia: ${input.conditionStock})`,
    );
  }
}

async function decrementWarehouseStock(
  tx: Prisma.TransactionClient,
  context: StockOutContext,
) {
  const updated = await tx.barangGudang.updateMany({
    where: {
      id: context.currentStock.id,
      stok: { gte: context.quantity },
      [context.stockField]: { gte: context.quantity },
    },
    data: buildDecrementBarangGudangPayload({
      stockField: context.stockField,
      quantity: context.quantity,
    }),
  });

  if (updated.count === 0) {
    throw new Error(
      `Stok ${context.kondisi} tidak mencukupi atau telah berubah (Tersedia: ${context.conditionStock})`,
    );
  }
}

function createBarangKeluarRecord(
  tx: Prisma.TransactionClient,
  data: CreateBarangKeluarInput,
  context: StockOutContext,
) {
  return tx.barangKeluar.create({
    data: buildBarangKeluarCreateData(data, context),
    include: { barang: true, gudang: true },
  });
}

function buildBarangKeluarCreateData(
  data: CreateBarangKeluarInput,
  context: StockOutContext,
): Prisma.BarangKeluarUncheckedCreateInput {
  return {
    id: crypto.randomUUID(),
    barangId: data.barangId,
    gudangId: data.gudangId,
    jumlah: context.quantity,
    kondisi: data.kondisi || "BARU",
    keterangan: data.keterangan || null,
    tujuanPenggunaan: data.tujuanPenggunaan || null,
    isHilang: data.isHilang || false,
    userId: context.actor.userId,
    actorType: context.actor.actorType,
    actorId: context.actor.actorId,
    tanggal: data.tanggal || new Date(),
    fotoBukti: data.fotoBukti || [],
    fotoMetadata:
      (data.fotoMetadata as unknown as Prisma.InputJsonValue) ||
      Prisma.JsonNull,
    tenantId: data.tenantId || null,
  };
}

async function allocateStockOutAssets(
  tx: Prisma.TransactionClient,
  data: CreateBarangKeluarInput,
  context: StockOutContext,
  keluar: unknown,
) {
  const keluarWithRelations = keluar as CreatedKeluarWithRelations;
  if (keluarWithRelations.barang?.jenis !== "ASET" || data.isHilang) return;

  const assetsToAllocate = await tx.asset.findMany({
    where: {
      barangId: data.barangId,
      status: "ACTIVE",
      location: keluarWithRelations.gudang?.nama,
    },
    orderBy: [{ purchaseDate: "asc" }, { createdAt: "asc" }],
    take: context.quantity,
  });
  if (assetsToAllocate.length === 0) return;

  await tx.asset.updateMany({
    where: { id: { in: assetsToAllocate.map((asset) => asset.id) } },
    data: buildAllocatedAssetData(context, keluarWithRelations.keterangan),
  });
}

function buildAllocatedAssetData(
  context: StockOutContext,
  keterangan: string | null,
): Prisma.AssetUncheckedUpdateManyInput {
  return {
    status: "INSTALLED",
    location: `Deployed (Ref: ${keterangan || "Barang Keluar"})`,
    assignedTo: context.actor.userId,
    assignedActorType: context.actor.actorType,
    assignedActorId: context.actor.actorId,
  };
}
