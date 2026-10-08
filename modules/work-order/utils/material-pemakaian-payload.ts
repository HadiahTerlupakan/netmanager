/**
 * Normalisasi daftar material terpasang yang dikirim aplikasi mobile.
 *
 * Nilainya tiba dalam dua bentuk: string JSON di dalam multipart (laporan
 * penyelesaian membawa foto) dan — karena aplikasi men-`JSON.stringify`
 * payload-nya lebih dulu — juga string di dalam body JSON. Keduanya dinormalkan
 * di sini; array yang sudah berbentuk benar diterima apa adanya.
 *
 * Jalur JSON dulu melewatkan normalisasi ini sehingga layanan menerima sebuah
 * string. `items?.length` pada string bernilai benar, lalu `.filter` padanya
 * melempar, dan penjaga "penyelesaian pekerjaan tidak boleh gagal" menelan
 * kesalahan itu: work order selesai dengan 200 sementara pemakaian material
 * tidak pernah tercatat sama sekali.
 *
 * Bentuk yang tidak dikenali diabaikan, bukan ditolak — batas jumlahnya
 * ditegakkan di layanan.
 */

export interface MaterialTerpasang {
  barangId: string;
  jumlah: number;
}

export function parseMaterialPemakaian(
  nilai: unknown,
): MaterialTerpasang[] | undefined {
  const terurai = uraikan(nilai);
  if (!Array.isArray(terurai)) return undefined;

  return terurai.filter(isMaterialTerpasang).map((item) => ({
    barangId: item.barangId,
    jumlah: item.jumlah,
  }));
}

/** Array apa adanya, atau hasil parse bila nilainya string JSON. */
function uraikan(nilai: unknown): unknown {
  if (Array.isArray(nilai)) return nilai;
  if (typeof nilai !== "string" || !nilai.trim()) return undefined;

  try {
    return JSON.parse(nilai);
  } catch {
    return undefined;
  }
}

function isMaterialTerpasang(item: unknown): item is MaterialTerpasang {
  if (!item || typeof item !== "object") return false;

  const kandidat = item as { barangId?: unknown; jumlah?: unknown };
  return (
    typeof kandidat.barangId === "string" &&
    typeof kandidat.jumlah === "number" &&
    Number.isFinite(kandidat.jumlah)
  );
}
