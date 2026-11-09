import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  isPrismaForeignKeyError,
  isPrismaUniqueConstraintError,
} from "@/lib/prisma-errors";
import { prisma } from "@/modules/database";
import { createRestockRequestLifecycleService } from "../factories/RestockRequestLifecycleFactory";
import { InventoryPurchaseRequestRepository } from "../repositories/InventoryPurchaseRequestRepository";
import type {
  RestockLifecycleCommand,
  RestockLifecycleResult,
} from "./RestockRequestLifecycleService";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import {
  RESTOCK_MESSAGES,
  restockServerErrorMessage,
} from "./restock-messages";

export * from "./restock-messages";

const REQUEST_NUMBER_PAD_LENGTH = 4;
const ONE_DAY_OFFSET = 1;

const requestLifecycleService = createRestockRequestLifecycleService();
const purchaseRequestRepository = new InventoryPurchaseRequestRepository(
  prisma,
);

interface RestockRequestItemInput {
  barangId: string;
  quantity: number;
  keterangan?: string | null;
}

interface RestockRequestJasaItemInput {
  jasaId: string;
  jumlah: number;
  hargaPerUnit?: number;
  keterangan?: string | null;
}

interface CreateRestockRequestInput {
  items: RestockRequestItemInput[];
  jasaItems?: RestockRequestJasaItemInput[];
  gudangId: string;
  keterangan?: string;
  requesterId: string;
  tenantId?: string | null;
  apiPath: string;
}

/**
 * Buat purchase request restock baru.
 * Note: 21 baris - sudah optimal dengan validation + generation + creation + logging.
 * Memecah lebih lanjut akan memisahkan error handling dari business flow yang harus berurutan.
 */
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

    logSuccessfulRequestCreation(input, purchaseRequest.id, startTime);
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.CREATE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: nomorRequest,
      actorId: input.requesterId,
      tenantId: input.tenantId,
      details: {
        purchaseRequestId: purchaseRequest.id,
        gudangId: input.gudangId,
        jumlahBarang: input.items.length,
        jumlahJasa: input.jasaItems?.length ?? 0,
        keterangan: input.keterangan,
      },
    });
    return NextResponse.json(purchaseRequest, { status: 201 });
  } catch (error: unknown) {
    return handleRequestCreationError(error, input.apiPath);
  }
}

function logSuccessfulRequestCreation(
  input: CreateRestockRequestInput,
  prId: string,
  startTime: number,
) {
  logger.apiRequest("POST", input.apiPath, 201, Date.now() - startTime, {
    userId: input.requesterId,
    prId,
  });
}

function handleRequestCreationError(error: unknown, apiPath: string) {
  if (isPrismaUniqueConstraintError(error)) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.duplicateRequestNumber },
      { status: 409 },
    );
  }
  if (isPrismaForeignKeyError(error)) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.missingReference },
      { status: 400 },
    );
  }

  const applicationError =
    error instanceof Error ? error : new Error(String(error));
  logger.error("Error creating purchase request", applicationError, {
    path: apiPath,
    method: "POST",
  });

  // Nomor pengajuan dibuat tanpa menulis apa pun dan pengajuan beserta
  // itemnya disimpan dalam satu transaksi, jadi kegagalan tidak meninggalkan data.
  return NextResponse.json(
    { error: restockServerErrorMessage("Menyimpan pengajuan", true) },
    { status: 500 },
  );
}

/** Ambil detail purchase request restock milik tenant tertentu. */
export async function getRestockRequestDetail(id: string, tenantId: string) {
  try {
    const purchaseRequest =
      await purchaseRequestRepository.findPurchaseRequestDetail(id, tenantId);

    if (!purchaseRequest) {
      return NextResponse.json(
        { error: RESTOCK_MESSAGES.requestNotFound },
        { status: 404 },
      );
    }

    return NextResponse.json(purchaseRequest);
  } catch (error: unknown) {
    logger.error(
      "Error fetching purchase request detail",
      error instanceof Error ? error : new Error(String(error)),
      { purchaseRequestId: id },
    );
    return NextResponse.json(
      { error: restockServerErrorMessage("Membuka pengajuan", false) },
      { status: 500 },
    );
  }
}

/**
 * Setujui atau tolak pengajuan restock. Mengembalikan hasil bertipe; route
 * yang memetakan kode galatnya ke status HTTP.
 */
export async function patchRestockRequestLifecycle(
  command: RestockLifecycleCommand,
): Promise<RestockLifecycleResult> {
  return requestLifecycleService.patchRestockRequestLifecycle(command);
}

function validateRestockRequestInput(input: CreateRestockRequestInput) {
  const hasBarang = Array.isArray(input.items) && input.items.length > 0;
  const hasJasa = Array.isArray(input.jasaItems) && input.jasaItems.length > 0;

  if (!hasBarang && !hasJasa) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.nothingRequested },
      { status: 400 },
    );
  }

  // Gudang tetap wajib: PR schema butuh gudangId. Untuk pure-jasa,
  // UI mengisi gudang default/site gudang.
  if (!input.gudangId) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.gudangMissing },
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
    const purchaseRequest = await transaction.purchaseRequest.create({
      data: {
        id: crypto.randomUUID(),
        nomorRequest,
        tenantId: input.tenantId,
        requesterId: input.requesterId,
        gudangId: input.gudangId,
        keterangan: input.keterangan,
        status: "DRAFT",
      },
    });

    if (input.items.length > 0) {
      await transaction.purchaseRequestItem.createMany({
        data: input.items.map((item) => ({
          id: crypto.randomUUID(),
          purchaseRequestId: purchaseRequest.id,
          barangId: item.barangId,
          jumlah: item.quantity,
          keterangan: item.keterangan || null,
          hargaPerUnit: 0,
          totalHarga: 0,
          tenantId: input.tenantId,
        })),
      });
    }

    if (input.jasaItems && input.jasaItems.length > 0) {
      await transaction.purchaseRequestJasaItem.createMany({
        data: input.jasaItems.map((item) => {
          const hargaPerUnit = Number(item.hargaPerUnit) || 0;
          return {
            id: crypto.randomUUID(),
            purchaseRequestId: purchaseRequest.id,
            jasaId: item.jasaId,
            jumlah: item.jumlah,
            hargaPerUnit,
            totalHarga: hargaPerUnit * item.jumlah,
            keterangan: item.keterangan || null,
            statusKonfirmasi: "PENDING",
            tenantId: input.tenantId,
          };
        }),
      });
    }

    return transaction.purchaseRequest.findUnique({
      where: { id: purchaseRequest.id },
      include: {
        items: {
          include: {
            barang: true,
          },
        },
        jasaItems: {
          include: {
            jasa: true,
          },
        },
      },
    });
  });
}
