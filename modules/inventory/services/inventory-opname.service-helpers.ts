import { randomUUID } from "crypto";

export const INVENTORY_OPNAME_REASON_LABELS: Record<string, string> = {
  hilang: "Barang hilang",
  rusak: "Barang rusak/tidak layak",
  revisi: "Revisi stok/koreksi data",
  salah_input: "Kesalahan input sebelumnya",
  terpakai: "Terpakai tidak tercatat",
  expired: "Barang kadaluarsa",
  lebih: "Stok lebih/ditemukan",
  lainnya: "Lainnya",
};

/** Pastikan semua tenant record inventory tetap konsisten. */
export function ensureTenantConsistency(input: {
  barangTenantId?: string | null;
  gudangTenantId?: string | null;
  currentStockTenantId?: string | null;
}) {
  const { barangTenantId, gudangTenantId, currentStockTenantId } = input;

  if (barangTenantId && gudangTenantId && barangTenantId !== gudangTenantId) {
    throw new Error(
      "Barang tidak berada dalam tenant yang sama dengan gudang tujuan",
    );
  }

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

/** Bangun payload create stock opname dari input yang sudah tervalidasi. */
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
    barangId: input.barangId,
    gudangId: input.gudangId,
    stokFisik: input.stokFisik,
    stokSistem: input.stokSistem,
    selisih: input.selisih,
    keterangan: input.keterangan,
    kondisiBaik: input.kondisiBaik ?? 0,
    kondisiRusak: input.kondisiRusak ?? 0,
    kondisiExpire: input.kondisiExpire ?? 0,
    lokasiPenyimpanan: input.lokasiPenyimpanan,
    nomorRak: input.nomorRak,
    nomorBox: input.nomorBox,
    pic: input.userName || input.userEmail || "Admin",
    suhuPenyimpanan: normalizeOptionalNumber(input.suhuPenyimpanan),
    kelembaban: normalizeOptionalNumber(input.kelembaban),
    tanggalExpire: input.tanggalExpire ? new Date(input.tanggalExpire) : null,
    nomorBatch: input.nomorBatch,
    catatanDetail: input.catatanDetail,
    alasanSelisih: input.alasanSelisih,
  };
}

/** Ambil label alasan selisih opname yang ramah pengguna. */
export function resolveOpnameReasonLabel(alasanSelisih?: string) {
  if (!alasanSelisih) {
    return "Penyesuaian stok";
  }

  return INVENTORY_OPNAME_REASON_LABELS[alasanSelisih] || alasanSelisih;
}

/** Bangun payload update stok gudang setelah opname. */
export function buildUpdatedStockData(input: {
  stokFisik: number;
  selisih: number;
  currentStock: {
    stokBaru?: number | null;
  };
}) {
  const updateData: {
    stok: number;
    stokBaru?: number;
  } = { stok: input.stokFisik };

  if (input.selisih === 0) {
    return updateData;
  }

  if (input.selisih < 0) {
    updateData.stokBaru = Math.max(
      0,
      (input.currentStock.stokBaru || 0) - Math.abs(input.selisih),
    );
    return updateData;
  }

  updateData.stokBaru = (input.currentStock.stokBaru || 0) + input.selisih;
  return updateData;
}

/** Bangun stok awal gudang bila record stok belum tersedia. */
export function buildInitialGudangStock(input: {
  barangId: string;
  gudangId: string;
  stokFisik: number;
}) {
  return {
    id: randomUUID(),
    barangId: input.barangId,
    gudangId: input.gudangId,
    stok: input.stokFisik,
    stokBaru: input.stokFisik,
    stokBekas: 0,
    stokRusak: 0,
    updatedAt: new Date(),
  };
}
