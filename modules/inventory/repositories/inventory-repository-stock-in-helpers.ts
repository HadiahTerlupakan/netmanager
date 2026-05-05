import { randomUUID } from "crypto";
import { Prisma, type BarangMasuk } from "@prisma/client";
import { USEFUL_LIFE_MONTHS } from "@/lib/constants/inventory";
import type { CreateBarangMasukInput } from "../domain/ports/IInventoryOperationRepository";
import { resolveInventoryActor } from "./inventory-repository-core-helpers";
import { buildIncrementBarangGudangPayload } from "./inventory-stock-helpers";

type InventoryMasukWithRelations = Prisma.BarangMasukGetPayload<{
  include: {
    barang: true;
    gudang: true;
    user: { select: { id: true; name: true } };
  };
}>;

/** Tambahkan stok barang dan sinkronkan asset serta saldo gudang. */
export async function addInventoryStockInTransaction(
  tx: Prisma.TransactionClient,
  data: CreateBarangMasukInput,
): Promise<BarangMasuk> {
  const actor = resolveInventoryActor(data);
  await validateInventoryTenantScope(tx, data);

  const masuk = await tx.barangMasuk.create({
    data: {
      id: randomUUID(),
      barangId: data.barangId,
      gudangId: data.gudangId,
      jumlah: data.jumlah,
      hargaBeliSatuan: data.hargaBeliSatuan || 0,
      kondisi: data.kondisi || "BARU",
      keterangan: data.keterangan || null,
      supplier: data.supplier || null,
      userId: actor.userId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      tanggal: data.tanggal || new Date(),
      fotoBukti: data.fotoBukti || [],
      fotoMetadata:
        (data.fotoMetadata as unknown as Prisma.InputJsonValue) ||
        Prisma.JsonNull,
      tenantId: data.tenantId || null,
    },
    include: {
      barang: true,
      gudang: true,
      user: { select: { id: true, name: true } },
    },
  });

  await createAssetsForIncomingStock(tx, masuk, data);
  await upsertIncomingStockBalance(tx, data);

  return masuk as unknown as BarangMasuk;
}

async function validateInventoryTenantScope(
  tx: Prisma.TransactionClient,
  data: CreateBarangMasukInput,
) {
  if (!data.tenantId) return;

  const [barang, gudang] = await Promise.all([
    tx.barang.findFirst({
      where: { id: data.barangId, tenantId: data.tenantId },
      select: { id: true },
    }),
    tx.gudang.findFirst({
      where: { id: data.gudangId, tenantId: data.tenantId },
      select: { id: true },
    }),
  ]);

  if (!barang) throw new Error("Barang tidak ditemukan");
  if (!gudang) throw new Error("Gudang tidak ditemukan");
}

async function createAssetsForIncomingStock(
  tx: Prisma.TransactionClient,
  masuk: InventoryMasukWithRelations,
  data: CreateBarangMasukInput,
) {
  if (!isAssetBarang(masuk.barang)) return;

  const usefulLife = getUsefulLife(masuk.barang.kategoriAset);
  const assetsToCreate: Prisma.AssetCreateManyInput[] = Array.from(
    { length: data.jumlah },
    (_, index) => ({
      id: randomUUID(),
      barangId: data.barangId,
      kodeAsset: buildAssetCode(masuk.barang.kode, index),
      purchaseDate: data.tanggal || new Date(),
      purchasePrice: data.hargaBeliSatuan || 0,
      currentValue: data.hargaBeliSatuan || 0,
      usefulLife,
      residualValue: 0,
      status: "ACTIVE" as const,
      location: masuk.gudang?.nama || "Gudang Utama",
      assignedTo: null as string | null,
      assignedActorType: null as string | null,
      assignedActorId: null as string | null,
      tenantId: data.tenantId || null,
    }),
  );

  if (assetsToCreate.length === 0) return;
  await tx.asset.createMany({ data: assetsToCreate });
}

function isAssetBarang(barang: { jenis: string }) {
  return barang.jenis === "ASET";
}

function getUsefulLife(kategoriAset?: keyof typeof USEFUL_LIFE_MONTHS | null) {
  if (!kategoriAset) return USEFUL_LIFE_MONTHS.LAINNYA;
  return USEFUL_LIFE_MONTHS[kategoriAset] || USEFUL_LIFE_MONTHS.LAINNYA;
}

function buildAssetCode(kodeBarang: string, index: number) {
  const prefix = `AST-${kodeBarang}`;
  const dateCode = new Date().toISOString().slice(2, 7).replace("-", "");
  const timestamp = Date.now().toString(36).toUpperCase();
  const uniqueSuffix = `${timestamp}${index.toString().padStart(3, "0")}`;
  return `${prefix}-${dateCode}-${uniqueSuffix}`;
}

async function upsertIncomingStockBalance(
  tx: Prisma.TransactionClient,
  data: CreateBarangMasukInput,
) {
  const stockMutation = buildIncrementBarangGudangPayload({
    barangId: data.barangId,
    gudangId: data.gudangId,
    quantity: data.jumlah,
    kondisi: data.kondisi,
    tenantId: data.tenantId,
  });

  await tx.barangGudang.upsert({
    where: {
      barangId_gudangId: { barangId: data.barangId, gudangId: data.gudangId },
    },
    create: stockMutation.create,
    update: stockMutation.update,
  });
}
