import { randomUUID } from "crypto";

import { logActivitySafe } from "@/lib/logger";
import { prisma } from "@/modules/database";
import type { Prisma } from "../repositories/prisma-boundary";

import { validateGudangSiteAccess } from "../utils/validation";
import { buildInventoryAccessSession } from "../utils/session";
import type { CreateInventoryOpnameInput } from "./InventoryOpnameService";
import {
  buildInitialGudangStock,
  buildOpnameCreateData,
  buildUpdatedStockData,
  calculateStockDifference,
  ensureTenantConsistency,
  resolveOpnameReasonLabel,
} from "./inventory-opname.service-helpers";

const DEFAULT_EMPTY_TOTAL = 0;
const DEFAULT_ADMIN_PIC = "Admin";

type OpnameReferences = Awaited<ReturnType<typeof findOpnameReferences>>;
type OpnameTransactionResult = {
  opnameRecord: Awaited<
    ReturnType<Prisma.TransactionClient["stockOpname"]["create"]>
  >;
  previousStock: number;
  newStock: number;
  selisih: number;
};

/** Buat opname baru dan sinkronkan mutasi stoknya. */
export async function createInventoryOpname(input: CreateInventoryOpnameInput) {
  await validateOpnameGudangAccess(input);
  const result = await prisma.$transaction((tx) =>
    createOpnameTransaction(tx, input),
  );
  logCreatedOpname(input, result);
  return result;
}

async function validateOpnameGudangAccess(input: CreateInventoryOpnameInput) {
  const accessSession = await buildInventoryAccessSession(input.user);
  const access = await validateGudangSiteAccess(accessSession, input.gudangId);

  if (!access.allowed) throw new Error(access.error || "Akses ditolak");
  return access;
}

async function createOpnameTransaction(
  tx: Prisma.TransactionClient,
  input: CreateInventoryOpnameInput,
): Promise<OpnameTransactionResult> {
  const references = await findOpnameReferences(tx, input);
  ensureReferencesTenantConsistency(references);
  const stokSistem = references.currentStock?.stok || DEFAULT_EMPTY_TOTAL;
  const selisih = calculateStockDifference(input.stokFisik, stokSistem);
  const opnameRecord = await createOpnameRecord(tx, input, stokSistem, selisih);

  await syncOpnameAdjustment(tx, {
    input,
    opnameId: opnameRecord.id,
    currentStock: references.currentStock,
    selisih,
  });
  return {
    opnameRecord,
    previousStock: stokSistem,
    newStock: input.stokFisik,
    selisih,
  };
}

async function findOpnameReferences(
  tx: Prisma.TransactionClient,
  input: CreateInventoryOpnameInput,
) {
  const [barang, gudang, currentStock] = await Promise.all([
    tx.barang.findUnique({ where: { id: input.barangId } }),
    tx.gudang.findUnique({ where: { id: input.gudangId, isActive: true } }),
    tx.barangGudang.findUnique({
      where: {
        barangId_gudangId: {
          barangId: input.barangId,
          gudangId: input.gudangId,
        },
      },
    }),
  ]);

  if (!barang) throw new Error("Barang tidak ditemukan");
  if (!gudang) throw new Error("Gudang tidak ditemukan atau tidak aktif");
  return { barang, gudang, currentStock };
}

function ensureReferencesTenantConsistency(references: OpnameReferences) {
  ensureTenantConsistency({
    barangTenantId: references.barang.tenantId,
    gudangTenantId: references.gudang.tenantId,
    currentStockTenantId: references.currentStock?.tenantId,
  });
}

function createOpnameRecord(
  tx: Prisma.TransactionClient,
  input: CreateInventoryOpnameInput,
  stokSistem: number,
  selisih: number,
) {
  return tx.stockOpname.create({
    data: buildOpnameCreateData({
      ...input,
      userName: input.user.name || DEFAULT_ADMIN_PIC,
      userEmail: input.user.email,
      stokSistem,
      selisih,
    }),
  });
}

async function syncOpnameAdjustment(
  tx: Prisma.TransactionClient,
  input: {
    input: CreateInventoryOpnameInput;
    opnameId: string;
    currentStock: { stokBaru: number | null } | null;
    selisih: number;
  },
) {
  await createOpnameMovement(tx, input);
  await syncGudangStock(tx, input);
}

async function createOpnameMovement(
  tx: Prisma.TransactionClient,
  input: {
    input: CreateInventoryOpnameInput;
    opnameId: string;
    selisih: number;
  },
) {
  if (input.selisih === 0) return;
  if (input.selisih > 0) return createPositiveOpnameMovement(tx, input);
  return createNegativeOpnameMovement(tx, input);
}

function createPositiveOpnameMovement(
  tx: Prisma.TransactionClient,
  input: {
    input: CreateInventoryOpnameInput;
    opnameId: string;
    selisih: number;
  },
) {
  const alasanText = resolveOpnameReasonLabel(input.input.alasanSelisih);
  return tx.barangMasuk.create({
    data: {
      id: randomUUID(),
      barangId: input.input.barangId,
      gudangId: input.input.gudangId,
      jumlah: input.selisih,
      kondisi: "BARU",
      keterangan: `Opname: ${alasanText} (+${input.selisih}). Ref: ${input.opnameId}`,
    },
  });
}

function createNegativeOpnameMovement(
  tx: Prisma.TransactionClient,
  input: {
    input: CreateInventoryOpnameInput;
    opnameId: string;
    selisih: number;
  },
) {
  const alasanText = resolveOpnameReasonLabel(input.input.alasanSelisih);
  return tx.barangKeluar.create({
    data: {
      id: randomUUID(),
      barangId: input.input.barangId,
      gudangId: input.input.gudangId,
      jumlah: Math.abs(input.selisih),
      kondisi: input.input.alasanSelisih === "rusak" ? "RUSAK" : "BARU",
      isHilang: input.input.alasanSelisih === "hilang",
      keterangan: `Opname: ${alasanText} (${input.selisih}). Ref: ${input.opnameId}`,
    },
  });
}

async function syncGudangStock(
  tx: Prisma.TransactionClient,
  input: {
    input: CreateInventoryOpnameInput;
    currentStock: { stokBaru: number | null } | null;
    selisih: number;
  },
) {
  if (input.currentStock) return updateExistingGudangStock(tx, input);
  if (input.input.stokFisik <= 0) return;
  await tx.barangGudang.create({ data: buildInitialGudangStock(input.input) });
}

function updateExistingGudangStock(
  tx: Prisma.TransactionClient,
  input: {
    input: CreateInventoryOpnameInput;
    currentStock: { stokBaru: number | null };
    selisih: number;
  },
) {
  return tx.barangGudang.update({
    where: {
      barangId_gudangId: {
        barangId: input.input.barangId,
        gudangId: input.input.gudangId,
      },
    },
    data: buildUpdatedStockData({
      stokFisik: input.input.stokFisik,
      selisih: input.selisih,
      currentStock: input.currentStock,
    }),
  });
}

function logCreatedOpname(
  input: CreateInventoryOpnameInput,
  result: OpnameTransactionResult,
) {
  logActivitySafe({
    action: "CREATE",
    subject: "Stock Opname",
    userId: input.user.id,
    details: {
      id: result.opnameRecord.id,
      barangId: input.barangId,
      gudangId: input.gudangId,
      diff: result.selisih,
    },
  });
}
