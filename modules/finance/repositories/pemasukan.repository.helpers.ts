import type { PemasukanEntity as PemasukanPublic } from "../domain/entities/PemasukanEntity";
import type {
  PemasukanCreateData,
  PemasukanUpdateData,
} from "../domain/ports/IPemasukanRepository";
import {
  mapMutationAmountToPublic,
  resolveTenantId,
  toBigIntAmount,
  toDateValue,
} from "./shared/financeMutationRepository";

type PemasukanCreatePayload = {
  tanggal: Date;
  nomorBukti: string;
  kategori: string;
  deskripsi: string;
  jumlah: bigint;
  metodeBayar: string | null;
  catatan: string | null;
  createdBy: string | null;
  tenantId: string;
};

type PemasukanUpdatePayload = {
  tanggal?: Date;
  nomorBukti?: string;
  kategori?: string;
  deskripsi?: string;
  jumlah?: bigint;
  metodeBayar?: string | null;
  catatan?: string | null;
  updatedBy?: string;
};

/** Memetakan record database ke entity publik pemasukan. */
export function mapPemasukanToPublicRecord(
  record: Record<string, unknown>,
): PemasukanPublic {
  return mapMutationAmountToPublic(record) as unknown as PemasukanPublic;
}

/** Memetakan daftar id dan tanggal ke bentuk publik yang konsisten. */
export function mapPemasukanIdsAndDates(
  items: Array<{ id: string; tanggal: Date | string }>,
): Array<{ id: string; tanggal: Date }> {
  return items.map((item) => ({
    id: item.id,
    tanggal:
      typeof item.tanggal === "string" ? new Date(item.tanggal) : item.tanggal,
  }));
}

/** Membangun payload create pemasukan. */
export async function buildPemasukanCreatePayload(
  data: PemasukanCreateData,
): Promise<PemasukanCreatePayload> {
  const tenantId = await resolveTenantId(data as { tenantId?: string });

  return {
    tanggal: toDateValue(data.tanggal),
    nomorBukti: data.nomorBukti,
    kategori: data.kategori,
    deskripsi: data.deskripsi,
    jumlah: toBigIntAmount(data.jumlah),
    metodeBayar: data.metodeBayar ?? null,
    catatan: data.catatan ?? null,
    createdBy: data.createdBy ?? null,
    tenantId: tenantId as string,
  };
}

/** Membangun payload update pemasukan. */
export function buildPemasukanUpdatePayload(
  data: PemasukanUpdateData,
): PemasukanUpdatePayload {
  const updateData: PemasukanUpdatePayload = {
    ...(data.tanggal !== undefined && { tanggal: toDateValue(data.tanggal) }),
    ...(data.nomorBukti !== undefined && { nomorBukti: data.nomorBukti }),
    ...(data.kategori !== undefined && { kategori: data.kategori }),
    ...(data.deskripsi !== undefined && { deskripsi: data.deskripsi }),
    ...(data.metodeBayar !== undefined && { metodeBayar: data.metodeBayar }),
    ...(data.catatan !== undefined && { catatan: data.catatan }),
    ...(data.updatedBy !== undefined && { updatedBy: data.updatedBy }),
  };

  if (data.jumlah !== undefined) {
    updateData.jumlah = toBigIntAmount(data.jumlah);
  }

  return updateData;
}
