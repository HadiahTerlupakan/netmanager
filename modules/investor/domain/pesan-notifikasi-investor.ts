/**
 * Isi notifikasi push untuk investor — fungsi murni dari payload event.
 * Kalimat dibuat pendek dan jelas untuk pembaca awam; tautan `url` membuka
 * bagian yang tepat di layar Uang aplikasi mobile.
 */

/** Rute layar Uang investor di aplikasi mobile, per bagian. */
export const TAUTAN_UANG_INVESTOR = {
  bagiHasil: "/(investor)/keuangan?bagian=bagi-hasil",
  diterima: "/(investor)/keuangan?bagian=diterima",
  modal: "/(investor)/keuangan?bagian=modal",
} as const;

const ZONA_WAKTU_TENANT = "Asia/Jakarta";

const JENIS_SETORAN: Readonly<Record<string, string>> = {
  MODAL_AWAL: "modal awal",
  TAMBAHAN_MODAL: "tambahan modal",
  PINJAMAN: "pinjaman",
};

const FORMAT_RUPIAH = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Pesan push siap kirim. `kunciUnik` mencegah pesan sama terkirim dua kali. */
export interface PesanNotifikasiInvestor {
  investorId: string;
  /** Tenant asal event; penerima wajib investor di tenant ini (null = tanpa tenant). */
  tenantId: string | null;
  kunciUnik: string;
  judul: string;
  isi: string;
  url: string;
}

/** Payload event investor (nilai uang dikirim sebagai string). */
export type PayloadEventInvestor = Record<string, unknown>;

function teks(payload: PayloadEventInvestor, field: string): string {
  const nilai = payload[field];
  if (typeof nilai !== "string" || !nilai) {
    throw new Error(`[NotifikasiInvestor] Payload "${field}" wajib string non-kosong`);
  }
  return nilai;
}

/** Rupiah tanpa desimal; nilai tak terbaca menjadi Rp 0. */
export function formatRupiahNotifikasi(nilai: string): string {
  const angka = Number(nilai);
  return FORMAT_RUPIAH.format(Number.isFinite(angka) ? angka : 0).replace(/\s/g, " ");
}

/** "Agustus 2026" untuk periode satu bulan, selain itu "Juli–September 2026". */
export function labelPeriodeNotifikasi(mulaiIso: string, selesaiIso: string): string {
  const bulanTahun = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: ZONA_WAKTU_TENANT,
    });
  const awal = bulanTahun(mulaiIso);
  const akhir = bulanTahun(selesaiIso);
  if (awal === akhir) return awal;
  const bulanAwal = new Date(mulaiIso).toLocaleDateString("id-ID", {
    month: "long",
    timeZone: ZONA_WAKTU_TENANT,
  });
  return `${bulanAwal}–${akhir}`;
}

/** "Bagi hasil proyek X Agustus 2026 sebesar Rp A (ditambah pengembalian modal Rp B) …" */
function kalimatBagiHasilDisetujui(payload: PayloadEventInvestor): string {
  const proyek =
    typeof payload.projectName === "string" && payload.projectName
      ? ` proyek ${payload.projectName}`
      : "";
  const periode = labelPeriodeNotifikasi(teks(payload, "periodStart"), teks(payload, "periodEnd"));
  const pengembalian = Number(payload.capitalReturnAmount ?? 0);
  const tambahan =
    pengembalian > 0
      ? ` ditambah pengembalian modal ${formatRupiahNotifikasi(String(pengembalian))}`
      : "";
  return `Bagi hasil${proyek} ${periode} sebesar ${formatRupiahNotifikasi(teks(payload, "shareAmount"))}${tambahan} sudah disetujui dan akan segera dibayar.`;
}

type PenyusunPesan = (
  payload: PayloadEventInvestor,
) => Omit<PesanNotifikasiInvestor, "tenantId">;

/** Publisher mengirim `tenantId: ""` untuk investor tanpa tenant. */
function tenantDariPayload(payload: PayloadEventInvestor): string | null {
  return typeof payload.tenantId === "string" && payload.tenantId ? payload.tenantId : null;
}

/** Penyusun pesan per nama event (`lib/event-bus/types.ts`). */
export const PENYUSUN_PESAN_INVESTOR: Readonly<Record<string, PenyusunPesan>> = {
  "investor:deposit.completed": (payload) => {
    const jenis = JENIS_SETORAN[String(payload.depositType)] ?? "setoran modal";
    return {
      investorId: teks(payload, "investorId"),
      kunciUnik: `setoran-diterima:${teks(payload, "depositId")}`,
      judul: "Modal sudah diterima",
      isi: `Setoran ${jenis} ${formatRupiahNotifikasi(teks(payload, "amount"))} sudah kami terima. Terima kasih.`,
      url: TAUTAN_UANG_INVESTOR.modal,
    };
  },
  "investor:deposit.rejected": (payload) => ({
    investorId: teks(payload, "investorId"),
    kunciUnik: `setoran-ditolak:${teks(payload, "depositId")}`,
    judul: "Setoran modal ditolak",
    isi: `Setoran ${formatRupiahNotifikasi(teks(payload, "amount"))} ditolak. Alasan: ${teks(payload, "reason")}. Silakan hubungi admin.`,
    url: TAUTAN_UANG_INVESTOR.modal,
  }),
  "investor:profit_share.approved": (payload) => ({
    investorId: teks(payload, "investorId"),
    kunciUnik: `bagi-hasil-disetujui:${teks(payload, "profitShareId")}`,
    judul: "Bagi hasil siap dibayar",
    isi: kalimatBagiHasilDisetujui(payload),
    url: TAUTAN_UANG_INVESTOR.bagiHasil,
  }),
  "investor:payout.completed": (payload) => ({
    investorId: teks(payload, "investorId"),
    kunciUnik: `uang-dikirim:${teks(payload, "payoutId")}`,
    judul: "Uang sudah dikirim",
    isi: `${formatRupiahNotifikasi(teks(payload, "amount"))} sudah dikirim ke rekening Anda.`,
    url: TAUTAN_UANG_INVESTOR.diterima,
  }),
};

/** Pesan untuk satu event, atau null bila event bukan pemicu notifikasi investor. */
export function susunPesanInvestor(
  eventName: string,
  payload: PayloadEventInvestor,
): PesanNotifikasiInvestor | null {
  const penyusun = PENYUSUN_PESAN_INVESTOR[eventName];
  return penyusun ? { ...penyusun(payload), tenantId: tenantDariPayload(payload) } : null;
}
