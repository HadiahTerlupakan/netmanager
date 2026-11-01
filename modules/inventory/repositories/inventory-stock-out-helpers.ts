import { Prisma } from "@prisma/client";
import type { BarangKeluar } from "@prisma/client";

import { DEFAULT_KONDISI } from "@/lib/constants/inventory";
import {
  INVENTORY_USER_ERROR_STATUS,
  InventoryUserError,
  labelKondisiBarang,
} from "../domain/inventory-user-error";
import type { CreateBarangKeluarInput } from "../domain/ports/IInventoryOperationRepository";
import { resolveInventoryActor } from "./inventory-repository-core-helpers";
import {
  assertPositiveIntegerQuantity,
  buildDecrementBarangGudangPayload,
  getConditionStockAmount,
  getStockFieldByCondition,
} from "./inventory-stock-helpers";

/** Nama barang & gudang untuk pesan yang dibaca staf. */
type StockOutLabels = { barang: string; satuan: string; gudang: string };

type StockRecordWithLabels = { id: string; stok: number } & Record<
  string,
  unknown
> & {
    barang: { nama: string; satuan: string };
    gudang: { nama: string };
  };

type StockOutContext = {
  actor: ReturnType<typeof resolveInventoryActor>;
  currentStock: StockRecordWithLabels;
  labels: StockOutLabels;
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
  const labels: StockOutLabels = {
    barang: currentStock.barang.nama,
    satuan: currentStock.barang.satuan,
    gudang: currentStock.gudang.nama,
  };
  const kondisi = data.kondisi || DEFAULT_KONDISI;
  const stockField = getStockFieldByCondition(kondisi);
  const conditionStock = getConditionStockAmount(currentStock, stockField);

  validateAvailableStock({
    currentStock,
    conditionStock,
    kondisi,
    quantity: data.jumlah,
    labels,
  });
  return {
    actor,
    currentStock,
    labels,
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
    include: {
      barang: { select: { nama: true, satuan: true } },
      gudang: { select: { nama: true } },
    },
  });
  if (!currentStock) throw await buildMissingStockError(tx, data);
  return currentStock as unknown as StockRecordWithLabels;
}

/** Jelaskan kenapa barang belum punya stok di gudang yang dipilih. */
async function buildMissingStockError(
  tx: Prisma.TransactionClient,
  data: CreateBarangKeluarInput,
): Promise<InventoryUserError> {
  const [barang, gudang] = await Promise.all([
    tx.barang.findUnique({
      where: { id: data.barangId },
      select: { nama: true },
    }),
    tx.gudang.findUnique({
      where: { id: data.gudangId },
      select: { nama: true },
    }),
  ]);
  if (!barang || !gudang) {
    return new InventoryUserError(
      `${barang ? "Gudang" : "Barang"} yang dipilih tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman, lalu pilih lagi.`,
      INVENTORY_USER_ERROR_STATUS.NOT_FOUND,
    );
  }
  return new InventoryUserError(
    `${barang.nama} tidak ada di ${gudang.nama}, jadi tidak bisa dikeluarkan dari sana. Pilih gudang yang memang menyimpan barang ini.`,
  );
}

function validateAvailableStock(input: {
  currentStock: { stok: number };
  conditionStock: number;
  kondisi: string;
  quantity: number;
  labels: StockOutLabels;
}) {
  const { barang, satuan, gudang } = input.labels;
  if (input.currentStock.stok < input.quantity) {
    throw new InventoryUserError(
      `Stok ${barang} di ${gudang} tinggal ${input.currentStock.stok} ${satuan}, tapi Anda mau mengeluarkan ${input.quantity} ${satuan}. ` +
        `Kurangi jumlahnya, paling banyak ${input.currentStock.stok}.`,
    );
  }
  if (Number.isNaN(input.conditionStock)) {
    // Data stok rusak di database: bukan kesalahan staf, biarkan jadi error server.
    throw new Error(`Data stok tidak valid untuk kondisi ${input.kondisi}`);
  }
  if (input.conditionStock < input.quantity) {
    const kondisi = labelKondisiBarang(input.kondisi);
    throw new InventoryUserError(
      `Stok ${barang} kondisi ${kondisi} di ${gudang} tinggal ${input.conditionStock} ${satuan}, tapi Anda mau mengeluarkan ${input.quantity} ${satuan}. ` +
        `Kurangi jumlahnya, atau pilih kondisi lain yang stoknya cukup.`,
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
    throw new InventoryUserError(
      `Stok ${context.labels.barang} di ${context.labels.gudang} baru saja berubah, karena ada orang lain yang mencatat di waktu yang sama. ` +
        "Muat ulang halaman untuk melihat stok terbaru, lalu coba lagi.",
      INVENTORY_USER_ERROR_STATUS.CONFLICT,
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
