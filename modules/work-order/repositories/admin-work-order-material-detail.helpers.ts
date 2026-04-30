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

interface MaterialMessageParseResult {
  namaBarang: string;
  kondisi: string;
  jumlah: number;
  satuan: string;
}

interface MaterialSourceItem {
  id?: string;
  nama?: string;
  barangId?: string;
  gudangId?: string | null;
  barang?: { id?: string; nama?: string };
  gudang?: { id?: string };
}

export async function findWorkOrderMaterialDetail(input: {
  workOrderId: string;
  updateId: string;
}) {
  const update = (await prisma.workOrderUpdates.findUnique({
    where: { id: input.updateId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      workOrders: {
        select: {
          workOrderNumber: true,
          usedMaterials: true,
          returnedMaterials: true,
        },
      },
    },
  })) as MaterialUpdateRecord | null;

  if (!update) return { code: "NOT_FOUND" as const };
  if (update.workOrderId !== input.workOrderId) {
    return { code: "INVALID_WORK_ORDER" as const };
  }

  return {
    code: "OK" as const,
    data: await buildMaterialDetail(update, input.updateId),
  };
}

async function buildMaterialDetail(
  update: NonNullable<MaterialUpdateRecord>,
  updateId: string,
) {
  const message = update.message || "";
  const isPickup = update.updateType === "MATERIAL_PICKUP";
  const parsedMessage = parseMaterialMessage(message);
  const sourceMaterials = getSourceMaterials(update.workOrders, isPickup);

  if (!parsedMessage)
    return buildFallbackMaterialDetail(update, message, isPickup, updateId);

  const matchingMaterial = findMatchingMaterial(
    sourceMaterials,
    parsedMessage.namaBarang,
  );
  if (!matchingMaterial) {
    return buildMinimalMaterialDetail({
      update,
      message,
      isPickup,
      parsedMessage,
      updateId,
    });
  }

  return buildMatchedMaterialDetail({
    update,
    matchingMaterial,
    isPickup,
    parsedMessage,
    updateId,
  });
}

async function buildMatchedMaterialDetail(input: {
  update: NonNullable<MaterialUpdateRecord>;
  matchingMaterial: MaterialSourceItem;
  isPickup: boolean;
  parsedMessage: MaterialMessageParseResult;
  updateId: string;
}) {
  const relationData = await findMaterialRelations(input.matchingMaterial);
  const pickupDetail = await findPickupDetail(
    input.matchingMaterial.id,
    input.isPickup,
  );

  if (pickupDetail)
    return mapPickupMaterialDetail(pickupDetail, input.update.user);

  return {
    id: input.matchingMaterial.id || input.updateId,
    type: input.isPickup ? "keluar" : "masuk",
    tanggal: input.update.createdAt.toISOString(),
    createdAt: input.update.createdAt.toISOString(),
    barang: relationData.barang || {
      kode: "-",
      nama: input.parsedMessage.namaBarang.trim(),
      satuan: input.parsedMessage.satuan,
    },
    gudang: relationData.gudang || { kode: "-", nama: "Gudang" },
    jumlah: input.parsedMessage.jumlah,
    kondisi: input.parsedMessage.kondisi,
    keterangan: `${input.isPickup ? "Pengambilan" : "Pengembalian"} untuk Work Order ${input.update.workOrders?.workOrderNumber}`,
    user: input.update.user,
    fotoBukti: [] as unknown[],
  };
}

function getSourceMaterials(
  workOrder: { usedMaterials: unknown; returnedMaterials: unknown } | null,
  isPickup: boolean,
): MaterialSourceItem[] {
  if (!workOrder) return [];

  const materials = isPickup
    ? workOrder.usedMaterials
    : workOrder.returnedMaterials;
  return (materials as MaterialSourceItem[]) || [];
}

function parseMaterialMessage(
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

function buildFallbackMaterialDetail(
  update: NonNullable<MaterialUpdateRecord>,
  message: string,
  isPickup: boolean,
  updateId: string,
) {
  return {
    id: updateId,
    type: isPickup ? "keluar" : "masuk",
    tanggal: update.createdAt.toISOString(),
    createdAt: update.createdAt.toISOString(),
    barang: { kode: "-", nama: "Barang", satuan: "pcs" },
    gudang: { kode: "-", nama: "Gudang" },
    jumlah: 1,
    kondisi: "BARU",
    keterangan: message,
    user: update.user,
    fotoBukti: [] as unknown[],
  };
}

function buildMinimalMaterialDetail(input: {
  update: NonNullable<MaterialUpdateRecord>;
  message: string;
  isPickup: boolean;
  parsedMessage: MaterialMessageParseResult;
  updateId: string;
}) {
  return {
    id: input.updateId,
    type: input.isPickup ? "keluar" : "masuk",
    tanggal: input.update.createdAt.toISOString(),
    createdAt: input.update.createdAt.toISOString(),
    barang: {
      kode: "-",
      nama: input.parsedMessage.namaBarang.trim(),
      satuan: input.parsedMessage.satuan,
    },
    gudang: { kode: "-", nama: "Gudang" },
    jumlah: input.parsedMessage.jumlah,
    kondisi: input.parsedMessage.kondisi,
    keterangan: input.message,
    user: input.update.user,
    fotoBukti: [] as unknown[],
  };
}

function findMatchingMaterial(
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

async function findMaterialRelations(material: MaterialSourceItem) {
  const barangId = material.barangId || material.barang?.id;
  const gudangId = material.gudangId || material.gudang?.id;
  const [barang, gudang] = await Promise.all([
    barangId
      ? prisma.barang.findUnique({
          where: { id: barangId },
          select: { id: true, kode: true, nama: true, satuan: true },
        })
      : null,
    gudangId
      ? prisma.gudang.findUnique({
          where: { id: gudangId },
          select: { id: true, kode: true, nama: true },
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
      user: { select: { name: true, email: true } },
    },
  });
}

function mapPickupMaterialDetail(
  pickupDetail: NonNullable<Awaited<ReturnType<typeof findPickupDetail>>>,
  fallbackUser: NonNullable<MaterialUpdateRecord>["user"],
) {
  return {
    id: pickupDetail.id,
    type: "keluar",
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
