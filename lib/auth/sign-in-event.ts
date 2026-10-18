import type { EventCallbacks } from "next-auth";
import { prismaAuth } from "@/lib/prisma";
import { logger } from "@/lib/logger";

type SignInMessage = Parameters<EventCallbacks["signIn"]>[0];

function portalOf(
  role:
    | {
        accessAdminPanel: boolean;
        accessEmployeePanel: boolean;
      }
    | null
    | undefined,
): string {
  if (role?.accessAdminPanel) return "Admin Portal";
  if (role?.accessEmployeePanel) return "Employee Portal";
  return "Unknown";
}

/**
 * Catat login web di Log Login dan perbarui lastLoginAt. Pencatat ini hilang
 * dalam refactor auth 2026-05-11 (b0b894e30), sehingga sejak itu tidak ada
 * login web yang tercatat.
 */
export async function recordWebSignIn({
  user,
  account,
  isNewUser,
}: SignInMessage): Promise<void> {
  let roleName = "Unknown";
  let portal = "Unknown";
  try {
    const dbUser = await prismaAuth.user.findUnique({
      where: { id: user.id },
      select: {
        role: {
          select: {
            name: true,
            accessAdminPanel: true,
            accessEmployeePanel: true,
          },
        },
      },
    });
    roleName = dbUser?.role?.name || "No Role";
    portal = portalOf(dbUser?.role);
    await prismaAuth.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  } catch (error) {
    logger.error("[AUTH] Gagal membaca peran untuk log login:", error);
  }

  await logger.logAuth({
    action: "LOGIN",
    userId: user.id,
    details: {
      email: user.email,
      name: user.name || "N/A",
      role: roleName,
      portal,
      provider: account?.provider || "credentials",
      isNewUser: isNewUser || false,
      loginTime: new Date().toISOString(),
    },
  });
}
