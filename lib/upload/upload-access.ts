import { getToken } from "next-auth/jwt";

import { verifyMobileToken } from "@/lib/mobile-auth";
import { logger } from "@/lib/logger";
import { tenantJalurUpload } from "@/lib/upload/upload-policy";

/**
 * Siapa yang berhak membaca file upload privat di `/uploads/`.
 *
 * Ada dua jalur sesi yang hidup berdampingan: web memakai cookie NextAuth,
 * aplikasi mobile memakai Bearer token sendiri yang diverifikasi
 * `verifyMobileToken`. Penjaga `/uploads/` dulu hanya mengenal cookie, jadi
 * setiap foto yang diunggah dari aplikasi — KTP canvasing, laporan penyelesaian
 * WO, lampiran izin — balas dengan 401 saat aplikasi yang sama mencoba
 * menampilkannya kembali.
 *
 * Sesi saja tidak cukup: sebelum ini pemegang sesi tenant mana pun bisa membaca
 * file tenant lain asal tahu URL-nya. File yang jalurnya sudah ber-namespace
 * tenant (`/uploads/tenants/<id>/…`) kini hanya bisa dibaca oleh tenant itu
 * sendiri atau super admin.
 */

interface PermintaanUpload {
  headers: Record<string, string | string[] | undefined>;
}

interface PembacaUpload {
  tenantId: string | null;
  isSuperAdmin: boolean;
}

/** Ambil nilai Bearer dari header Authorization; null bila bukan Bearer. */
function ambilBearerToken(
  header: string | string[] | undefined,
): string | null {
  const nilai = Array.isArray(header) ? header[0] : header;
  if (!nilai?.startsWith("Bearer ")) return null;

  const token = nilai.slice("Bearer ".length).trim();
  if (!token || token === "null" || token === "undefined") return null;

  return token;
}

/**
 * Identitas pembaca dari sesi yang sah — cookie web atau token mobile; null
 * bila tidak ada sesi.
 *
 * Token mobile diperiksa lebih dulu karena ia dikirim eksplisit; cookie baru
 * dibaca sesudahnya supaya permintaan browser tetap bekerja seperti semula.
 */
export async function pembacaUploadDariSesi(
  req: PermintaanUpload,
): Promise<PembacaUpload | null> {
  const bearer = ambilBearerToken(req.headers.authorization);

  if (bearer) {
    try {
      const payload = await verifyMobileToken(bearer);
      if (payload) {
        const p = payload as Record<string, unknown>;
        return {
          tenantId: (p.tenantId as string | null) ?? null,
          isSuperAdmin: Boolean(p.isSuperAdmin),
        };
      }
    } catch (error) {
      logger.warn("[Upload] Verifikasi token mobile gagal:", error);
    }
  }

  const token = await getToken({
    req: req as unknown as import("next-auth/jwt").GetTokenParams["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) return null;

  return {
    tenantId: (token.tenantId as string | null) ?? null,
    isSuperAdmin: Boolean(token.isSuperAdmin),
  };
}

/**
 * Apakah pembaca berhak atas jalur ini.
 *
 * Jalur lama tanpa namespace tenant tidak bisa dikaitkan ke tenant mana pun,
 * jadi ia tetap terbuka untuk semua pemegang sesi — memblokirnya akan membuat
 * seluruh foto yang terlanjur tersimpan menjadi tidak bisa dibuka. Yang baru
 * ditulis selalu ber-namespace dan karena itu ikut terkunci.
 */
export function bolehBacaJalurUpload(
  pembaca: PembacaUpload,
  pathname: string,
): boolean {
  const tenantJalur = tenantJalurUpload(pathname);
  if (!tenantJalur) return true;
  if (pembaca.isSuperAdmin) return true;

  return pembaca.tenantId === tenantJalur;
}

/** Sesi sah sekaligus berhak atas jalur yang diminta. */
export async function punyaAksesBacaUpload(
  req: PermintaanUpload,
  pathname: string,
): Promise<boolean> {
  const pembaca = await pembacaUploadDariSesi(req);
  if (!pembaca) return false;

  return bolehBacaJalurUpload(pembaca, pathname);
}
