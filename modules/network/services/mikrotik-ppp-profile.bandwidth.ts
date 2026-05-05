import { logger } from "@/lib/logger";

import { NetworkRepository } from "../repositories/NetworkRepository";
import { RadiusConnectionError } from "../utils/errors";
import { formatRateLimitFromBandwidth } from "./mikrotik/ppp-rate-limit";

export async function getRateLimitFromBandwidth(
  profilePPPId: string,
  bandwidthId?: string | null,
): Promise<string | null> {
  try {
    const networkRepo = new NetworkRepository();

    if (bandwidthId) {
      const bandwidth = await networkRepo.findBandwidthById(bandwidthId);
      return bandwidth ? formatRateLimitFromBandwidth(bandwidth) : null;
    }

    const profilePPP =
      await networkRepo.findProfilePPPWithHargaPaket(profilePPPId);
    const hargaPaket =
      profilePPP?.hargaPaket?.find((item) => item.status === "AKTIF") ??
      profilePPP?.hargaPaket?.[0];

    if (!hargaPaket?.bandwidth) {
      return null;
    }

    return formatRateLimitFromBandwidth(hargaPaket.bandwidth);
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
