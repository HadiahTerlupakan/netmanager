import { getToken } from "next-auth/jwt";

import { canUseCustomerPortal } from "@/lib/customer-portal-access";
import { verifyPelangganAccessToken } from "@/lib/jwt";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { logger } from "@/lib/logger";
import { prismaAuth } from "@/lib/prisma";
import { lampiranMilikPelanggan } from "@/lib/upload/lampiran-pelanggan";
import { bacaLampiranTiket } from "@/lib/upload/lampiran-tiket";
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
 *
 * Pelanggan punya token sendiri (cookie `customer-token` di portal, Bearer di
 * aplikasi) dan hanya boleh membuka unggahannya sendiri (lihat
 * lampiran-pelanggan.ts) serta berkas yang dilampirkan staf di tiketnya.
 */

interface PermintaanUpload {
  headers: Record<string, string | string[] | undefined>;
}

interface PembacaUpload {
  tenantId: string | null;
  isSuperAdmin: boolean;
  /** Terisi untuk sesi pelanggan; aksesnya dicek per tiket, bukan per tenant. */
  pelangganId?: string;
}

/** Cookie sesi portal pelanggan; sama dengan CUSTOMER_ACCESS_TOKEN_COOKIE. */
const COOKIE_PELANGGAN = "customer-token";

/**
 * Sesi pelanggan dari token portal (cookie) atau token aplikasi (Bearer).
 * Akun yang sudah tidak boleh memakai portal ditolak, sama seperti
 * `requireCustomerAuth`.
 */
function pembacaPelanggan(
  token: string | null | undefined,
): PembacaUpload | null {
  if (!token) return null;
  const payload = verifyPelangganAccessToken(token);
  if (!payload || !canUseCustomerPortal(payload.status)) return null;
  return {
    tenantId: payload.tenantId ?? null,
    isSuperAdmin: false,
    pelangganId: payload.id,
  };
}

/**
 * Apakah staf melampirkan berkas ini di tiket milik pelanggan tersebut.
 * Hanya balasan staf: jalur di balasan pelanggan ia tulis sendiri dan tidak
 * membuktikan kepemilikan. Memakai `prismaAuth` karena server.ts melayani
 * `/uploads/` di luar konteks tenant request; saringan `pelangganId` sudah
 * membatasi ke pemilik tiket.
 */
async function dilampirkanStafDiTiketPelanggan(
  pelangganId: string,
  pathname: string,
): Promise<boolean> {
  // Postgres hanya menyaring kandidat: sinkron WO menyimpan daftarnya sebagai
  // string JSON, yang cuma bisa dicari per potongan teks. Kecocokan utuh per
  // elemen diputuskan di bawah, jadi awalan jalur tidak ikut lolos.
  const kandidat = await prismaAuth.ticketReplies.findMany({
    where: {
      isFromAdmin: true,
      supportTickets: { pelangganId },
      OR: [
        { attachments: { array_contains: [pathname] } },
        { attachments: { string_contains: pathname } },
      ],
    },
    select: { attachments: true },
    take: 20,
  });
  return kandidat.some((balasan) =>
    bacaLampiranTiket(balasan.attachments).includes(pathname),
  );
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
 * `server.ts` meneruskan request Node mentah yang tidak punya `req.cookies`,
 * dan `getToken` next-auth v4 tidak mengurai header `cookie` sendiri: tanpa
 * ini setiap file privat yang dibuka dari web balas 401 walau sedang login.
 */
function uraiCookie(
  header: string | string[] | undefined,
): Record<string, string> {
  const nilai = Array.isArray(header) ? header.join("; ") : (header ?? "");
  const cookies: Record<string, string> = {};
  for (const bagian of nilai.split(";")) {
    const pemisah = bagian.indexOf("=");
    if (pemisah < 1) continue;
    const nama = bagian.slice(0, pemisah).trim();
    const isi = bagian.slice(pemisah + 1).trim();
    try {
      cookies[nama] = decodeURIComponent(isi);
    } catch {
      // Cookie milik situs lain bisa memuat `%` lepas; jangan gagalkan sesi.
      cookies[nama] = isi;
    }
  }
  return cookies;
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

    const pelanggan = pembacaPelanggan(bearer);
    if (pelanggan) return pelanggan;
  }

  const cookies = uraiCookie(req.headers.cookie);

  const token = await getToken({
    req: {
      headers: req.headers,
      cookies,
    } as unknown as import("next-auth/jwt").GetTokenParams["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) return pembacaPelanggan(cookies[COOKIE_PELANGGAN]);

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
  // Pelanggan tidak memakai aturan tenant staf; lihat bolehBacaUpload.
  if (pembaca.pelangganId) return false;

  const tenantJalur = tenantJalurUpload(pathname);
  if (!tenantJalur) return true;
  if (pembaca.isSuperAdmin) return true;

  return pembaca.tenantId === tenantJalur;
}

/** Aturan baca untuk staf (per tenant) maupun pelanggan (per kepemilikan). */
export async function bolehBacaUpload(
  pembaca: PembacaUpload,
  pathname: string,
): Promise<boolean> {
  if (pembaca.pelangganId) {
    return (
      lampiranMilikPelanggan(pathname, pembaca.pelangganId) ||
      dilampirkanStafDiTiketPelanggan(pembaca.pelangganId, pathname)
    );
  }
  return bolehBacaJalurUpload(pembaca, pathname);
}

/** Sesi sah sekaligus berhak atas jalur yang diminta. */
export async function punyaAksesBacaUpload(
  req: PermintaanUpload,
  pathname: string,
): Promise<boolean> {
  const pembaca = await pembacaUploadDariSesi(req);
  if (!pembaca) return false;

  return bolehBacaUpload(pembaca, pathname);
}
