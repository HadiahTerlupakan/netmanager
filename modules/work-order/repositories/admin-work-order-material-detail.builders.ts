import { prisma } from "@/lib/prisma";

type MaterialUpdateRecord = Awaited<
  ReturnType<typeof prisma.workOrderUpdates.findUnique>
> & {
  user?: { id: string; name: string | null; email: string | null } | null;
  workOrders?: {
    workOrderNumber: string;
    usedMaterials: unknown;
    returnedMaterials: unknown;
  } | null;
};

type MaterialResponseInput = {
  id: string;
  update: NonNullable<MaterialUpdateRecord>;
  isPickup: boolean;
  barang: { kode: string; nama: string; satuan: string };
  gudang: { kode: string; nama: string };
  jumlah: number;
  kondisi: string;
  keterangan: string;
};

type MaterialRelationData = {
  barang: { kode: string; nama: string; satuan: string } | null;
  gudang: { kode: string; nama: string } | null;
};

export interface MaterialMessageParseResult {
  namaBarang: string;
  kondisi: string;
  jumlah: number;
  satuan: string;
}

export interface MaterialSourceItem {
  id?: string;
  nama?: string;
  barangId?: string;
  gudangId?: string | null;
  barang?: { id?: string; nama?: string };
  gudang?: { id?: string };
}

export function getSourceMaterials(
  workOrder: { usedMaterials: unknown; returnedMaterials: unknown } | null,
  isPickup: boolean,
): MaterialSourceItem[] {
  if (!workOrder) return [];

  const materials = isPickup
    ? workOrder.usedMaterials
    : workOrder.returnedMaterials;
  return (materials as MaterialSourceItem[]) || [];
}

export function parseMaterialMessage(
  message: string,
): MaterialMessageParseResult | null {
  const materialInfo =
    message.match(/(?:Mengambil|Mengembalikan) barang: (.+)/)?.[1] ?? message;
  const detailMatch = materialInfo.match(/^(.+?) - (\w+) \((\d+) (.+?)\)/);

  if (!detailMatch) return null;

  return {
    namaBarang: detailMatch[1] || "Barang",
    kondisi: detailMatch[2] || "BARU",
    jumlah: Number.parseInt(detailMatch[3] || "1", 10) || 1,
    satuan: detailMatch[4] || "pcs",
  };
}

export function findMatchingMaterial(
  sourceMaterials: MaterialSourceItem[],
  namaBarang: string,
) {
  const normalizedName = namaBarang.toLowerCase().trim();
  return sourceMaterials.find((material) => {
    const materialName = (material.nama || material.barang?.nama || "")
      .toLowerCase()
      .trim();
    return (
      materialName === normalizedName || materialName.includes(normalizedName)
    );
  });
}

export function buildFallbackMaterialDetail(
  update: NonNullable<MaterialUpdateRecord>,
  message: string,
  isPickup: boolean,
  updateId: string,
) {
  return buildMaterialDetailResponse({
    id: updateId,
    update,
    isPickup,
    barang: { kode: "-", nama: "Barang", satuan: "pcs" },
    gudang: { kode: "-", nama: "Gudang" },
    jumlah: 1,
    kondisi: "BARU",
    keterangan: message,
  });
}

export function buildMinimalMaterialDetail(input: {
  update: NonNullable<MaterialUpdateRecord>;
  message: string;
  isPickup: boolean;
  parsedMessage: MaterialMessageParseResult;
  updateId: string;
}) {
  return buildMaterialDetailResponse({
    id: input.updateId,
    update: input.update,
    isPickup: input.isPickup,
    barang: buildFallbackBarang(input.parsedMessage),
    gudang: { kode: "-", nama: "Gudang" },
    jumlah: input.parsedMessage.jumlah,
    kondisi: input.parsedMessage.kondisi,
    keterangan: input.message,
  });
}

export async function buildMatchedMaterialDetail(input: {
  update: NonNullable<MaterialUpdateRecord>;
  matchingMaterial: MaterialSourceItem;
  isPickup: boolean;
  parsedMessage: MaterialMessageParseResult;
  updateId: string;
}) {
  const pickupDetail = await findPickupDetail(
    input.matchingMaterial.id,
    input.isPickup,
  );
  if (pickupDetail) {
    return mapPickupMaterialDetail(pickupDetail, input.update.user);
  }

  const relationData = await findMaterialRelations(input.matchingMaterial);
  return buildMaterialDetailResponse(
    buildMatchedMaterialResponse(input, relationData),
  );
}

function buildMatchedMaterialResponse(
  input: {
    update: NonNullable<MaterialUpdateRecord>;
    matchingMaterial: MaterialSourceItem;
    isPickup: boolean;
    parsedMessage: MaterialMessageParseResult;
    updateId: string;
  },
  relationData: MaterialRelationData,
): MaterialResponseInput {
  return {
    id: input.matchingMaterial.id || input.updateId,
    update: input.update,
    isPickup: input.isPickup,
    barang: buildFallbackBarang(input.parsedMessage, relationData.barang),
    gudang: relationData.gudang || { kode: "-", nama: "Gudang" },
    jumlah: input.parsedMessage.jumlah,
    kondisi: input.parsedMessage.kondisi,
    keterangan: buildMatchedMaterialDescription(input.update, input.isPickup),
  };
}

function buildFallbackBarang(
  parsedMessage: MaterialMessageParseResult,
  barang?: { kode: string; nama: string; satuan: string } | null,
) {
  return (
    barang || {
      kode: "-",
      nama: parsedMessage.namaBarang.trim(),
      satuan: parsedMessage.satuan,
    }
  );
}

function buildMatchedMaterialDescription(
  update: NonNullable<MaterialUpdateRecord>,
  isPickup: boolean,
) {
  return `${isPickup ? "Pengambilan" : "Pengembalian"} untuk Work Order ${update.workOrders?.workOrderNumber}`;
}

function buildMaterialDetailResponse(input: MaterialResponseInput) {
  const isoDate = input.update.createdAt.toISOString();

  return {
    id: input.id,
    type: input.isPickup ? "keluar" : "masuk",
    tanggal: isoDate,
    createdAt: isoDate,
    barang: input.barang,
    gudang: input.gudang,
    jumlah: input.jumlah,
    kondisi: input.kondisi,
    keterangan: input.keterangan,
    user: input.update.user,
    fotoBukti: [] as unknown[],
  };
}

async function findMaterialRelations(
  material: MaterialSourceItem,
): Promise<MaterialRelationData> {
  const barangId = material.barangId || material.barang?.id;
  const gudangId = material.gudangId || material.gudang?.id;
  const [barang, gudang] = await Promise.all([
    barangId
      ? prisma.barang.findUnique({
          where: { id: barangId },
          select: { kode: true, nama: true, satuan: true },
        })
      : null,
    gudangId
      ? prisma.gudang.findUnique({
          where: { id: gudangId },
          select: { kode: true, nama: true },
        })
      : null,
  ]);

  return { barang, gudang };
}

async function findPickupDetail(
  materialId: string | undefined,
  isPickup: boolean,
) {
  if (!isPickup || !materialId) return null;

  return prisma.barangKeluar.findUnique({
    where: { id: materialId },
    include: {
      barang: { select: { kode: true, nama: true, satuan: true } },
      gudang: { select: { kode: true, nama: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

function mapPickupMaterialDetail(
  pickupDetail: NonNullable<Awaited<ReturnType<typeof findPickupDetail>>>,
  fallbackUser: NonNullable<MaterialUpdateRecord>["user"],
) {
  return {
    id: pickupDetail.id,
    type: "keluar" as const,
    tanggal: pickupDetail.tanggal.toISOString(),
    createdAt: pickupDetail.createdAt.toISOString(),
    barang: pickupDetail.barang,
    gudang: pickupDetail.gudang,
    jumlah: pickupDetail.jumlah,
    kondisi: pickupDetail.kondisi,
    keterangan: pickupDetail.keterangan,
    user: pickupDetail.user || fallbackUser,
    fotoBukti: pickupDetail.fotoBukti || [],
  };
}
