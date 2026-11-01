import { z } from "zod";

/** Token FCM perangkat jauh di bawah 4096 karakter; batas mencegah sampah besar. */
const FCM_TOKEN_MAX_LENGTH = 4096;

/** Token registrasi FCM berisi ratusan karakter; yang jauh lebih pendek bukan token perangkat. */
const FCM_TOKEN_MIN_LENGTH = 64;

/**
 * Token FCM hanya memakai karakter base64url dan titik dua pemisah id instans.
 * Bentuk lain ditolak, termasuk token Expo (`ExponentPushToken[...]`):
 * mendaftarkan token ikut mengosongkan `pushToken` lama yang sama nilainya.
 */
const FCM_TOKEN_PATTERN = /^[A-Za-z0-9_:-]+$/;

/**
 * Body pendaftaran (`add`) atau pelepasan (`remove`) token FCM aplikasi mobile,
 * sama untuk karyawan, mitra, pelanggan, dan investor.
 */
export const fcmTokenRequestSchema = z.object({
  fcmToken: z
    .string()
    .trim()
    .min(FCM_TOKEN_MIN_LENGTH)
    .max(FCM_TOKEN_MAX_LENGTH)
    .regex(FCM_TOKEN_PATTERN),
  action: z.enum(["add", "remove"]).default("add"),
});

export type FcmTokenRequest = z.infer<typeof fcmTokenRequestSchema>;
