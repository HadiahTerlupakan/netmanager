import type { KondisiBarang } from "../types/asset.enums";

// Pesan di file ini dibaca staf gudang: sebut apa yang salah dan apa yang
// harus dilakukan, dengan kata sehari-hari.

const VALIDATION_ERROR_STATUS = 400;

const DECIMAL_SEPARATOR_PATTERN = /[.,]/;
const JUMLAH_BERKOMA_MESSAGE =
  "Jumlah harus angka bulat, tanpa koma atau titik. Contoh: 1, 2, atau 10.";

export const KONDISI_TIDAK_DIKENAL_MESSAGE =
  "Kondisi barang tidak dikenal. Pilih salah satu: Baru, Bekas, atau Rusak.";

type MutationValidationError = {
  success: false;
  status: number;
  error: string;
};

/**
 * Daftar masalah pada isian form barang masuk/keluar (kosong bila benar).
 * Dipakai server dan layar (lewat `@/modules/inventory/client`)
 * supaya aturan dan kalimatnya sama persis.
 */
export function describeInventoryMutationProblems(
  body: Record<string, unknown>,
): string[] {
  return [
    body.barangId ? null : "Barang belum dipilih. Pilih barangnya dulu.",
    body.gudangId ? null : "Gudang belum dipilih. Pilih gudangnya dulu.",
    describeJumlahProblem(body.jumlah),
    !body.kondisi || isValidKondisi(body.kondisi)
      ? null
      : KONDISI_TIDAK_DIKENAL_MESSAGE,
    describePhotoProblem(body),
  ].filter((problem): problem is string => problem !== null);
}

/**
 * Periksa isian form barang masuk/keluar. Semua masalah dilaporkan sekaligus,
 * satu per baris, supaya staf tidak membetulkan satu lalu ditolak lagi.
 */
export function validateInventoryMutationCreateBody(
  body: Record<string, unknown>,
): MutationValidationError | null {
  const problems = describeInventoryMutationProblems(body);
  return problems.length > 0
    ? createValidationError(problems.join("\n"))
    : null;
}

/** Periksa jumlah pada form ubah barang masuk/keluar; null bila benar. */
export function validateInventoryMutationJumlah(
  jumlah: unknown,
): MutationValidationError | null {
  const problem = describeJumlahProblem(jumlah);
  return problem ? createValidationError(problem) : null;
}

/** Cek apakah kondisi barang adalah BARU, BEKAS, atau RUSAK. */
export function isValidKondisi(kondisi: unknown): kondisi is KondisiBarang {
  return kondisi === "BARU" || kondisi === "BEKAS" || kondisi === "RUSAK";
}

/** Pesan masalah pada jumlah barang, atau null bila jumlahnya benar. */
function describeJumlahProblem(jumlah: unknown): string | null {
  if (jumlah === undefined || jumlah === null || jumlah === "") {
    return "Jumlah belum diisi. Isi berapa banyak barangnya, contoh: 5.";
  }

  // "2,5" (desimal cara Indonesia) atau "1.000" juga dianggap berkoma, bukan
  // "bukan angka" — itulah yang dimaksud staf yang mengetiknya.
  const isTypedWithSeparator =
    typeof jumlah === "string" && DECIMAL_SEPARATOR_PATTERN.test(jumlah);
  const parsedJumlah = Number(jumlah);
  if (
    isTypedWithSeparator ||
    (Number.isFinite(parsedJumlah) && !Number.isInteger(parsedJumlah))
  ) {
    return JUMLAH_BERKOMA_MESSAGE;
  }
  if (!Number.isFinite(parsedJumlah)) {
    return "Jumlah harus diisi angka, contoh: 5.";
  }
  if (parsedJumlah <= 0) {
    return "Jumlah harus lebih dari 0.";
  }
  return null;
}

function describePhotoProblem(body: Record<string, unknown>): string | null {
  const isPhotoListBroken = body.fotoBukti && !Array.isArray(body.fotoBukti);
  const isPhotoInfoBroken =
    body.fotoMetadata && typeof body.fotoMetadata !== "object";
  if (!isPhotoListBroken && !isPhotoInfoBroken) return null;

  return "Foto bukti tidak terbaca. Hapus fotonya, lalu unggah ulang.";
}

function createValidationError(error: string): MutationValidationError {
  return { success: false, status: VALIDATION_ERROR_STATUS, error };
}
