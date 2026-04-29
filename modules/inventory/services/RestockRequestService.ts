import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { RestockPurchaseOrderStatusService } from "./RestockPurchaseOrderStatusService";
import { RestockRequestLifecycleService } from "./RestockRequestLifecycleService";

const REQUEST_NUMBER_PAD_LENGTH = 4;
const ONE_DAY_OFFSET = 1;

const purchaseOrderStatusService = new RestockPurchaseOrderStatusService();
const requestLifecycleService = new RestockRequestLifecycleService();

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
  return requestLifecycleService.patchRestockRequestLifecycle(input);
}

/** Ubah status proses purchase order dari restock request. */
export async function patchRestockRequestStatus(
  input: RestockRequestStatusInput,
) {
  return purchaseOrderStatusService.patchRestockRequestStatus(input);
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
