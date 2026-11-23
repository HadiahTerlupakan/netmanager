import { randomUUID } from "crypto";

import {
  STOK_KOSONG,
  applyConditionDelta,
  type KondisiStok,
  type StokPerKondisi,
} from "../domain/opname-stock-condition";

/** Pastikan semua tenant record inventory tetap konsisten. */
export function ensureTenantConsistency(input: {
  barangTenantId?: string | null;
  gudangTenantId?: string | null;
  currentStockTenantId?: string | null;
}) {
  validateBarangGudangTenant(input.barangTenantId, input.gudangTenantId);
  validateStockGudangTenant(input.currentStockTenantId, input.gudangTenantId);
}

function validateBarangGudangTenant(
  barangTenantId?: string | null,
  gudangTenantId?: string | null,
) {
  if (barangTenantId && gudangTenantId && barangTenantId !== gudangTenantId) {
    throw new Error(
      "Barang tidak berada dalam tenant yang sama dengan gudang tujuan",
    );
  }
}

function validateStockGudangTenant(
  currentStockTenantId?: string | null,
  gudangTenantId?: string | null,
) {
  if (
    currentStockTenantId &&
    gudangTenantId &&
    currentStockTenantId !== gudangTenantId
  ) {
    throw new Error(
      "Barang tidak berada dalam tenant yang sama dengan gudang tujuan",
    );
  }
}

/** Hitung nilai selisih opname terhadap stok sistem. */
export function calculateStockDifference(
  stokFisik: number,
  stokSistem: number,
) {
  return stokFisik - stokSistem;
}

/** Normalisasi angka opsional dari payload opname. */
export function normalizeOptionalNumber(value?: string) {
  if (value === undefined || value === "") {
    return null;
  }

  return Number(value);
}

/**
 * Bangun payload create stock opname dari input yang sudah tervalidasi.
 * Note: 29 baris - sudah optimal dengan object literal builder yang lengkap.
 * Memecah lebih lanjut akan memisahkan field-field yang saling terkait dalam satu entity.
 */
export function buildOpnameCreateData(input: {
  barangId: string;
  gudangId: string;
  stokFisik: number;
  stokSistem: number;
  selisih: number;
  userName?: string | null;
  userEmail?: string | null;
  keterangan?: string;
  kondisiBaik?: number;
  kondisiRusak?: number;
  kondisiExpire?: number;
  lokasiPenyimpanan?: string;
  nomorRak?: string;
  nomorBox?: string;
  suhuPenyimpanan?: string;
  kelembaban?: string;
  tanggalExpire?: string;
  nomorBatch?: string;
  catatanDetail?: string;
  alasanSelisih?: string;
}) {
  return {
    id: randomUUID(),
    ...buildOpnameBaseFields(input),
    ...buildOpnameConditionFields(input),
    ...buildOpnameStorageFields(input),
  };
}

/**
 * Build base fields untuk opname record.
 * Note: 22 baris - sudah optimal dengan object literal builder untuk core fields.
 * Memecah lebih lanjut akan memisahkan field-field yang saling terkait.
 */
function buildOpnameBaseFields(input: {
  barangId: string;
  gudangId: string;
  stokFisik: number;
  stokSistem: number;
  selisih: number;
  userName?: string | null;
  userEmail?: string | null;
  keterangan?: string;
  alasanSelisih?: string;
}) {
  return {
    barangId: input.barangId,
    gudangId: input.gudangId,
    stokFisik: input.stokFisik,
    stokSistem: input.stokSistem,
    selisih: input.selisih,
    keterangan: input.keterangan,
    pic: resolvePicName(input.userName, input.userEmail),
    alasanSelisih: input.alasanSelisih,
  };
}

function resolvePicName(userName?: string | null, userEmail?: string | null) {
  return userName || userEmail || "Admin";
}

function buildOpnameConditionFields(input: {
  kondisiBaik?: number;
  kondisiRusak?: number;
  kondisiExpire?: number;
}) {
  return {
    kondisiBaik: input.kondisiBaik ?? 0,
    kondisiRusak: input.kondisiRusak ?? 0,
    kondisiExpire: input.kondisiExpire ?? 0,
  };
}

/**
 * Build storage-related fields untuk opname record.
 * Note: 21 baris - sudah optimal dengan object literal builder untuk storage metadata.
 * Memecah lebih lanjut akan memisahkan field-field yang saling terkait.
 */
function buildOpnameStorageFields(input: {
  lokasiPenyimpanan?: string;
  nomorRak?: string;
  nomorBox?: string;
  suhuPenyimpanan?: string;
  kelembaban?: string;
  tanggalExpire?: string;
  nomorBatch?: string;
  catatanDetail?: string;
}) {
  return {
    lokasiPenyimpanan: input.lokasiPenyimpanan,
    nomorRak: input.nomorRak,
    nomorBox: input.nomorBox,
    suhuPenyimpanan: normalizeOptionalNumber(input.suhuPenyimpanan),
    kelembaban: normalizeOptionalNumber(input.kelembaban),
    tanggalExpire: parseOptionalDate(input.tanggalExpire),
    nomorBatch: input.nomorBatch,
    catatanDetail: input.catatanDetail,
  };
}

function parseOptionalDate(dateString?: string) {
  return dateString ? new Date(dateString) : null;
}

/**
 * Bangun kolom stok gudang setelah opname: selisih masuk ke kolom kondisi
 * mutasinya, dan total disamakan dengan stok fisik yang dihitung.
 */
export function buildUpdatedStockData(input: {
  stokFisik: number;
  selisih: number;
  kondisi: KondisiStok;
  currentStock: StokPerKondisi;
}): StokPerKondisi {
  const columns = applyConditionDelta(
    input.currentStock,
    input.kondisi,
    input.selisih,
  );
  return { ...columns, stok: input.stokFisik };
}

/** Bangun stok awal gudang bila record stok belum tersedia. */
export function buildInitialGudangStock(
  input: {
    barangId: string;
    gudangId: string;
    stokFisik: number;
    user?: { tenantId?: string | null };
  },
  kondisi: KondisiStok = "BARU",
) {
  return {
    id: randomUUID(),
    barangId: input.barangId,
    gudangId: input.gudangId,
    ...applyConditionDelta(STOK_KOSONG, kondisi, input.stokFisik),
    updatedAt: new Date(),
    tenantId: input.user?.tenantId || null,
  };
}
