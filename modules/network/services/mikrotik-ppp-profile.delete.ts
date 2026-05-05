import { logger } from "@/lib/logger";

import {
  deleteManagedIPPool,
  removePPPProfileByName,
} from "./mikrotik/ppp-profile-delete";
import { MikroTikRouterResolver } from "./mikrotik/MikroTikRouterResolver";
import { connectToMikroTik } from "./mikrotik-ip-pool-client";

const routerResolver = new MikroTikRouterResolver();

function getRouterConnectionInput(router: {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiUsernameGenerated: string | null;
  apiPassword: string;
  apiPasswordGenerated: string | null;
}) {
  return {
    ipAddress: router.ipAddress,
    apiPort: router.apiPort,
    apiUsername: router.apiUsernameGenerated || router.apiUsername,
    apiPassword: router.apiPasswordGenerated || router.apiPassword,
  };
}

async function resolveRemoteAddress(
  profiles: unknown,
  remoteAddress?: string,
): Promise<string | undefined> {
  const firstProfile = Array.isArray(profiles) ? profiles[0] : null;
  if (remoteAddress || !firstProfile || typeof firstProfile !== "object") {
    return remoteAddress;
  }

  const profile = firstProfile as Record<string, string>;
  return profile["remote-address"] || profile.remoteAddress || undefined;
}

async function deleteProfilePoolIfNeeded(
  conn: Awaited<ReturnType<typeof connectToMikroTik>>,
  remoteAddress?: string,
) {
  if (!remoteAddress) {
    return;
  }

  const poolResult = await deleteManagedIPPool(conn, remoteAddress);
  if (!poolResult.success) {
    logger.error("[MikroTik PPP] Failed to delete IP Pool:", poolResult.error);
  }
}

export async function deletePPPProfileInMikroTik(
  routerId: string,
  profileName: string,
  remoteAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const router = await routerResolver.findRouter(routerId);
    if (!router) {
      return { success: false, error: "Router tidak ditemukan" };
    }

    const conn = await connectToMikroTik(getRouterConnectionInput(router));

    try {
      const profiles = await conn.write("/ppp/profile/print", [
        "?name=" + profileName,
      ]);
      const profileRemoteAddress = await resolveRemoteAddress(
        profiles,
        remoteAddress,
      );

      if (!profiles || profiles.length === 0) {
        await deleteProfilePoolIfNeeded(conn, profileRemoteAddress);
        conn.close();
        return { success: true };
      }

      const deleteResult = await removePPPProfileByName(conn, profileName);
      if (!deleteResult.success) {
        conn.close();
        return deleteResult;
      }

      await deleteProfilePoolIfNeeded(conn, profileRemoteAddress);
      conn.close();
      return { success: true };
    } catch (error) {
      conn.close();
      logger.error("Error deleting PPP profile in MikroTik:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message || "Gagal menghapus profile PPP di MikroTik"
            : "Gagal menghapus profile PPP di MikroTik",
      };
    }
  } catch (error) {
    logger.error("Error connecting to MikroTik:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message || "Gagal terhubung ke MikroTik Router"
          : "Gagal terhubung ke MikroTik Router",
    };
  }
}
