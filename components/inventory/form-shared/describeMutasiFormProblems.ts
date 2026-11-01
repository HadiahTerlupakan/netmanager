import { describeInventoryMutationProblems } from "@/modules/inventory/client";

/**
 * Periksa isian form barang masuk/keluar sebelum dikirim, dengan aturan dan
 * kalimat yang sama persis dengan server. Kembalikan pesan banyak baris, atau
 * null bila isiannya benar. `jumlah` dikirim apa adanya (teks dari input),
 * supaya "2,5" atau "2.5" ditolak, bukan dibulatkan diam-diam.
 */
export function describeMutasiFormProblems(form: {
  barangId: string;
  gudangId: string;
  jumlah: string;
}): string | null {
  const problems = describeInventoryMutationProblems({
    barangId: form.barangId,
    gudangId: form.gudangId,
    jumlah: form.jumlah.trim(),
  });
  return problems.length > 0 ? problems.join("\n") : null;
}
