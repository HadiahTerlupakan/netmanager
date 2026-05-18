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

export async function performMobileLogout(
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
