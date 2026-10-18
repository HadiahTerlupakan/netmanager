import { logger } from "@/lib/logger";
import { invalidatePelangganRefreshTokens } from "@/lib/jwt";
import { prismaAuth, prismaMitra } from "@/modules/database";

/**
 * Logout mobile — revoke refresh token server-side dengan increment
 * tokenVersion. Service ini encapsulate akses Prisma agar API route
 * tetap thin (sesuai aturan no-restricted-imports di route layer).
 *
 * Tanpa endpoint ini, refresh token tetap valid 30 hari setelah user
 * logout. Token yang bocor tidak dapat dicabut sampai user login ulang.
 */

export type MobileLogoutRole = "CUSTOMER" | "MITRA" | string;

export interface MobileLogoutInput {
  userId: string;
  role: MobileLogoutRole;
}

/**
 * Logout dari aplikasi hanya mencabut token mobile karyawan: menaikkan
 * `tokenVersion` ikut mengeluarkan sesi web akun yang sama.
 */
export async function performMobileLogout(
  input: MobileLogoutInput,
): Promise<void> {
  if (input.role === "CUSTOMER" || input.role === "MITRA") {
    return revokeMobileSessions(input);
  }
  await prismaAuth.user.update({
    where: { id: input.userId },
    data: { mobileTokenVersion: { increment: 1 } },
  });
}

/**
 * Mencabut seluruh sesi mobile milik satu akun. Dipakai saat logout dan saat
 * password diganti — tanpa itu refresh token lama tetap bisa mencetak access
 * token baru selama 30 hari, sehingga mengganti password tidak mengusir
 * siapa pun yang sesinya sudah terlanjur bocor.
 */
export async function revokeMobileSessions(
  input: MobileLogoutInput,
): Promise<void> {
  const { userId, role } = input;

  if (role === "CUSTOMER") {
    await invalidatePelangganRefreshTokens(userId);
    return;
  }

  if (role === "MITRA") {
    await prismaMitra.mitra.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return;
  }

  // Default: Employee/admin user
  await prismaAuth.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });

  logger.debug?.("[MobileLogoutService] tokenVersion incremented", {
    userId,
    role,
  });
}
