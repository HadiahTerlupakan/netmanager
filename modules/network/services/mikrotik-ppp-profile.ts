import { logger } from "@/lib/logger";
import { RadiusConnectionError } from "../utils/errors";
import { NetworkRepository } from "../repositories/NetworkRepository";
import { MikroTikRouterResolver } from "./mikrotik/MikroTikRouterResolver";
import {
  buildCreateProfileParams,
  buildUpdateProfileParams,
} from "./mikrotik/ppp-profile-params";
import {
  deleteManagedIPPool,
  removePPPProfileByName,
} from "./mikrotik/ppp-profile-delete";
import { formatRateLimitFromBandwidth } from "./mikrotik/ppp-rate-limit";
import type { PPPProfileData } from "./mikrotik/ppp-profile.types";
import {
  checkIPPoolExists,
  connectToMikroTik,
  createIPPool,
  getIPPoolRanges as getMikroTikIPPoolRanges,
} from "./mikrotik-ip-pool-client";

const routerResolver = new MikroTikRouterResolver();

export async function getRateLimitFromBandwidth(
  profilePPPId: string,
  bandwidthId?: string | null,
): Promise<string | null> {
  try {
    const networkRepo = new NetworkRepository();

    if (bandwidthId) {
      const bandwidth = await networkRepo.findBandwidthById(bandwidthId);

      if (!bandwidth) {
        return null;
      }

      const rateLimit = formatRateLimitFromBandwidth(bandwidth);
      return rateLimit;
    }

    const profilePPP =
      await networkRepo.findProfilePPPWithHargaPaket(profilePPPId);

    if (
      !profilePPP ||
      !profilePPP.hargaPaket ||
      profilePPP.hargaPaket.length === 0
    ) {
      return null;
    }

    const hargaPaket =
      profilePPP.hargaPaket.find((hp) => hp.status === "AKTIF") ||
      profilePPP.hargaPaket[0];

    if (!hargaPaket || !hargaPaket.bandwidth) {
      return null;
    }

    const bandwidth = hargaPaket.bandwidth;

    const rateLimit = formatRateLimitFromBandwidth(bandwidth);
    return rateLimit;
  } catch (error) {
    logger.error(
      "[MikroTik PPP] Error getting rate limit from bandwidth:",
      error,
    );
    throw new RadiusConnectionError(
      "Gagal terhubung ke router: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

export async function getIPPoolRanges(
  routerId: string,
  poolName: string,
): Promise<{ success: boolean; ranges?: string; error?: string }> {
  return getMikroTikIPPoolRanges(routerId, poolName);
}

export async function createPPPProfileInMikroTik(
  routerId: string,
  profileData: PPPProfileData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const router = await routerResolver.findRouter(routerId);

    if (!router) {
      return { success: false, error: "Router tidak ditemukan" };
    }

    const conn = await connectToMikroTik({
      ipAddress: router.ipAddress,
      apiPort: router.apiPort,
      apiUsername: router.apiUsernameGenerated || router.apiUsername,
      apiPassword: router.apiPasswordGenerated || router.apiPassword,
    });

    try {
      if (!profileData.skipPoolCheck) {
        if (profileData.ipRange && profileData.ipRange.trim() !== "") {
          const poolResult = await createIPPool(
            conn,
            profileData.remoteAddress,
            profileData.ipRange,
          );
          if (!poolResult.success) {
            conn.close();
            return {
              success: false,
              error: `Gagal membuat IP Pool: ${poolResult.error}`,
            };
          }
        } else {
          const poolExists = await checkIPPoolExists(
            conn,
            profileData.remoteAddress,
          );
          if (!poolExists) {
            conn.close();
            return {
              success: false,
              error: `IP Pool "${profileData.remoteAddress}" tidak ditemukan. Silakan buat IP Pool terlebih dahulu atau berikan IP Range untuk membuat otomatis.`,
            };
          }
        }
      }

      const paramsResult = buildCreateProfileParams(profileData);
      if (paramsResult.ok === false) {
        conn.close();
        return { success: false, error: paramsResult.error };
      }

      const result = await conn.write("/ppp/profile/add", paramsResult.params);

      if (result && Array.isArray(result) && result.length > 0) {
        const firstResult = result[0];
        if (firstResult && firstResult["!trap"]) {
          const errorMsg = firstResult["message"] || "Terjadi kesalahan";
          conn.close();
          return { success: false, error: `MikroTik error: ${errorMsg}` };
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const verifyProfiles = await conn.write("/ppp/profile/print", [
        "?name=" + profileData.name,
      ]);

      if (!verifyProfiles || verifyProfiles.length === 0) {
        conn.close();
        return {
          success: false,
          error:
            "Profile dibuat tapi tidak ditemukan saat verifikasi. Periksa log untuk detail.",
        };
      }

      const createdProfile = verifyProfiles[0];

      if (
        createdProfile &&
        profileData.rateLimit &&
        profileData.rateLimit.trim() !== ""
      ) {
        const actualRateLimit =
          createdProfile["rate-limit"] || createdProfile["rateLimit"] || null;

        if (!actualRateLimit || actualRateLimit.trim() === "") {
          logger.warn(
            "[MikroTik PPP] WARNING: rate-limit tidak ter-set di MikroTik!",
          );
        } else if (actualRateLimit !== profileData.rateLimit) {
          logger.warn("[MikroTik PPP] WARNING: rate-limit tidak sesuai!");
        }
      }

      conn.close();
      return { success: true };
    } catch (error) {
      conn.close();
      logger.error("Error creating PPP profile in MikroTik:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage || "Gagal membuat profile PPP di MikroTik",
      };
    }
  } catch (error) {
    logger.error("Error connecting to MikroTik:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || "Gagal terhubung ke MikroTik Router",
    };
  }
}

export async function updatePPPProfileInMikroTik(
  routerId: string,
  profileName: string,
  profileData: Partial<PPPProfileData>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const router = await routerResolver.findRouter(routerId);

    if (!router) {
      return { success: false, error: "Router tidak ditemukan" };
    }

    const conn = await connectToMikroTik({
      ipAddress: router.ipAddress,
      apiPort: router.apiPort,
      apiUsername: router.apiUsernameGenerated || router.apiUsername,
      apiPassword: router.apiPasswordGenerated || router.apiPassword,
    });

    try {
      const profiles = await conn.write("/ppp/profile/print", [
        "?name=" + profileName,
      ]);

      if (!profiles || profiles.length === 0 || !profiles[0]) {
        conn.close();

        const createData: PPPProfileData = {
          name: profileData.name || profileName,
          localAddress: profileData.localAddress || "0.0.0.0",
          remoteAddress:
            profileData.remoteAddress || profileData.name || profileName,
          ...profileData,
        };

        return await createPPPProfileInMikroTik(routerId, createData);
      }

      const profileId = profiles[0][".id"];
      const oldProfileData = profiles[0];

      if (!profileData.skipPoolCheck) {
        if (profileData.remoteAddress !== undefined || profileData.ipRange) {
          const newPoolName =
            profileData.remoteAddress || oldProfileData["remote-address"];

          if (profileData.ipRange && profileData.ipRange.trim() !== "") {
            const poolResult = await createIPPool(
              conn,
              newPoolName,
              profileData.ipRange,
            );
            if (!poolResult.success) {
              logger.error(
                "[MikroTik PPP] Failed to update IP Pool:",
                poolResult.error,
              );
            }
          } else if (
            profileData.remoteAddress &&
            profileData.remoteAddress !== oldProfileData["remote-address"]
          ) {
            const poolExists = await checkIPPoolExists(conn, newPoolName);
            if (!poolExists) {
              conn.close();
              return {
                success: false,
                error: `IP Pool "${newPoolName}" tidak ditemukan. Silakan berikan IP Range untuk membuat otomatis.`,
              };
            }
          }
        }
      }

      const updateParams = buildUpdateProfileParams(profileName, profileData);

      if (updateParams.length > 0) {
        const idParam = `=.id=${profileId}`;
        const updateCommand = [idParam, ...updateParams];
        const result = await conn.write("/ppp/profile/set", updateCommand);

        if (result && Array.isArray(result) && result.length > 0) {
          const firstResult = result[0];
          if (firstResult && firstResult["!trap"]) {
            const errorMsg = firstResult["message"] || "Terjadi kesalahan";
            conn.close();
            return { success: false, error: `MikroTik error: ${errorMsg}` };
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));

        const verifyName =
          profileData.name && profileData.name !== profileName
            ? profileData.name
            : profileName;
        const verifyProfiles = await conn.write("/ppp/profile/print", [
          "?name=" + verifyName,
        ]);

        if (
          !verifyProfiles ||
          verifyProfiles.length === 0 ||
          !verifyProfiles[0]
        ) {
          conn.close();
          return {
            success: false,
            error:
              "Profile diupdate tapi tidak ditemukan saat verifikasi. Periksa log untuk detail.",
          };
        }

        const updatedProfile = verifyProfiles[0];

        if (
          profileData.rateLimit !== undefined &&
          profileData.rateLimit &&
          profileData.rateLimit.trim() !== ""
        ) {
          const actualRateLimit =
            updatedProfile["rate-limit"] || updatedProfile["rateLimit"] || null;

          if (!actualRateLimit || actualRateLimit.trim() === "") {
            logger.warn(
              "[MikroTik PPP] WARNING: rate-limit tidak ter-set di MikroTik setelah update!",
            );
          } else if (actualRateLimit !== profileData.rateLimit) {
            logger.warn(
              "[MikroTik PPP] WARNING: rate-limit tidak sesuai setelah update!",
            );
          }
        }
      }

      conn.close();
      return { success: true };
    } catch (error) {
      conn.close();
      logger.error("Error updating PPP profile in MikroTik:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage || "Gagal mengupdate profile PPP di MikroTik",
      };
    }
  } catch (error) {
    logger.error("Error connecting to MikroTik:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || "Gagal terhubung ke MikroTik Router",
    };
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

    const conn = await connectToMikroTik({
      ipAddress: router.ipAddress,
      apiPort: router.apiPort,
      apiUsername: router.apiUsernameGenerated || router.apiUsername,
      apiPassword: router.apiPasswordGenerated || router.apiPassword,
    });

    try {
      const profiles = await conn.write("/ppp/profile/print", [
        "?name=" + profileName,
      ]);

      let profileRemoteAddress = remoteAddress;

      const firstProfile = profiles?.[0];
      if (!profileRemoteAddress && firstProfile) {
        profileRemoteAddress =
          firstProfile["remote-address"] || firstProfile["remoteAddress"];
      }

      if (!profiles || profiles.length === 0) {
        if (profileRemoteAddress) {
          const poolResult = await deleteManagedIPPool(
            conn,
            profileRemoteAddress,
          );
          if (!poolResult.success) {
            logger.error(
              "[MikroTik PPP] Failed to delete IP Pool:",
              poolResult.error,
            );
          }
        }
        conn.close();
        return { success: true };
      }

      const deleteResult = await removePPPProfileByName(conn, profileName);
      if (!deleteResult.success) {
        conn.close();
        return deleteResult;
      }

      if (profileRemoteAddress) {
        const poolResult = await deleteManagedIPPool(
          conn,
          profileRemoteAddress,
        );
        if (!poolResult.success) {
          logger.error(
            "[MikroTik PPP] Failed to delete IP Pool:",
            poolResult.error,
          );
        }
      }

      conn.close();
      return { success: true };
    } catch (error) {
      conn.close();
      logger.error("Error deleting PPP profile in MikroTik:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage || "Gagal menghapus profile PPP di MikroTik",
      };
    }
  } catch (error) {
    logger.error("Error connecting to MikroTik:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || "Gagal terhubung ke MikroTik Router",
    };
  }
}
