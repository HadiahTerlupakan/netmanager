/**
 * Isian capaian bulanan RAB (form admin) → payload API. Angka dibaca sebagai
 * angka (desimal dibulatkan ke rupiah), bukan dengan membuang semua karakter
 * non-digit — cara lama mengubah "1136362.5" menjadi 11.363.625.
 */

const PERSEN_MAKS = 100;

export interface IsianCapaianForm {
  actualSubscribers: number;
  actualRevenue: string;
  actualOpex: string;
  manualRecoveryInstallment: string;
  manualInvestorShare: string;
  manualCompanyShare: string;
  manualInvestorProfitSharePercent: string;
}

export interface PayloadCapaian {
  actualSubscribers: number;
  actualRevenue: number;
  actualOpex: number | null;
  manualRecoveryInstallment: number | null;
  manualInvestorShare: number | null;
  manualCompanyShare: number | null;
  manualInvestorProfitSharePercent: number | null;
}

export type HasilIsianCapaian =
  | { ok: true; data: PayloadCapaian }
  | { ok: false; pesan: string };

/** Nilai tersimpan → teks isian; 0 tetap "0" (bukan kosong). */
export function keTeksIsian(nilai: number | string | null | undefined): string {
  return nilai === null || nilai === undefined ? "" : String(nilai);
}

/** Teks isian → angka; kosong → null; bukan angka → NaN. */
function bacaAngka(teks: string): number | null {
  const bersih = teks.trim();
  if (bersih === "") return null;
  return Number(bersih);
}

function bacaRupiah(teks: string, label: string): { nilai: number | null } | { pesan: string } {
  const angka = bacaAngka(teks);
  if (angka === null) return { nilai: null };
  if (!Number.isFinite(angka) || angka < 0) return { pesan: `${label} harus angka 0 atau lebih` };
  return { nilai: Math.round(angka) };
}

/** Validasi & ubah isian form menjadi payload API capaian bulanan. */
export function susunIsianCapaian(form: IsianCapaianForm): HasilIsianCapaian {
  const pendapatan = bacaRupiah(form.actualRevenue, "Pendapatan");
  if ("pesan" in pendapatan) return { ok: false, pesan: pendapatan.pesan };
  if (pendapatan.nilai === null) return { ok: false, pesan: "Pendapatan wajib diisi" };

  const bidangRupiah = {
    actualOpex: bacaRupiah(form.actualOpex, "OPEX aktual"),
    manualRecoveryInstallment: bacaRupiah(form.manualRecoveryInstallment, "Pengembalian modal"),
    manualInvestorShare: bacaRupiah(form.manualInvestorShare, "Bagian investor"),
    manualCompanyShare: bacaRupiah(form.manualCompanyShare, "Bagian perusahaan"),
  };
  for (const hasil of Object.values(bidangRupiah)) {
    if ("pesan" in hasil) return { ok: false, pesan: hasil.pesan };
  }

  const persen = bacaAngka(form.manualInvestorProfitSharePercent);
  if (persen !== null && (!Number.isFinite(persen) || persen < 0 || persen > PERSEN_MAKS)) {
    return { ok: false, pesan: "Persen bagi hasil harus 0–100" };
  }
  if (!Number.isInteger(form.actualSubscribers) || form.actualSubscribers < 0) {
    return { ok: false, pesan: "Jumlah pelanggan harus bilangan bulat 0 atau lebih" };
  }

  const nilai = (hasil: { nilai: number | null } | { pesan: string }) =>
    "nilai" in hasil ? hasil.nilai : null;
  return {
    ok: true,
    data: {
      actualSubscribers: form.actualSubscribers,
      actualRevenue: pendapatan.nilai,
      actualOpex: nilai(bidangRupiah.actualOpex),
      manualRecoveryInstallment: nilai(bidangRupiah.manualRecoveryInstallment),
      manualInvestorShare: nilai(bidangRupiah.manualInvestorShare),
      manualCompanyShare: nilai(bidangRupiah.manualCompanyShare),
      manualInvestorProfitSharePercent: persen,
    },
  };
}
