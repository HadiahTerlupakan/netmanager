/**
 * Laporan berkas upload yang belum ber-namespace tenant.
 *
 * Penyajian `/uploads/` kini menolak pembaca dari tenant lain, tetapi hanya
 * untuk jalur yang memuat segmen `tenants/<id>/`. Berkas lama tidak punya
 * segmen itu dan karena itu tidak bisa dikaitkan ke tenant mana pun — ia tetap
 * terbuka bagi siapa pun yang memegang sesi. Memblokirnya begitu saja akan
 * membuat seluruh foto yang terlanjur tersimpan tidak bisa dibuka.
 *
 * Skrip ini hanya MELAPOR, tidak memindahkan apa pun. Pemindahan berkas harus
 * berjalan bersama pembaruan URL di database, dan rujukannya tersebar di banyak
 * kolom — antara lain `Attendance.checkInPhoto`/`checkOutPhoto`,
 * `canvasing.foto`/`fotoKtp`, `Overtime.startPhoto`/`endPhoto`, `users.image`,
 * `PointClaim.buktiUrls`, serta beberapa kolom jsonb pada work order. Memindah
 * berkas tanpa memperbarui semuanya akan membuat foto menjadi yatim, yang lebih
 * buruk daripada keadaan sekarang.
 *
 *   npx tsx scripts/laporan-upload-tanpa-tenant.ts
 */

import { readdir, stat } from "fs/promises";
import path from "path";

import { logger } from "../lib/logger";

const AKAR_UPLOAD = path.join(process.cwd(), "public", "uploads");

interface Ringkasan {
  jumlah: number;
  totalByte: number;
}

function ringkasanKosong(): Ringkasan {
  return { jumlah: 0, totalByte: 0 };
}

function megabyte(byte: number): string {
  return `${(byte / 1024 / 1024).toFixed(2)} MB`;
}

async function telusuri(
  direktori: string,
  kunjungi: (berkas: string, ukuran: number) => void,
): Promise<void> {
  let isi;
  try {
    isi = await readdir(direktori, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entri of isi) {
    const jalur = path.join(direktori, entri.name);
    if (entri.isDirectory()) {
      await telusuri(jalur, kunjungi);
      continue;
    }

    const info = await stat(jalur);
    kunjungi(jalur, info.size);
  }
}

async function main() {
  const berNamespace = ringkasanKosong();
  const lama = new Map<string, Ringkasan>();

  await telusuri(AKAR_UPLOAD, (berkas, ukuran) => {
    const relatif = path.relative(AKAR_UPLOAD, berkas).split(path.sep);

    if (relatif[0] === "tenants") {
      berNamespace.jumlah += 1;
      berNamespace.totalByte += ukuran;
      return;
    }

    const folder = relatif[0] ?? "(akar)";
    const ringkasan = lama.get(folder) ?? ringkasanKosong();
    ringkasan.jumlah += 1;
    ringkasan.totalByte += ukuran;
    lama.set(folder, ringkasan);
  });

  logger.info(
    `Ber-namespace tenant: ${berNamespace.jumlah} berkas (${megabyte(berNamespace.totalByte)})`,
  );

  if (lama.size === 0) {
    logger.info("Tidak ada berkas lama tanpa namespace tenant.");
    return;
  }

  const total = ringkasanKosong();
  for (const [folder, ringkasan] of [...lama].sort(
    (a, b) => b[1].jumlah - a[1].jumlah,
  )) {
    total.jumlah += ringkasan.jumlah;
    total.totalByte += ringkasan.totalByte;
    logger.info(
      `  tanpa namespace — ${folder}: ${ringkasan.jumlah} berkas (${megabyte(ringkasan.totalByte)})`,
    );
  }

  logger.info(
    `Total tanpa namespace: ${total.jumlah} berkas (${megabyte(total.totalByte)})`,
  );
  logger.info(
    "Berkas ini masih terbaca oleh pemegang sesi tenant mana pun. Pemindahannya harus satu paket dengan pembaruan URL di database.",
  );
}

main().catch((error) => {
  logger.error("Gagal menyusun laporan upload:", error);
  process.exitCode = 1;
});
