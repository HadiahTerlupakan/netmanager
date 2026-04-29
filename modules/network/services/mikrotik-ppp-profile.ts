import { logger } from "@/lib/logger";
import { RadiusConnectionError } from "../utils/errors";
import { RouterOSAPI } from "node-routeros-v2";
import { NetworkRepository } from "../repositories/NetworkRepository";
import {
  checkIPPoolExists,
  connectToMikroTik,
  createIPPool,
  getIPPoolRanges as getMikroTikIPPoolRanges,
} from "./mikrotik-ip-pool-client";

interface PPPProfileData {
  name: string;
  localAddress: string;
  remoteAddress: string;
  ipRange?: string | null;
  dnsServer?: string | null;
  sessionTimeout?: number | null;
  idleTimeout?: number | null;
  rateLimit?: string;
  skipPoolCheck?: boolean;
  skipRateLimit?: boolean;
}

function formatRateLimitFromBandwidth(bandwidth: {
  maxLimitDownload: string;
  maxLimitUpload: string;
  burstLimitDownload?: string | null;
  burstLimitUpload?: string | null;
  burstThresholdDownload?: string | null;
  burstThresholdUpload?: string | null;
  burstTimeDownload?: number | null;
  burstTimeUpload?: number | null;
  priority?: number | null;
  minLimitDownload?: string | null;
  minLimitUpload?: string | null;
}): string {
  let rateLimit = `${bandwidth.maxLimitDownload}/${bandwidth.maxLimitUpload}`;

  if (bandwidth.burstLimitDownload || bandwidth.burstLimitUpload) {
    const burstRx = bandwidth.burstLimitDownload || bandwidth.maxLimitDownload;
    const burstTx = bandwidth.burstLimitUpload || bandwidth.maxLimitUpload;
    rateLimit += ` ${burstRx}/${burstTx}`;
  }

  if (bandwidth.burstThresholdDownload || bandwidth.burstThresholdUpload) {
    const thresholdRx =
      bandwidth.burstThresholdDownload || bandwidth.maxLimitDownload;
    const thresholdTx =
      bandwidth.burstThresholdUpload || bandwidth.maxLimitUpload;
    rateLimit += ` ${thresholdRx}/${thresholdTx}`;
  }

  if (bandwidth.burstTimeDownload || bandwidth.burstTimeUpload) {
    const timeRx = bandwidth.burstTimeDownload || 1;
    const timeTx =
      bandwidth.burstTimeUpload || bandwidth.burstTimeDownload || 1;
    rateLimit += ` ${timeRx}/${timeTx}`;
  }

  if (bandwidth.priority) {
    rateLimit += ` ${bandwidth.priority}`;
  }

  if (bandwidth.minLimitDownload || bandwidth.minLimitUpload) {
    const minRx = bandwidth.minLimitDownload || bandwidth.maxLimitDownload;
    const minTx = bandwidth.minLimitUpload || bandwidth.maxLimitUpload;
    rateLimit += ` ${minRx}/${minTx}`;
  }

  return rateLimit;
}

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
    const networkRepo = new NetworkRepository();
    const routerTenant = await networkRepo.findRouterTenantId(routerId);
    const { MikroTikRouterRepository } =
      await import("@/modules/network/repositories/MikroTikRouterRepository");
    const routerRepo = new MikroTikRouterRepository();
    const router = routerTenant
      ? await routerRepo.findById(routerId, routerTenant.tenantId!)
      : null;

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

      const profileParams: string[] = [];

      if (!profileData.name || profileData.name.trim() === "") {
        conn.close();
        return { success: false, error: "Nama profile tidak boleh kosong" };
      }
      profileParams.push(`=name=${profileData.name}`);

      if (!profileData.localAddress || profileData.localAddress.trim() === "") {
        conn.close();
        return { success: false, error: "Local address tidak boleh kosong" };
      }
      profileParams.push(`=local-address=${profileData.localAddress}`);

      if (!profileData.skipPoolCheck) {
        if (
          !profileData.remoteAddress ||
          profileData.remoteAddress.trim() === ""
        ) {
          conn.close();
          return {
            success: false,
            error: "Remote address (nama IP Pool) tidak boleh kosong",
          };
        }
        profileParams.push(`=remote-address=${profileData.remoteAddress}`);
      }

      const profileComment = `add by netmanager - ${profileData.name}`;
      profileParams.push(`=comment=${profileComment}`);

      if (profileData.dnsServer && profileData.dnsServer.trim() !== "") {
        profileParams.push(`=dns-server=${profileData.dnsServer}`);
      }

      if (profileData.sessionTimeout) {
        profileParams.push(`=session-timeout=${profileData.sessionTimeout}`);
      }

      if (profileData.idleTimeout) {
        profileParams.push(`=idle-timeout=${profileData.idleTimeout}`);
      }

      if (
        !profileData.skipRateLimit &&
        !profileData.skipPoolCheck &&
        profileData.rateLimit &&
        profileData.rateLimit.trim() !== ""
      ) {
        profileParams.push(`=rate-limit=${profileData.rateLimit}`);
      }

      const result = await conn.write("/ppp/profile/add", profileParams);

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
    const networkRepo = new NetworkRepository();
    const routerTenant = await networkRepo.findRouterTenantId(routerId);
    const { MikroTikRouterRepository } =
      await import("@/modules/network/repositories/MikroTikRouterRepository");
    const routerRepo = new MikroTikRouterRepository();
    const router = routerTenant
      ? await routerRepo.findById(routerId, routerTenant.tenantId!)
      : null;

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

      const updateParams: string[] = [];

      if (profileData.name !== undefined && profileData.name !== profileName) {
        updateParams.push(`=name=${profileData.name}`);
      }

      if (profileData.localAddress !== undefined) {
        updateParams.push(`=local-address=${profileData.localAddress}`);
      }

      if (profileData.skipPoolCheck) {
        updateParams.push("=remote-address=");
      } else if (profileData.remoteAddress !== undefined) {
        updateParams.push(`=remote-address=${profileData.remoteAddress}`);
      }

      const profileNameForComment =
        profileData.name && profileData.name !== profileName
          ? profileData.name
          : profileName;
      const profileComment = `add by netmanager - ${profileNameForComment}`;
      updateParams.push(`=comment=${profileComment}`);

      if (profileData.dnsServer !== undefined) {
        if (profileData.dnsServer && profileData.dnsServer.trim() !== "") {
          updateParams.push(`=dns-server=${profileData.dnsServer}`);
        } else {
          updateParams.push("=dns-server=");
        }
      }

      if (profileData.sessionTimeout !== undefined) {
        if (profileData.sessionTimeout) {
          updateParams.push(`=session-timeout=${profileData.sessionTimeout}`);
        } else {
          updateParams.push("=session-timeout=");
        }
      }

      if (profileData.idleTimeout !== undefined) {
        if (profileData.idleTimeout) {
          updateParams.push(`=idle-timeout=${profileData.idleTimeout}`);
        } else {
          updateParams.push("=idle-timeout=");
        }
      }

      if (profileData.skipRateLimit || profileData.skipPoolCheck) {
        updateParams.push("=rate-limit=");
      } else if (profileData.rateLimit !== undefined) {
        if (profileData.rateLimit && profileData.rateLimit.trim() !== "") {
          updateParams.push(`=rate-limit=${profileData.rateLimit}`);
        } else {
          updateParams.push("=rate-limit=");
        }
      }

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

async function deleteIPPool(
  conn: RouterOSAPI,
  poolName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const pools = await conn.write("/ip/pool/print", ["?name=" + poolName]);

    if (!pools || pools.length === 0 || !pools[0]) {
      return { success: true };
    }

    const pool = pools[0];
    const poolId = pool[".id"];
    const poolComment = pool["comment"] || "";

    const expectedComment = `add by netmanager - ${poolName}`;

    if (poolComment !== expectedComment) {
      return { success: true };
    }

    const _result = await conn.write("/ip/pool/remove", ["=.id=" + poolId]);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const verifyPools = await conn.write("/ip/pool/print", [
      "?name=" + poolName,
    ]);

    const firstPool = verifyPools?.[0];
    if (firstPool) {
      logger.warn(
        "[MikroTik IP Pool] WARNING: Pool masih ada setelah dihapus!",
      );
      const retryPoolId = firstPool[".id"];
      const retryPoolComment = firstPool["comment"] || "";
      const expectedComment = `add by netmanager - ${poolName}`;
      if (retryPoolComment === expectedComment) {
        await conn.write("/ip/pool/remove", ["=.id=" + retryPoolId]);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const verifyPools2 = await conn.write("/ip/pool/print", [
          "?name=" + poolName,
        ]);
        if (verifyPools2 && verifyPools2.length > 0) {
          logger.error(
            "[MikroTik IP Pool] ERROR: Pool masih ada setelah retry delete!",
          );
          return {
            success: false,
            error:
              "IP Pool tidak dapat dihapus dari MikroTik. Pastikan pool tidak sedang digunakan.",
          };
        }
      }
    }

    return { success: true };
  } catch (error) {
    logger.error("[MikroTik IP Pool] Error deleting pool:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || "Gagal menghapus IP Pool di MikroTik",
    };
  }
}

export async function deletePPPProfileInMikroTik(
  routerId: string,
  profileName: string,
  remoteAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const networkRepo = new NetworkRepository();
    const routerTenant = await networkRepo.findRouterTenantId(routerId);
    const { MikroTikRouterRepository } =
      await import("@/modules/network/repositories/MikroTikRouterRepository");
    const routerRepo = new MikroTikRouterRepository();
    const router = routerTenant
      ? await routerRepo.findById(routerId, routerTenant.tenantId!)
      : null;

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
          const poolResult = await deleteIPPool(conn, profileRemoteAddress);
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

      const profileToDelete = profiles[0];
      if (!profileToDelete) {
        conn.close();
        return { success: true };
      }
      const profileId = profileToDelete[".id"];

      const _result = await conn.write("/ppp/profile/remove", [
        "=.id=" + profileId,
      ]);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const verifyProfiles = await conn.write("/ppp/profile/print", [
        "?name=" + profileName,
      ]);
      if (verifyProfiles && verifyProfiles.length > 0) {
        logger.warn(
          "[MikroTik PPP] WARNING: Profile masih ada setelah dihapus!",
        );
        const retryProfile = verifyProfiles[0];
        if (!retryProfile) {
          logger.error("[MikroTik PPP] Error accessing retry profile");
          conn.close();
          return { success: false, error: "Error accessing profile for retry" };
        }
        const retryProfileId = retryProfile[".id"];
        await conn.write("/ppp/profile/remove", ["=.id=" + retryProfileId]);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const verifyProfiles2 = await conn.write("/ppp/profile/print", [
          "?name=" + profileName,
        ]);
        if (verifyProfiles2 && verifyProfiles2.length > 0) {
          logger.error(
            "[MikroTik PPP] ERROR: Profile masih ada setelah retry delete!",
          );
          conn.close();
          return {
            success: false,
            error:
              "Profile tidak dapat dihapus dari MikroTik. Pastikan profile tidak sedang digunakan oleh PPPoE client.",
          };
        }
      }

      if (profileRemoteAddress) {
        const poolResult = await deleteIPPool(conn, profileRemoteAddress);
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
