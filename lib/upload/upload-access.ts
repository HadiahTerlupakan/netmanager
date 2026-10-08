import { getToken } from "next-auth/jwt";

import { verifyMobileToken } from "@/lib/mobile-auth";
import { logger } from "@/lib/logger";

/**
 * Siapa yang berhak membaca file upload privat di `/uploads/`.
 *
 * Ada dua jalur sesi yang hidup berdampingan: web memakai cookie NextAuth,
 * aplikasi mobile memakai Bearer token sendiri yang diverifikasi
 * `verifyMobileToken`. Penjaga `/uploads/` dulu hanya mengenal cookie, jadi
 * setiap foto yang diunggah dari aplikasi — KTP canvasing, laporan penyelesaian
 * WO, lampiran izin — balas dengan 401 saat aplikasi yang sama mencoba
 * menampilkannya kembali. Hanya terasa pada tenant yang menyimpan file di disk
 * lokal; tenant dengan R2 aktif menyajikannya dari URL publik R2.
 */

interface PermintaanUpload {
  headers: Record<string, string | string[] | undefined>;
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
 * Apakah permintaan membawa sesi yang sah — cookie web atau token mobile.
 *
 * Token mobile diperiksa lebih dulu karena ia yang dikirim eksplisit; cookie
 * baru dibaca sesudahnya supaya permintaan browser tetap bekerja seperti semula.
 */
export async function punyaSesiBacaUpload(
  req: PermintaanUpload,
): Promise<boolean> {
  const bearer = ambilBearerToken(req.headers.authorization);

  if (bearer) {
    try {
      if (await verifyMobileToken(bearer)) return true;
    } catch (error) {
      logger.warn("[Upload] Verifikasi token mobile gagal:", error);
    }
  }

  const token = await getToken({
    req: req as unknown as import("next-auth/jwt").GetTokenParams["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });

  return Boolean(token);
}
