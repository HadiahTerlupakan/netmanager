import { logger } from "@/lib/logger";
import type { ProfilePPPSchema } from "@/lib/validations/profileppp";
import { isSuperAdmin } from "@/lib/auth";
import { canAccessSite } from "@/modules/roles";
import { RadiusRepository } from "../repositories/RadiusRepository";
import { HargaPaketRepository } from "../repositories/HargaPaketRepository";
import { RadiusSyncService } from "./radius-sync-service";
import * as z from "zod";
import { getIPPoolRanges } from "./mikrotik-ppp-profile";
import {
  applyRestrictedProfilePPPSite,
  validateProfilePPPBody,
} from "./profile-ppp-validation";
import {
  buildCreateProfilePPPData,
  buildUpdateProfilePPPData,
} from "./profile-ppp-prisma-data";
import {
  syncMikroTikProfileOnCreate,
  syncMikroTikProfileOnUpdate,
} from "./profile-ppp-mikrotik-sync";
import {
  syncRadiusProfileOnCreate,
  syncRadiusProfileOnUpdate,
} from "./profile-ppp-radius-sync";
import {
  buildDeleteBlockedMessage,
  cleanupProfileInMikroTik,
} from "./profile-ppp-delete";
import { mapProfilePPPRouteError } from "./profile-ppp-route-error";
export { mapProfilePPPRouteError } from "./profile-ppp-route-error";
import type {
  CreateProfilePPPInput,
  DeleteProfilePPPInput,
  DeleteProfilePPPRecord,
  DeleteProfilePPPResult,
  ProfilePPPDetailRecord,
  ProfilePPPRecord,
  ProfilePPPRepository,
  SessionContext,
  UpdateProfilePPPInput,
} from "./profile-ppp.types";

export class ProfilePPPService {
  constructor(
    private readonly hargaPaketRepository: ProfilePPPRepository = new HargaPaketRepository(),
    private readonly radiusRepository: RadiusRepository = new RadiusRepository(),
  ) {}

  private async getRadiusSyncService(): Promise<RadiusSyncService> {
    return new RadiusSyncService();
  }

  private async findProfileForUpdate(
    id: string,
  ): Promise<ProfilePPPRecord | null> {
    return this.hargaPaketRepository.findProfilePppForUpdate(id);
  }

  private async findProfileForDelete(
    id: string,
  ): Promise<DeleteProfilePPPRecord | null> {
    return this.hargaPaketRepository.findProfilePppForDelete(id);
  }

  toProfilePPPRouteError(error: unknown) {
    return mapProfilePPPRouteError(error);
  }

  async listProfilePPPs(input: {
    status?: string | null;
    siteId?: string | null;
    restriction: { isRestricted: boolean; siteIds: string[] };
  }) {
    return this.hargaPaketRepository.findProfilePpps({
      status: input.status || undefined,
      siteIds: input.restriction.isRestricted
        ? input.restriction.siteIds
        : undefined,
      siteId: input.restriction.isRestricted
        ? undefined
        : input.siteId || undefined,
    });
  }

  async getProfilePPPDetail(id: string) {
    const profile = await this.hargaPaketRepository.findProfilePppDetail(id);
    if (!profile) {
      return null;
    }

    return {
      ...profile,
      ipRange: await this.resolveProfileIpRange(profile),
    };
  }

  private async resolveProfileIpRange(profile: ProfilePPPDetailRecord) {
    if (!profile.mikroTikRouterId || !profile.mikroTikRouter) {
      return null;
    }

    try {
      const result = await getIPPoolRanges(
        profile.mikroTikRouterId,
        profile.remoteAddress,
      );
      return result.success ? result.ranges || null : null;
    } catch (error) {
      logger.error("[API ProfilePPP] Error getting IP Pool ranges:", error);
      return null;
    }
  }

  async createProfilePPPFromRequest(input: CreateProfilePPPInput) {
    const validation = validateProfilePPPBody(input.body);
    if (!validation.success) {
      return {
        success: false as const,
        status: 400,
        error: "Validasi gagal",
        details: z.flattenError(validation.error),
      };
    }

    const data = applyRestrictedProfilePPPSite(input.session, validation.data);

    return {
      success: true as const,
      profilePPP: await this.createProfilePPP(input.sessionContext, data),
    };
  }

  async createProfilePPP(session: SessionContext, data: ProfilePPPSchema) {
    await import("@/lib/logger").then(({ logger }) => {
      logger.info("Creating Profile PPP", {
        userId: session.user.id,
        siteId: data.siteId,
        name: data.name,
      });
    });

    const profilePPP = await this.hargaPaketRepository.createProfilePpp(
      buildCreateProfilePPPData(data),
    );

    await syncRadiusProfileOnCreate({
      radiusRepository: this.radiusRepository,
      getRadiusSyncService: () => this.getRadiusSyncService(),
      session,
      profilePPP,
      data,
    });
    await syncMikroTikProfileOnCreate({
      repository: this.hargaPaketRepository,
      getRadiusSyncService: () => this.getRadiusSyncService(),
      profilePPP,
      data,
      bandwidthId: data.bandwidthId,
    });

    return profilePPP;
  }

  async updateProfilePPPFromRequest(input: UpdateProfilePPPInput) {
    const oldProfile = await this.findProfileForUpdate(input.id);
    if (!oldProfile) {
      return {
        success: false as const,
        status: 404,
        error: "Profile PPP tidak ditemukan",
      };
    }

    const validation = validateProfilePPPBody(input.body);
    if (!validation.success) {
      return {
        success: false as const,
        status: 400,
        error: "Validasi gagal",
        details: z.flattenError(validation.error),
      };
    }

    const data = applyRestrictedProfilePPPSite(input.session, validation.data);

    return {
      success: true as const,
      profilePPP: await this.updateProfilePPP(
        input.sessionContext,
        input.id,
        oldProfile,
        data,
      ),
    };
  }

  async updateProfilePPP(
    session: SessionContext,
    id: string,
    oldProfile: ProfilePPPRecord,
    data: ProfilePPPSchema,
  ) {
    const profilePPP = await this.hargaPaketRepository.updateProfilePpp(
      id,
      buildUpdateProfilePPPData(data),
    );

    await syncRadiusProfileOnUpdate({
      radiusRepository: this.radiusRepository,
      getRadiusSyncService: () => this.getRadiusSyncService(),
      session,
      oldProfile,
      profilePPP,
      data,
    });
    await syncMikroTikProfileOnUpdate({
      repository: this.hargaPaketRepository,
      getRadiusSyncService: () => this.getRadiusSyncService(),
      oldProfile,
      profilePPP,
      data,
      bandwidthId: data.bandwidthId,
    });

    return profilePPP;
  }

  async deleteProfilePPPFromRequest(
    input: DeleteProfilePPPInput,
  ): Promise<DeleteProfilePPPResult> {
    if (!input.session?.user) {
      return {
        success: false,
        status: 401,
        error: "Autentikasi diperlukan",
      };
    }

    const permissions = input.session.user.permissions || [];
    if (
      !isSuperAdmin(input.session.user) &&
      !permissions.includes("profileppp:delete")
    ) {
      return {
        success: false,
        status: 403,
        error: "Akses ditolak",
      };
    }

    const profile = await this.findProfileForDelete(input.id);
    if (!profile) {
      return {
        success: false,
        status: 404,
        error: "Profile PPP tidak ditemukan",
      };
    }

    if (!canAccessSite(input.session, "profileppp", profile.siteId)) {
      return {
        success: false,
        status: 403,
        error: "Anda tidak memiliki akses ke profile PPP di site ini",
      };
    }

    if (profile.hargaPaket.length > 0) {
      return {
        success: false,
        status: 400,
        error: buildDeleteBlockedMessage(profile),
      };
    }

    const cleanupError = await cleanupProfileInMikroTik(profile);
    if (cleanupError) {
      return cleanupError;
    }

    await this.hargaPaketRepository.deleteProfilePpp(input.id);

    return {
      success: true,
      message: "Profile PPP berhasil dihapus",
    };
  }
}

export default ProfilePPPService;
