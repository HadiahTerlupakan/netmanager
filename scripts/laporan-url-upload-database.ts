/**
 * Peta rujukan URL upload di database: berapa baris yang masih menunjuk jalur
 * TANPA namespace tenant, per kolom.
 *
 * Penyajian `/uploads/` sudah menolak pembaca dari tenant lain, tetapi hanya
 * untuk jalur yang memuat segmen `tenants/<id>/`. Berkas lama tidak punya
 * segmen itu sehingga tetap terbaca oleh pemegang sesi tenant mana pun.
 * Memindahkan berkasnya saja tidak cukup: setiap URL yang tersimpan di
 * database harus ikut diperbarui dalam transaksi yang sama, kalau tidak
 * fotonya menjadi yatim — lebih buruk daripada keadaan sekarang.
 *
 * Skrip ini hanya MENGHITUNG, tidak mengubah apa pun. Keluarannya adalah bahan
 * keputusan: kolom mana yang benar-benar terdampak dan seberapa banyak.
 *
 *   npx tsx scripts/laporan-url-upload-database.ts
 *
 * Kolom dipindai dari daftar kandidat di bawah; yang hasilnya nol berarti tidak
 * pernah menyimpan URL upload dan boleh diabaikan saat merancang migrasi.
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { runAsSystemContext } from "../lib/tenant-context";

interface Kandidat {
  tabel: string;
  kolom: string;
  array?: boolean;
}

/** Kandidat dari schema.prisma: kolom bertipe String/String[] yang namanya menyiratkan berkas. */
const KANDIDAT: Kandidat[] = [
  { tabel: "Attendance", kolom: "checkInPhoto" },
  { tabel: "Attendance", kolom: "checkOutPhoto" },
  { tabel: "Attendance", kolom: "correctionEvidencePhotoUrl" },
  { tabel: "Joinbox", kolom: "images", array: true },
  { tabel: "LandingFooter", kolom: "logoUrl" },
  { tabel: "LandingHero", kolom: "logoUrl" },
  { tabel: "LeaveRequest", kolom: "attachmentUrl" },
  { tabel: "Message", kolom: "imageUrl" },
  { tabel: "Odc", kolom: "images", array: true },
  { tabel: "Odp", kolom: "images", array: true },
  { tabel: "Otb", kolom: "images", array: true },
  { tabel: "Overtime", kolom: "startPhoto" },
  { tabel: "Overtime", kolom: "endPhoto" },
  { tabel: "PlanningDocument", kolom: "fileUrl" },
  { tabel: "Pole", kolom: "images", array: true },
  { tabel: "User", kolom: "image" },
  { tabel: "WhatsAppMessage", kolom: "fileUrl" },
  { tabel: "app_releases", kolom: "downloadUrl" },
  { tabel: "app_versions", kolom: "apkUrl" },
  { tabel: "barang_keluar", kolom: "fotoBukti", array: true },
  { tabel: "barang_masuk", kolom: "fotoBukti", array: true },
  { tabel: "canvasing", kolom: "foto" },
  { tabel: "canvasing", kolom: "fotoKtp" },
  { tabel: "goods_receipts", kolom: "fotoBukti", array: true },
  { tabel: "goods_returns", kolom: "fotoBukti", array: true },
  { tabel: "investor_deposits", kolom: "proofFileUrl" },
  { tabel: "mapping_nodes", kolom: "photo" },
  { tabel: "point_claims", kolom: "buktiUrls", array: true },
  { tabel: "presurvei_kegiatan", kolom: "fotoUrls", array: true },
  { tabel: "purchase_orders", kolom: "fotoBukti", array: true },
  { tabel: "purchase_request_jasa_items", kolom: "buktiSelesai", array: true },
  { tabel: "suppliers", kolom: "contractDocumentUrl" },
  { tabel: "suppliers", kolom: "npwpDocumentUrl" },
  { tabel: "suppliers", kolom: "siupDocumentUrl" },
  { tabel: "transfer_antar_gudang", kolom: "fotoBukti", array: true },
  { tabel: "work_order_attachments", kolom: "filePath" },
];

interface Hitungan {
  tanpaNamespace: number;
  berNamespace: number;
}

/**
 * Kolom array dibongkar dengan `unnest` supaya satu baris dengan tiga foto
 * terhitung tiga, bukan satu — jumlah berkas itulah yang menentukan beban
 * migrasi, bukan jumlah baris.
 */
function susunKueri(k: Kandidat): string {
  const nilai = k.array ? `unnest("${k.kolom}")` : `"${k.kolom}"`;
  const sumber = k.array
    ? `(SELECT ${nilai} AS v FROM "${k.tabel}") t`
    : `(SELECT ${nilai} AS v FROM "${k.tabel}") t`;

  return `
    SELECT
      count(*) FILTER (WHERE v LIKE '%/uploads/%' AND v NOT LIKE '%/uploads/tenants/%') AS tanpa,
      count(*) FILTER (WHERE v LIKE '%/uploads/tenants/%') AS dengan
    FROM ${sumber}
  `;
}

async function hitung(k: Kandidat): Promise<Hitungan | null> {
  try {
    const baris = await prisma.$queryRawUnsafe<
      { tanpa: bigint; dengan: bigint }[]
    >(susunKueri(k));
    const r = baris[0];
    return {
      tanpaNamespace: Number(r?.tanpa ?? 0),
      berNamespace: Number(r?.dengan ?? 0),
    };
  } catch (error) {
    // Tabel/kolom bisa saja belum ada di environment tertentu; itu bukan
    // kegagalan laporan, cukup dilewati dengan catatan.
    logger.warn(
      `[Laporan URL] Lewati ${k.tabel}.${k.kolom}: ${
        error instanceof Error ? error.message.split("\n")[0] : String(error)
      }`,
    );
    return null;
  }
}

async function jalankan() {
  let totalTanpa = 0;
  let totalDengan = 0;
  const terdampak: string[] = [];

  for (const k of KANDIDAT) {
    const h = await hitung(k);
    if (!h) continue;
    if (h.tanpaNamespace === 0 && h.berNamespace === 0) continue;

    totalTanpa += h.tanpaNamespace;
    totalDengan += h.berNamespace;
    if (h.tanpaNamespace > 0) terdampak.push(`${k.tabel}.${k.kolom}`);

    logger.info(
      `  ${k.tabel}.${k.kolom}: ${h.tanpaNamespace} tanpa namespace, ${h.berNamespace} sudah ber-namespace`,
    );
  }

  logger.info(
    `TOTAL: ${totalTanpa} rujukan tanpa namespace tenant, ${totalDengan} sudah ber-namespace`,
  );

  if (totalTanpa === 0) {
    logger.info("Tidak ada yang perlu dimigrasi.");
    return;
  }

  logger.info(
    `Kolom yang harus ikut diperbarui bila berkasnya dipindahkan (${terdampak.length}): ${terdampak.join(", ")}`,
  );
}

runAsSystemContext("laporan rujukan URL upload lintas tenant", jalankan)
  .catch((error) => {
    logger.error("Gagal menyusun laporan URL upload:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
