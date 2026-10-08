/**
 * Batas jumlah pengembalian material work order.
 *
 * Sebelum ini endpoint pengembalian hanya memeriksa bahwa `jumlah` adalah
 * bilangan bulat positif. Tidak ada batas atas dan tidak ada kaitan ke apa pun
 * yang pernah diambil, sehingga siapa saja yang memegang `m_work_order:update`
 * — artinya setiap teknisi — bisa menaikkan stok gudang sebanyak apa pun untuk
 * barang apa pun di katalog.
 *
 * Sisa material punya batas alami: tidak mungkin mengembalikan lebih banyak
 * daripada yang diambil untuk work order itu, dikurangi yang sudah dikembalikan
 * sebelumnya. Perangkat yang ditarik dari pelanggan tidak punya pembanding
 * seperti itu karena tidak pernah keluar dari gudang; untuk sekarang jalur itu
 * dipersempit ke tipe work order yang memang mencabut perangkat, dan setiap
 * barisnya ditandai supaya bisa ditelusuri.
 */

import type {
  AsalPengembalian,
  MobileWorkOrderMaterialReturnInput,
} from "./work-order.material.types";

/**
 * Pengembalian ditolak karena melanggar batas, bukan karena server bermasalah.
 *
 * Dibedakan lewat tipe, bukan lewat tebakan kata kunci pada pesan: penolakan
 * yang terbaca sebagai 500 memberi tahu pemantauan bahwa server rusak padahal
 * teknisi hanya meminta lebih banyak daripada jatahnya, dan galat palsu yang
 * rutin melatih orang mengabaikan galat sungguhan.
 */
export class BatasPengembalianError extends Error {
  readonly code = "VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "BatasPengembalianError";
  }
}

/** Tipe work order yang wajar menarik perangkat dari pelanggan. */
const TIPE_BOLEH_TARIKAN_PELANGGAN = new Set(["DISCONNECTION", "RELOCATION"]);

export const ASAL_DEFAULT: AsalPengembalian = "SISA_MATERIAL";

interface KonteksPengembalian {
  id: string;
  type: string;
  workOrderNumber: string;
}

export interface KlienBaca {
  workOrderMaterial: {
    groupBy: (
      args: unknown,
    ) => Promise<{ barangId: string; _sum: { quantity: number | null } }[]>;
  };
  workOrders: {
    findUnique: (args: unknown) => Promise<{
      usedMaterials: unknown;
      returnedMaterials: unknown;
      consumedMaterials: unknown;
    } | null>;
  };
  $queryRaw: (
    query: TemplateStringsArray,
    ...nilai: unknown[]
  ) => Promise<unknown>;
}

/**
 * Kunci baris work order sampai transaksi selesai.
 *
 * Jatah dihitung dari riwayat lalu riwayatnya ditambah di transaksi yang sama.
 * Pada isolasi READ COMMITTED — bawaan PostgreSQL — dua pengembalian yang
 * berjalan bersamaan sama-sama membaca riwayat sebelum keduanya menulis, jadi
 * keduanya melihat jatah penuh dan keduanya lolos: jatah 2 bisa menaikkan stok
 * gudang 4. Mengunci barisnya membuat yang kedua menunggu, lalu membaca riwayat
 * yang sudah memuat tulisan pertama.
 *
 * Jalur pengambilan memakai penjaga setara lewat `updateMany ... gte`.
 */
async function kunciWorkOrder(
  klien: KlienBaca,
  workOrderId: string,
): Promise<void> {
  await klien.$queryRaw`SELECT "id" FROM "work_orders" WHERE "id" = ${workOrderId} FOR UPDATE`;
}

/** Jumlahkan `{ barangId, jumlah }` dari sebuah senarai jsonb ke dalam peta. */
export function akumulasiDariJsonb(
  riwayat: unknown,
  kedalam: Map<string, number>,
  lewati?: (baris: Record<string, unknown>) => boolean,
): void {
  if (!Array.isArray(riwayat)) return;

  for (const baris of riwayat) {
    if (!baris || typeof baris !== "object") continue;
    const catatan = baris as Record<string, unknown>;
    if (lewati?.(catatan)) continue;
    const { barangId, jumlah } = catatan;
    if (typeof barangId !== "string" || typeof jumlah !== "number") continue;
    kedalam.set(barangId, (kedalam.get(barangId) ?? 0) + jumlah);
  }
}

/**
 * Jumlah per barang yang pernah diambil untuk work order ini.
 *
 * Dibaca dari dua tempat karena pengambilan memang dicatat di dua tempat: jalur
 * mobile menambahkan ke jsonb `usedMaterials`, jalur admin membuat baris
 * `work_order_materials`. Tidak ada jalur yang menulis keduanya, jadi
 * menjumlahkan keduanya tidak menghitung ganda — sedangkan membaca salah satu
 * saja membuat pengambilan dari jalur lain tidak punya sisa sama sekali.
 */
async function hitungDiambil(
  klien: KlienBaca,
  workOrderId: string,
  usedMaterials: unknown,
): Promise<Map<string, number>> {
  const total = new Map<string, number>();
  akumulasiDariJsonb(usedMaterials, total);

  const baris = await klien.workOrderMaterial.groupBy({
    by: ["barangId"],
    where: { workOrderId },
    _sum: { quantity: true },
  });
  for (const b of baris) {
    total.set(
      b.barangId,
      (total.get(b.barangId) ?? 0) + (b._sum.quantity ?? 0),
    );
  }

  return total;
}

/**
 * Jumlah per barang yang sudah dikembalikan sebagai sisa material.
 *
 * Tarikan pelanggan sengaja tidak ikut dihitung: ia tidak pernah mengurangi
 * jatah sisa material karena memang bukan berasal dari pengambilan.
 */
/**
 * Jumlah per barang yang sudah tercatat terpasang di pelanggan.
 *
 * Barang yang sudah terpasang tidak mungkin dikembalikan ke gudang. Tanpa ini,
 * teknisi yang mengambil 10 dan memasang 7 masih bisa "mengembalikan" 10 —
 * stok gudang naik 3 unit yang sebenarnya tertanam di rumah orang.
 *
 * Work order lama tidak punya catatan pemakaian sama sekali; `null` di sana
 * menghasilkan nol, yang artinya perilakunya sama persis seperti sebelum fitur
 * ini ada. Itu disengaja — mengartikannya sebagai "belum dipakai" lebih aman
 * daripada menolak pengembalian yang sah hanya karena catatannya tidak pernah
 * dibuat.
 */
function hitungSudahDipakai(riwayat: unknown): Map<string, number> {
  const total = new Map<string, number>();
  akumulasiDariJsonb(riwayat, total);
  return total;
}

function hitungSudahDikembalikan(riwayat: unknown): Map<string, number> {
  const total = new Map<string, number>();
  akumulasiDariJsonb(
    riwayat,
    total,
    (baris) => baris.asal === "TARIKAN_PELANGGAN",
  );
  return total;
}

function jumlahDiminta(
  items: MobileWorkOrderMaterialReturnInput[],
  barangId: string,
): number {
  return items
    .filter((item) => item.barangId === barangId)
    .reduce((jumlah, item) => jumlah + item.jumlah, 0);
}

/**
 * Pastikan setiap baris pengembalian punya dasar.
 *
 * Melempar `Error` dengan pesan yang bisa dibaca teknisi; pemanggil sudah
 * menerjemahkan lemparan dari transaksi menjadi balasan 400.
 */
export async function assertBatasPengembalian(input: {
  klien: KlienBaca;
  workOrder: KonteksPengembalian;
  items: MobileWorkOrderMaterialReturnInput[];
}): Promise<void> {
  const tarikan = input.items.filter(
    (item) => item.asal === "TARIKAN_PELANGGAN",
  );
  if (
    tarikan.length > 0 &&
    !TIPE_BOLEH_TARIKAN_PELANGGAN.has(input.workOrder.type)
  ) {
    throw new BatasPengembalianError(
      "Penarikan perangkat dari pelanggan hanya berlaku untuk work order pemutusan atau relokasi.",
    );
  }

  const sisa = input.items.filter(
    (item) => (item.asal ?? ASAL_DEFAULT) === ASAL_DEFAULT,
  );
  if (sisa.length === 0) return;

  await kunciWorkOrder(input.klien, input.workOrder.id);

  const workOrder = await input.klien.workOrders.findUnique({
    where: { id: input.workOrder.id },
    select: {
      usedMaterials: true,
      returnedMaterials: true,
      consumedMaterials: true,
    },
  });

  const diambil = await hitungDiambil(
    input.klien,
    input.workOrder.id,
    workOrder?.usedMaterials,
  );
  const dikembalikan = hitungSudahDikembalikan(workOrder?.returnedMaterials);
  const dipakai = hitungSudahDipakai(workOrder?.consumedMaterials);

  // Diperiksa per barang, bukan per baris: satu permintaan bisa memuat beberapa
  // baris barang yang sama dengan kondisi berbeda, dan jatahnya satu.
  for (const barangId of new Set(sisa.map((item) => item.barangId))) {
    const jatah =
      (diambil.get(barangId) ?? 0) -
      (dipakai.get(barangId) ?? 0) -
      (dikembalikan.get(barangId) ?? 0);
    const diminta = jumlahDiminta(sisa, barangId);

    if (jatah <= 0) {
      // Tiga sebab yang berbeda, dan tindakan teknisinya juga berbeda: salah
      // pilih barang, barangnya sudah terpasang di pelanggan, atau sisanya
      // memang sudah dipulangkan semua.
      const pernahDiambil = (diambil.get(barangId) ?? 0) > 0;
      const sudahTerpasang = (dipakai.get(barangId) ?? 0) > 0;
      throw new BatasPengembalianError(
        !pernahDiambil
          ? `Barang ini tidak diambil pada ${input.workOrder.workOrderNumber}, jadi tidak ada sisa yang bisa dikembalikan.`
          : sudahTerpasang
            ? `Barang ini sudah tercatat terpasang di pelanggan, jadi tidak ada sisa yang bisa dikembalikan.`
            : `Sisa barang ini pada ${input.workOrder.workOrderNumber} sudah dikembalikan semua.`,
      );
    }

    if (diminta > jatah) {
      throw new BatasPengembalianError(
        `Sisa yang bisa dikembalikan tinggal ${jatah}, diminta ${diminta}.`,
      );
    }
  }
}
