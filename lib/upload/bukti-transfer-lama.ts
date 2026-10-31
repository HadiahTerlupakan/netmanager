import { createReadStream } from "fs";
import { stat } from "fs/promises";
import type { IncomingMessage, ServerResponse } from "http";
import path, { posix } from "path";

import { logger } from "@/lib/logger";
import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import {
  pembacaUploadDariSesi,
  type PembacaUpload,
} from "@/lib/upload/upload-access";
import { CACHE_CONTROL_UPLOAD_PRIVAT } from "@/lib/upload/upload-policy";

/**
 * Bukti transfer dari penyimpanan lokal lama, `public/receipts`, sebelum
 * bukti disimpan di `uploads/tenants/<id>/payment-proofs`. Berkasnya tidak
 * dipindah; server.ts menyajikannya lewat penjaga ini, bukan handler statis
 * Next yang dulu menyajikannya kepada siapa saja yang tahu URL-nya.
 *
 * Jalurnya tidak memuat tenant, jadi tenant dibaca dari payment yang
 * merujuknya. Portal dan aplikasi pelanggan hanya tahu apakah bukti sudah
 * diunggah dan tidak pernah menampilkannya, jadi pelanggan tidak ikut
 * membaca, sama seperti bukti di jalur baru.
 */

// convertAndSaveImage selalu menyimpan WebP, langsung di bawah `receipts/`.
const JALUR_BUKTI_LAMA = /^\/receipts\/[^/]+\.webp$/;
const DIREKTORI_PUBLIK = path.resolve(process.cwd(), "public");
const METODE_BACA = new Set(["GET", "HEAD"]);
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_ERROR = 500;
const PESAN_SESI_TIDAK_SAH =
  "Sesi tidak valid atau telah berakhir. Silakan login kembali.";
const PESAN_TIDAK_DITEMUKAN = "File tidak ditemukan";
const PESAN_GALAT_INTERNAL = "Terjadi kesalahan pada server";

/** Bentuk kanonik jalur bukti transfer lama, atau null bila bukan jalur itu. */
export function kanonikJalurBuktiLama(
  pathname: string | null | undefined,
): string | null {
  let terdekode: string;
  try {
    terdekode = decodeURIComponent((pathname ?? "").trim());
  } catch {
    return null;
  }
  if (terdekode.includes("\\") || terdekode.includes("\0")) return null;

  const normal = posix.normalize(terdekode);
  return JALUR_BUKTI_LAMA.test(normal) ? normal : null;
}

/**
 * Apakah pembaca berhak atas bukti lama ini: staf tenant payment yang
 * merujuknya, atau super admin. Berkas yang tidak dirujuk payment mana pun
 * tidak disajikan kepada siapa pun.
 */
export async function bolehBacaBuktiLama(
  pembaca: PembacaUpload,
  jalur: string,
): Promise<boolean> {
  if (pembaca.pelangganId) return false;
  const tenantPembaca = pembaca.tenantId;
  if (!pembaca.isSuperAdmin && !tenantPembaca) return false;

  // Memakai klien tanpa konteks tenant: server.ts melayani jalur ini di luar
  // konteks request; saringan receiptUrl sudah membatasi ke payment-nya.
  const payments = await prismaBillingAuth.payment.findMany({
    where: { receiptUrl: jalur },
    select: { tenantId: true, pelangganId: true },
  });
  if (payments.length === 0) return false;
  if (pembaca.isSuperAdmin) return true;

  const tenants = await tenantPembayaran(payments);
  return tenantPembaca !== null && tenants.has(tenantPembaca);
}

// Payment lama dari billing harian tersimpan tanpa tenantId; tenantnya adalah
// tenant pelanggannya.
async function tenantPembayaran(
  payments: Array<{ tenantId: string | null; pelangganId: string }>,
): Promise<Set<string>> {
  const tenants = new Set(
    payments.flatMap((p) => (p.tenantId ? [p.tenantId] : [])),
  );
  const pelangganTanpaTenant = [
    ...new Set(payments.filter((p) => !p.tenantId).map((p) => p.pelangganId)),
  ];
  if (pelangganTanpaTenant.length === 0) return tenants;

  const pelanggan = await prismaAuth.pelanggan.findMany({
    where: { id: { in: pelangganTanpaTenant } },
    select: { tenantId: true },
  });
  for (const { tenantId } of pelanggan) {
    if (tenantId) tenants.add(tenantId);
  }
  return tenants;
}

/**
 * Sajikan bukti transfer lama kepada yang berhak. Tanpa sesi: 401. Selain
 * staf tenant pembayarannya dan super admin: 404, agar keberadaan berkasnya
 * tidak terbaca. Jalur ini tidak pernah diteruskan ke handler statis Next.
 */
export async function sajikanBuktiTransferLama(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  direktoriPublik = DIREKTORI_PUBLIK,
): Promise<void> {
  try {
    const jalur = kanonikJalurBuktiLama(pathname);
    if (!jalur || !METODE_BACA.has(req.method ?? "")) {
      return kirimGalat(res, HTTP_NOT_FOUND, PESAN_TIDAK_DITEMUKAN);
    }

    const pembaca = await pembacaUploadDariSesi(req);
    if (!pembaca) {
      return kirimGalat(res, HTTP_UNAUTHORIZED, PESAN_SESI_TIDAK_SAH);
    }
    if (!(await bolehBacaBuktiLama(pembaca, jalur))) {
      logger.warn(
        `[Server] Akses bukti transfer lama ditolak: ${jalur} (tenant ${pembaca.tenantId ?? "-"})`,
      );
      return kirimGalat(res, HTTP_NOT_FOUND, PESAN_TIDAK_DITEMUKAN);
    }

    await kirimBerkas(req, res, path.join(direktoriPublik, jalur));
  } catch (error) {
    logger.error("[Server] Gagal menyajikan bukti transfer lama:", error);
    if (!res.headersSent) {
      kirimGalat(res, HTTP_INTERNAL_ERROR, PESAN_GALAT_INTERNAL);
    }
  }
}

async function kirimBerkas(
  req: IncomingMessage,
  res: ServerResponse,
  berkas: string,
) {
  const info = await stat(berkas).catch((): null => null);
  if (!info?.isFile()) {
    return kirimGalat(res, HTTP_NOT_FOUND, PESAN_TIDAK_DITEMUKAN);
  }

  res.writeHead(200, {
    "Content-Type": "image/webp",
    "Content-Length": info.size,
    "Cache-Control": CACHE_CONTROL_UPLOAD_PRIVAT,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(berkas)
    .on("error", (error) => {
      // Tanpa pendengar, galat baca membuat proses server berhenti.
      logger.warn("[Server] Gagal membaca bukti transfer lama:", error);
      res.destroy(error);
    })
    .pipe(res);
}

// Penolakan pun tidak boleh tersimpan di cache bersama: 404 yang tersimpan
// menyembunyikan bukti dari staf yang berhak.
function kirimGalat(res: ServerResponse, status: number, pesan: string) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": CACHE_CONTROL_UPLOAD_PRIVAT,
  });
  res.end(JSON.stringify({ error: pesan }));
}
