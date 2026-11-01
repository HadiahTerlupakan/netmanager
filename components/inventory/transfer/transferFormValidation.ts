// Pesan diambil dari sumber yang sama dengan server agar petugas melihat
// kalimat yang sama di mana pun masalahnya tertangkap.
import {
  labelKondisiTransfer,
  TRANSFER_MESSAGES,
} from "@/modules/inventory/client";

const ANGKA_BULAT = /^\d+$/;

export interface TransferFormValues {
  barangId: string;
  dariGudangId: string;
  keGudangId: string;
  jumlah: string;
  kondisi: string;
}

export interface TransferFormContext {
  barangNama?: string;
  gudangAsalNama?: string;
  /** Stok barang di gudang asal untuk kondisi terpilih. */
  stokKondisi: number;
}

/**
 * Periksa formulir transfer sebelum dikirim. Semua masalah dikembalikan
 * sekaligus, satu per baris; string kosong berarti formulir siap dikirim.
 */
export function validateTransferForm(
  values: TransferFormValues,
  context: TransferFormContext,
): string {
  const problems = [
    ...collectPilihanProblems(values),
    ...collectJumlahProblems(values, context),
  ];
  return problems.join("\n");
}

/** Jumlah dari formulir sebagai angka bulat (formulir sudah tervalidasi). */
export function parseTransferJumlah(jumlah: string): number {
  return Number(jumlah.trim());
}

function collectPilihanProblems(values: TransferFormValues): string[] {
  const problems: string[] = [];
  if (!values.barangId) {
    problems.push(TRANSFER_MESSAGES.barangKosong);
  }
  if (!values.dariGudangId) {
    problems.push(TRANSFER_MESSAGES.gudangAsalKosong);
  }
  if (!values.keGudangId) {
    problems.push(TRANSFER_MESSAGES.gudangTujuanKosong);
  }
  if (values.dariGudangId && values.dariGudangId === values.keGudangId) {
    problems.push(TRANSFER_MESSAGES.gudangSama);
  }
  return problems;
}

function collectJumlahProblems(
  values: TransferFormValues,
  context: TransferFormContext,
): string[] {
  const teks = values.jumlah.trim();
  if (!teks) {
    return [TRANSFER_MESSAGES.jumlahKosong];
  }
  if (!ANGKA_BULAT.test(teks)) {
    return /^\d+[.,]\d+$/.test(teks)
      ? [TRANSFER_MESSAGES.jumlahBerkoma]
      : [TRANSFER_MESSAGES.jumlahBukanAngka];
  }

  const jumlah = Number(teks);
  if (jumlah <= 0) return [TRANSFER_MESSAGES.jumlahTidakPositif];
  if (!values.barangId || !values.dariGudangId) return [];
  if (jumlah <= context.stokKondisi) return [];
  return [buildStokKurangMessage(values, context, jumlah)];
}

function buildStokKurangMessage(
  values: TransferFormValues,
  context: TransferFormContext,
  jumlah: number,
): string {
  const kondisi = labelKondisiTransfer(values.kondisi);
  const barang = context.barangNama ? `"${context.barangNama}"` : "barang ini";
  const gudang = context.gudangAsalNama
    ? `gudang ${context.gudangAsalNama}`
    : "gudang asal";
  const stok = `Stok ${barang} kondisi ${kondisi} di ${gudang}`;
  if (context.stokKondisi <= 0) {
    return `${stok} kosong (0), jadi tidak bisa dipindah. Cek lagi kondisi barangnya, atau pilih gudang asal lain.`;
  }
  return `${stok} hanya ${context.stokKondisi}, tapi Anda mau memindah ${jumlah}. Kurangi jumlahnya jadi ${context.stokKondisi} atau kurang.`;
}
