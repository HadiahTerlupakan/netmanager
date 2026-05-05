import {
  Prisma,
  type PrismaClient,
  type TransferAntarGudang,
} from "@prisma/client";
import type { InventoryTransferRecord } from "../domain/ports/IInventoryOperationRepository";

export type TransferRepositoryDb = PrismaClient;

export const TRANSFER_LIST_INCLUDE = {
  barang: { select: { id: true, kode: true, nama: true, satuan: true } },
  gudangDari: { select: { id: true, kode: true, nama: true, lokasi: true } },
  gudangKe: { select: { id: true, kode: true, nama: true, lokasi: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TransferAntarGudangInclude;

export const TRANSFER_DETAIL_INCLUDE = {
  ...TRANSFER_LIST_INCLUDE,
  barangMasuk: {
    select: {
      id: true,
      tanggal: true,
      jumlah: true,
      kondisi: true,
      keterangan: true,
    },
  },
  barangKeluar: {
    select: {
      id: true,
      tanggal: true,
      jumlah: true,
      kondisi: true,
      keterangan: true,
    },
  },
} satisfies Prisma.TransferAntarGudangInclude;

function normalizeJsonRecord(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function mapTransferRecord(
  transfer:
    | Prisma.TransferAntarGudangGetPayload<{
        include: typeof TRANSFER_DETAIL_INCLUDE;
      }>
    | Prisma.TransferAntarGudangGetPayload<{
        include: typeof TRANSFER_LIST_INCLUDE;
      }>
    | TransferAntarGudang,
): InventoryTransferRecord {
  const barang = "barang" in transfer ? transfer.barang : undefined;
  const gudangDari = "gudangDari" in transfer ? transfer.gudangDari : undefined;
  const gudangKe = "gudangKe" in transfer ? transfer.gudangKe : undefined;
  const createdBy = "createdBy" in transfer ? transfer.createdBy : undefined;
  const barangMasuk =
    "barangMasuk" in transfer ? transfer.barangMasuk : undefined;
  const barangKeluar =
    "barangKeluar" in transfer ? transfer.barangKeluar : undefined;

  return {
    id: transfer.id,
    kodeTransfer: transfer.kodeTransfer,
    barangId: transfer.barangId,
    dariGudangId: transfer.dariGudangId,
    keGudangId: transfer.keGudangId,
    tanggal: transfer.tanggal,
    jumlah: transfer.jumlah,
    kondisi: transfer.kondisi,
    keterangan: transfer.keterangan,
    createdAt: transfer.createdAt,
    fotoBukti: transfer.fotoBukti,
    fotoMetadata: normalizeJsonRecord(transfer.fotoMetadata),
    createdById: transfer.createdById,
    tenantId: transfer.tenantId,
    ...(barang ? { barang } : {}),
    ...(gudangDari ? { gudangDari, dariGudang: gudangDari } : {}),
    ...(gudangKe ? { gudangKe, keGudang: gudangKe } : {}),
    ...(createdBy !== undefined ? { createdBy } : {}),
    ...(barangMasuk ? { barangMasuk, masuk: barangMasuk[0] ?? null } : {}),
    ...(barangKeluar ? { barangKeluar, keluar: barangKeluar[0] ?? null } : {}),
  };
}

export {
  findAllTransfers,
  findTransferById,
} from "./inventory-repository-transfer-query-helpers";
export {
  createTransfer,
  deleteTransfer,
  updateTransfer,
} from "./inventory-repository-transfer-mutation-helpers";
