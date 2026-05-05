import { type Prisma, type PrismaClient } from "@prisma/client";
import type { InventoryTransferRecord } from "../domain/ports/IInventoryOperationRepository";
import {
  mapTransferRecord,
  TRANSFER_DETAIL_INCLUDE,
  TRANSFER_LIST_INCLUDE,
} from "./inventory-repository-transfer-helpers";

export type TransferRepositoryDb = PrismaClient;

/** Ambil daftar transfer antar gudang beserta relasi ringkas. */
export async function findAllTransfers(
  db: TransferRepositoryDb,
  params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    dariGudangId?: string;
    keGudangId?: string;
    siteId?: string;
    tenantId?: string;
  },
): Promise<{ items: InventoryTransferRecord[]; total: number }> {
  const { skip, take, barangId, dariGudangId, keGudangId, siteId, tenantId } =
    params || {};
  const where = buildTransferWhere({
    barangId,
    dariGudangId,
    keGudangId,
    siteId,
    tenantId,
  });
  const queryOptions: Prisma.TransferAntarGudangFindManyArgs = {
    where,
    include: TRANSFER_LIST_INCLUDE,
    orderBy: { tanggal: "desc" },
    ...(skip !== undefined ? { skip } : {}),
    ...(take !== undefined ? { take } : {}),
  };
  const [rawItems, total] = await Promise.all([
    db.transferAntarGudang.findMany(queryOptions),
    db.transferAntarGudang.count({ where }),
  ]);
  return { items: rawItems.map(mapTransferRecord), total };
}

/** Ambil detail transfer antar gudang. */
export async function findTransferById(
  db: TransferRepositoryDb,
  id: string,
): Promise<InventoryTransferRecord | null> {
  const transfer = await db.transferAntarGudang.findUnique({
    where: { id },
    include: TRANSFER_DETAIL_INCLUDE,
  });
  if (!transfer) return null;

  return mapTransferRecord(transfer);
}

function buildTransferWhere(input: {
  barangId?: string;
  dariGudangId?: string;
  keGudangId?: string;
  siteId?: string;
  tenantId?: string;
}): Prisma.TransferAntarGudangWhereInput {
  const where: Prisma.TransferAntarGudangWhereInput = {
    tenantId: input.tenantId,
  };

  if (input.barangId) where.barangId = input.barangId;
  if (input.dariGudangId) where.dariGudangId = input.dariGudangId;
  if (input.keGudangId) where.keGudangId = input.keGudangId;
  if (input.siteId) {
    where.OR = [
      { gudangDari: { sites: { some: { id: input.siteId } } } },
      { gudangKe: { sites: { some: { id: input.siteId } } } },
    ];
  }

  return where;
}
