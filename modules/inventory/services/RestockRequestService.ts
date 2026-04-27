import { NextResponse } from "next/server";

import { PurchaseOrderStatus } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { ProcurementService } from "@/modules/procurement";

const DEFAULT_ASSET_USEFUL_LIFE = 48;
const VEHICLE_ASSET_USEFUL_LIFE = 96;
const BUILDING_ASSET_USEFUL_LIFE = 240;
const FURNITURE_ASSET_USEFUL_LIFE = 96;
const REQUEST_NUMBER_PAD_LENGTH = 4;
const DEFAULT_RECEIVED_QUANTITY = 0;
const ONE_DAY_OFFSET = 1;
const ASSET_CODE_SLICE_START = 2;
const ASSET_CODE_SLICE_END = 7;
const TIMESTAMP_SUFFIX_LENGTH = 6;
const ASSET_SEQUENCE_PAD_LENGTH = 2;

const procurementService = new ProcurementService();

type RestockAction = "APPROVE" | "REJECT" | "START_SHOPPING" | "RECEIVE";

interface RestockRequestItemInput {
  barangId: string;
  quantity: number;
  keterangan?: string | null;
}

interface CreateRestockRequestInput {
  items: RestockRequestItemInput[];
  gudangId: string;
  keterangan?: string;
  requesterId: string;
  tenantId?: string | null;
  apiPath: string;
}

interface RestockRequestLifecycleInput {
  id: string;
  action: unknown;
  catatan: string | null | undefined;
  actorId: string;
}

interface RestockRequestStatusInput {
  purchaseOrderId: string;
  action: unknown;
  items?: Record<string, number>;
  closePO?: boolean;
  actorId: string;
  fotoBukti?: string[];
}

interface AssetCreationInput {
  barangId: string;
  barangKode: string;
  kategoriAset: string | null;
  unitPrice: number;
  quantity: number;
  location: string;
  timestamp: Date;
}

/** Buat purchase request restock baru. */
export async function createRestockRequest(input: CreateRestockRequestInput) {
  const startTime = Date.now();

  try {
    const validationError = validateRestockRequestInput(input);
    if (validationError) {
      return validationError;
    }

    const nomorRequest = await generatePurchaseRequestNumber(input.tenantId);
    const purchaseRequest = await createPurchaseRequestRecord(
      input,
      nomorRequest,
    );

    logger.apiRequest("POST", input.apiPath, 201, Date.now() - startTime, {
      userId: input.requesterId,
      prId: purchaseRequest.id,
    });

    return NextResponse.json(purchaseRequest, { status: 201 });
  } catch (error: unknown) {
    const applicationError =
      error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating purchase request", applicationError, {
      path: input.apiPath,
      method: "POST",
    });

    return NextResponse.json(
      { error: "Gagal membuat Purchase Request" },
      { status: 500 },
    );
  }
}

/** Ambil detail purchase request restock. */
export async function getRestockRequestDetail(id: string) {
  try {
    const purchaseRequest = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { name: true, email: true } },
        gudang: { select: { nama: true, kode: true } },
        items: {
          include: {
            barang: { select: { nama: true, kode: true, satuan: true } },
          },
        },
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
      },
    });

    if (!purchaseRequest) {
      return NextResponse.json(
        { error: "Purchase Request not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(purchaseRequest);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/** Ubah lifecycle approval purchase request restock. */
export async function patchRestockRequestLifecycle(
  input: RestockRequestLifecycleInput,
) {
  const startTime = Date.now();

  try {
    const normalizedAction = parseLifecycleAction(input.action);
    if (!normalizedAction) {
      return NextResponse.json(
        { error: "Aksi tidak valid. Harus APPROVE atau REJECT" },
        { status: 400 },
      );
    }

    const existingRequest = await getPurchaseRequestForLifecycle(input.id);
    if (!existingRequest) {
      return NextResponse.json(
        { error: "Purchase Request not found" },
        { status: 404 },
      );
    }

    if (existingRequest.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Cannot ${normalizedAction.toLowerCase()} PR with status ${existingRequest.status}`,
        },
        { status: 400 },
      );
    }

    if (normalizedAction === "REJECT") {
      return await rejectPurchaseRequest(existingRequest, input);
    }

    return await approvePurchaseRequest(existingRequest, input, startTime);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    logger.error(
      "Error updating purchase request",
      error instanceof Error ? error : new Error(errorMessage),
      {
        path: "/api/inventory/restock/requests/[id]",
        method: "PATCH",
      },
    );

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/** Ubah status proses purchase order dari restock request. */
export async function patchRestockRequestStatus(
  input: RestockRequestStatusInput,
) {
  try {
    const purchaseOrder = await getPurchaseOrderWithItems(
      input.purchaseOrderId,
    );
    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase Order not found" },
        { status: 404 },
      );
    }

    if (input.action === "START_SHOPPING") {
      return await startPurchaseOrderShopping(
        purchaseOrder.id,
        purchaseOrder.status,
        input.actorId,
      );
    }

    if (input.action !== "RECEIVE") {
      return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
    }

    if (!canReceivePurchaseOrder(purchaseOrder.status)) {
      return NextResponse.json(
        { error: "Hanya PO dalam proses yang bisa diterima" },
        { status: 400 },
      );
    }

    if (!input.fotoBukti?.length) {
      return NextResponse.json(
        { error: "Foto bukti penerimaan barang wajib diunggah" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (transaction) => {
      const freshPurchaseOrder = await transaction.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
        include: {
          items: {
            include: { barang: true },
          },
        },
      });

      if (!freshPurchaseOrder || freshPurchaseOrder.items.length === 0) {
        throw new Error("Purchase Order tidak memiliki items");
      }

      for (const item of freshPurchaseOrder.items) {
        await processPurchaseOrderItem({
          transaction,
          item,
          purchaseOrderId: input.purchaseOrderId,
          actorId: input.actorId,
          fotoBukti: input.fotoBukti,
          poNumber: freshPurchaseOrder.poNumber,
          receivedItems: input.items ?? {},
        });
      }

      return await finalizePurchaseOrderReceipt({
        transaction,
        purchaseOrderId: input.purchaseOrderId,
        actorId: input.actorId,
        closePO: input.closePO,
        fotoBukti: input.fotoBukti,
      });
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function validateRestockRequestInput(input: CreateRestockRequestInput) {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return NextResponse.json(
      { error: "Daftar item wajib diisi (minimal 1 item)" },
      { status: 400 },
    );
  }

  if (!input.gudangId) {
    return NextResponse.json(
      { error: "Gudang tujuan wajib dipilih" },
      { status: 400 },
    );
  }

  return null;
}

async function generatePurchaseRequestNumber(tenantId?: string | null) {
  const now = new Date();
  const dateString = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PR-${dateString}-`;
  const lastPurchaseRequest = await prisma.purchaseRequest.findFirst({
    where: {
      tenantId,
      nomorRequest: { startsWith: prefix },
    },
    orderBy: { nomorRequest: "desc" },
  });

  const nextSequence = getNextRequestSequence(
    lastPurchaseRequest?.nomorRequest,
  );
  return `${prefix}${nextSequence.toString().padStart(REQUEST_NUMBER_PAD_LENGTH, "0")}`;
}

function getNextRequestSequence(lastRequestNumber?: string) {
  if (!lastRequestNumber) {
    return ONE_DAY_OFFSET;
  }

  const lastSequence = Number.parseInt(
    lastRequestNumber.split("-")[2] || "0",
    10,
  );
  if (Number.isNaN(lastSequence)) {
    return ONE_DAY_OFFSET;
  }

  return lastSequence + ONE_DAY_OFFSET;
}

async function createPurchaseRequestRecord(
  input: CreateRestockRequestInput,
  nomorRequest: string,
) {
  return await prisma.$transaction(async (transaction) => {
    return await transaction.purchaseRequest.create({
      data: {
        id: crypto.randomUUID(),
        nomorRequest,
        tenantId: input.tenantId,
        requesterId: input.requesterId,
        gudangId: input.gudangId,
        keterangan: input.keterangan,
        status: "DRAFT",
        items: {
          create: input.items.map((item) => ({
            id: crypto.randomUUID(),
            barangId: item.barangId,
            jumlah: item.quantity,
            keterangan: item.keterangan || null,
            hargaPerUnit: 0,
            totalHarga: 0,
            tenantId: input.tenantId,
          })),
        },
      },
      include: {
        items: {
          include: {
            barang: true,
          },
        },
      },
    });
  });
}

function parseLifecycleAction(action: unknown): RestockAction | null {
  if (action === "APPROVE" || action === "REJECT") {
    return action;
  }

  return null;
}

async function getPurchaseRequestForLifecycle(id: string) {
  return await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          barang: { select: { id: true, nama: true, supplierId: true } },
        },
      },
    },
  });
}

async function rejectPurchaseRequest(
  existingRequest: Awaited<
    ReturnType<typeof getPurchaseRequestForLifecycle>
  > & { status: string; nomorRequest: string },
  input: RestockRequestLifecycleInput,
) {
  const updatedRequest = await prisma.purchaseRequest.update({
    where: { id: input.id },
    data: {
      status: "REJECTED",
      catatanApproval: input.catatan || null,
      approvedAt: new Date(),
      approvedBy: input.actorId,
    },
    include: {
      requester: { select: { name: true } },
      gudang: { select: { nama: true } },
    },
  });

  await logger.logActivity({
    userId: input.actorId,
    action: "REJECT PurchaseRequest",
    subject: existingRequest.nomorRequest,
    details: {
      id: input.id,
      previousStatus: existingRequest.status,
      newStatus: "REJECTED",
      catatan: input.catatan,
    },
  });

  return NextResponse.json(updatedRequest);
}

async function approvePurchaseRequest(
  existingRequest: Awaited<
    ReturnType<typeof getPurchaseRequestForLifecycle>
  > & { status: string; nomorRequest: string },
  input: RestockRequestLifecycleInput,
  startTime: number,
) {
  await prisma.purchaseRequest.update({
    where: { id: input.id },
    data: {
      status: "APPROVED",
      catatanApproval: input.catatan || null,
      approvedAt: new Date(),
      approvedBy: input.actorId,
    },
  });

  const generatedPurchaseOrder = await safelyGeneratePurchaseOrder(
    input.id,
    input.actorId,
  );

  await logger.logActivity({
    userId: input.actorId,
    action: "APPROVE PurchaseRequest",
    subject: existingRequest.nomorRequest,
    details: {
      id: input.id,
      previousStatus: existingRequest.status,
      newStatus: generatedPurchaseOrder.generatedPO ? "ORDERED" : "APPROVED",
      catatan: input.catatan,
      generatedPO: generatedPurchaseOrder.generatedPO?.poNumber || null,
      poError: generatedPurchaseOrder.poError,
    },
  });

  logger.apiRequest(
    "PATCH",
    `/api/inventory/restock/requests/${input.id}`,
    200,
    Date.now() - startTime,
    {
      userId: input.actorId,
      action: "APPROVE",
      generatedPO: generatedPurchaseOrder.generatedPO?.poNumber,
    },
  );

  const updatedRequest = await prisma.purchaseRequest.findUnique({
    where: { id: input.id },
    include: {
      requester: { select: { name: true } },
      gudang: { select: { nama: true } },
      purchaseOrder: { select: { id: true, poNumber: true, status: true } },
    },
  });

  return NextResponse.json({
    ...updatedRequest,
    _autoGeneratedPO: generatedPurchaseOrder.generatedPO
      ? {
          id: generatedPurchaseOrder.generatedPO.id,
          poNumber: generatedPurchaseOrder.generatedPO.poNumber,
        }
      : null,
    _poError: generatedPurchaseOrder.poError,
  });
}

async function safelyGeneratePurchaseOrder(
  id: string,
  actorId: string,
): Promise<{
  generatedPO:
    | Awaited<ReturnType<ProcurementService["generatePOFromPRs"]>>[number]
    | null;
  poError: string | null;
}> {
  try {
    const generatedPurchaseOrders = await procurementService.generatePOFromPRs(
      [id],
      actorId,
    );
    return {
      generatedPO: generatedPurchaseOrders?.[0] ?? null,
      poError: null,
    };
  } catch (error: unknown) {
    return {
      generatedPO: null,
      poError:
        error instanceof Error ? error.message : "Gagal auto-generate PO",
    };
  }
}

async function getPurchaseOrderWithItems(purchaseOrderId: string) {
  return await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      items: {
        include: { barang: true },
      },
    },
  });
}

async function startPurchaseOrderShopping(
  id: string,
  status: PurchaseOrderStatus,
  actorId: string,
) {
  if (status !== "DRAFT") {
    return NextResponse.json(
      { error: "Hanya PO Draft yang bisa mulai diproses" },
      { status: 400 },
    );
  }

  const updatedPurchaseOrder = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: "ORDERED",
      processedById: actorId,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json(updatedPurchaseOrder);
}

function canReceivePurchaseOrder(status: string) {
  return status === "DRAFT" || status === "ORDERED" || status === "PARTIAL";
}

function getReceivedQuantity(
  receivedItems: Record<string, number>,
  itemId: string,
  barangId: string,
) {
  if (receivedItems[barangId] !== undefined) {
    return receivedItems[barangId];
  }

  if (receivedItems[itemId] !== undefined) {
    return receivedItems[itemId];
  }

  return DEFAULT_RECEIVED_QUANTITY;
}

async function processPurchaseOrderItem(input: {
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  item: {
    id: string;
    barangId: string;
    unitPrice: number;
    receivedQuantity: number | null;
    barang: {
      nama: string;
      jenis: string;
      kategoriAset: string | null;
      kode: string;
    };
  };
  purchaseOrderId: string;
  actorId: string;
  fotoBukti: string[];
  poNumber: string;
  receivedItems: Record<string, number>;
}) {
  const receivedQuantity = getReceivedQuantity(
    input.receivedItems,
    input.item.id,
    input.item.barangId,
  );
  if (receivedQuantity < 0) {
    throw new Error(
      `Jumlah diterima untuk ${input.item.barang.nama} tidak boleh negatif`,
    );
  }

  await updatePurchaseOrderItemReceipt(
    input.transaction,
    input.item.id,
    input.item.receivedQuantity,
    receivedQuantity,
  );
  if (receivedQuantity <= 0) {
    return;
  }

  const targetGudangId = await findTargetGudangId(
    input.transaction,
    input.purchaseOrderId,
  );
  const stockInTimestamp = new Date();

  await upsertWarehouseStock(input.transaction, {
    barangId: input.item.barangId,
    gudangId: targetGudangId,
    quantity: receivedQuantity,
    timestamp: stockInTimestamp,
  });

  const stockInRecord = await createStockInRecord(input.transaction, {
    barangId: input.item.barangId,
    gudangId: targetGudangId,
    quantity: receivedQuantity,
    unitPrice: input.item.unitPrice,
    poNumber: input.poNumber,
    actorId: input.actorId,
    fotoBukti: input.fotoBukti,
    timestamp: stockInTimestamp,
  });

  if (input.item.barang.jenis !== "ASET") {
    return;
  }

  await createAssetsForStockIn(input.transaction, {
    barangId: input.item.barangId,
    barangKode: input.item.barang.kode,
    kategoriAset: input.item.barang.kategoriAset,
    unitPrice: input.item.unitPrice,
    quantity: receivedQuantity,
    location: stockInRecord.gudang?.nama || "Gudang Utama",
    timestamp: stockInTimestamp,
  });
}

async function updatePurchaseOrderItemReceipt(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  itemId: string,
  currentReceivedQuantity: number | null,
  receivedQuantity: number,
) {
  await transaction.purchaseOrderItem.update({
    where: { id: itemId },
    data: {
      receivedQuantity:
        (currentReceivedQuantity || DEFAULT_RECEIVED_QUANTITY) +
        receivedQuantity,
    },
  });
}

async function findTargetGudangId(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  purchaseOrderId: string,
) {
  const linkedPurchaseRequest = await transaction.purchaseRequest.findFirst({
    where: { purchaseOrderId },
    select: { gudangId: true },
  });

  if (linkedPurchaseRequest?.gudangId) {
    return linkedPurchaseRequest.gudangId;
  }

  const activeWarehouse = await transaction.gudang.findFirst({
    where: { isActive: true },
  });

  if (!activeWarehouse?.id) {
    throw new Error(
      "Tidak ada Gudang yang tersedia untuk menyimpan barang. Harap buat Gudang terlebih dahulu.",
    );
  }

  return activeWarehouse.id;
}

async function upsertWarehouseStock(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: {
    barangId: string;
    gudangId: string;
    quantity: number;
    timestamp: Date;
  },
) {
  await transaction.barangGudang.upsert({
    where: {
      barangId_gudangId: {
        barangId: input.barangId,
        gudangId: input.gudangId,
      },
    },
    create: {
      id: crypto.randomUUID(),
      barangId: input.barangId,
      gudangId: input.gudangId,
      stok: input.quantity,
      stokBaru: input.quantity,
      stokBekas: 0,
      stokRusak: 0,
      updatedAt: input.timestamp,
      createdAt: input.timestamp,
    },
    update: {
      stok: { increment: input.quantity },
      stokBaru: { increment: input.quantity },
      updatedAt: input.timestamp,
    },
  });
}

async function createStockInRecord(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: {
    barangId: string;
    gudangId: string;
    quantity: number;
    unitPrice: number;
    poNumber: string;
    actorId: string;
    fotoBukti: string[];
    timestamp: Date;
  },
) {
  return await transaction.barangMasuk.create({
    data: {
      id: crypto.randomUUID(),
      barangId: input.barangId,
      gudangId: input.gudangId,
      jumlah: input.quantity,
      hargaBeliSatuan: input.unitPrice,
      tanggal: input.timestamp,
      keterangan: `Penerimaan dari PO #${input.poNumber} (Revisi/Partial)`,
      kondisi: "BARU",
      userId: input.actorId,
      fotoBukti: input.fotoBukti,
    },
    include: {
      barang: true,
      gudang: true,
    },
  });
}

async function createAssetsForStockIn(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: AssetCreationInput,
) {
  const assets = buildAssetPayloads(input);
  if (assets.length === 0) {
    return;
  }

  await transaction.asset.createMany({
    data: assets.map((asset) => ({
      id: crypto.randomUUID(),
      ...asset,
    })),
  });
}

function buildAssetPayloads(input: AssetCreationInput): Array<{
  barangId: string;
  kodeAsset: string;
  purchaseDate: Date;
  purchasePrice: number;
  currentValue: number;
  usefulLife: number;
  residualValue: number;
  status: "ACTIVE";
  location: string;
  assignedTo: string | null;
}> {
  const usefulLife = getUsefulLifeMonths(input.kategoriAset);
  const prefix = `AST-${input.barangKode}`;
  const dateCode = input.timestamp
    .toISOString()
    .slice(ASSET_CODE_SLICE_START, ASSET_CODE_SLICE_END)
    .replace("-", "");
  const timestampSuffix = Date.now().toString().slice(-TIMESTAMP_SUFFIX_LENGTH);

  return Array.from({ length: input.quantity }, (_, index) => ({
    barangId: input.barangId,
    kodeAsset: `${prefix}-${dateCode}-${timestampSuffix}${String(index + ONE_DAY_OFFSET).padStart(ASSET_SEQUENCE_PAD_LENGTH, "0")}`,
    purchaseDate: input.timestamp,
    purchasePrice: input.unitPrice,
    currentValue: input.unitPrice,
    usefulLife,
    residualValue: 0,
    status: "ACTIVE" as const,
    location: input.location,
    assignedTo: null as string | null,
  }));
}

function getUsefulLifeMonths(kategoriAset: string | null) {
  if (kategoriAset === "KENDARAAN") {
    return VEHICLE_ASSET_USEFUL_LIFE;
  }

  if (kategoriAset === "BANGUNAN") {
    return BUILDING_ASSET_USEFUL_LIFE;
  }

  if (kategoriAset === "FURNITURE") {
    return FURNITURE_ASSET_USEFUL_LIFE;
  }

  return DEFAULT_ASSET_USEFUL_LIFE;
}

async function finalizePurchaseOrderReceipt(input: {
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  purchaseOrderId: string;
  actorId: string;
  closePO?: boolean;
  fotoBukti: string[];
}) {
  const nextStatus: PurchaseOrderStatus = input.closePO
    ? "RECEIVED"
    : "PARTIAL";
  const updatedPurchaseOrder = await input.transaction.purchaseOrder.update({
    where: { id: input.purchaseOrderId },
    data: {
      status: nextStatus,
      ...(nextStatus === "RECEIVED" ? { receivedById: input.actorId } : {}),
      fotoBukti: { push: input.fotoBukti },
      updatedAt: new Date(),
    },
  });

  if (nextStatus === "RECEIVED") {
    await input.transaction.purchaseRequest.updateMany({
      where: { purchaseOrderId: input.purchaseOrderId },
      data: { status: "RECEIVED" },
    });
  }

  return updatedPurchaseOrder;
}
