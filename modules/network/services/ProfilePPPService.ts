import { randomUUID } from "crypto";
import type { Session } from "next-auth";
import {
  profilePPPSchema,
  type ProfilePPPSchema,
} from "@/lib/validations/profileppp";
import { sanitizeInput } from "@/lib/utils/sanitize";
import { isSuperAdmin } from "@/lib/auth";
import { canAccessSite, checkSiteRestriction } from "@/modules/roles";
import { RadiusRepository } from "../repositories/RadiusRepository";
import { HargaPaketRepository } from "../repositories/HargaPaketRepository";
import { RadiusSyncService } from "./radius-sync-service";
import * as z from "zod";
import {
  createPPPProfileInMikroTik,
  deletePPPProfileInMikroTik,
  getRateLimitFromBandwidth,
  updatePPPProfileInMikroTik,
} from "./mikrotik-ppp-profile";

interface SessionContext {
  user: {
    id: string;
    tenantId?: string;
  };
}

interface CreateProfilePPPInput {
  session: Session | null;
  sessionContext: SessionContext;
  body: Record<string, unknown>;
}

interface UpdateProfilePPPInput {
  session: Session | null;
  sessionContext: SessionContext;
  id: string;
  body: Record<string, unknown>;
}

interface DeleteProfilePPPInput {
  session: Session | null;
  id: string;
}

interface ProfilePPPRepository {
  findProfilePpps(input: ProfilePPPListRepositoryInput): Promise<unknown[]>;
  findProfilePppDetail(id: string): Promise<ProfilePPPDetailRecord | null>;
  findProfilePppForUpdate(id: string): Promise<ProfilePPPRecord | null>;
  findProfilePppForDelete(id: string): Promise<DeleteProfilePPPRecord | null>;
  createProfilePpp(data: Record<string, unknown>): Promise<ProfilePPPRecord>;
  updateProfilePpp(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ProfilePPPRecord>;
  deleteProfilePpp(id: string): Promise<void>;
  findRoutersForProfileBroadcast(input: {
    tenantId?: string | null;
    siteId?: string | null;
  }): Promise<Array<{ id: string; name: string }>>;
}

interface ProfilePPPListRepositoryInput {
  status?: string;
  siteIds?: string[];
  siteId?: string;
}

interface ProfilePPPDetailRecord {
  id: string;
  remoteAddress: string;
  mikroTikRouterId: string | null;
  mikroTikRouter?: {
    id: string;
    name: string;
  } | null;
}

interface ProfilePPPRecord {
  id: string;
  name: string;
  localAddress: string;
  remoteAddress: string;
  dnsServer: string | null;
  sessionTimeout: number | null;
  idleTimeout: number | null;
  poolMode: string | null;
  description: string | null;
  status: string;
  siteId: string | null;
  mikroTikRouterId: string | null;
  tenantId?: string | null;
  mikroTikRouter?: {
    id: string;
    name: string;
  } | null;
}

interface DeleteProfilePPPRecord {
  id: string;
  name: string;
  remoteAddress: string;
  siteId: string | null;
  mikroTikRouterId: string | null;
  mikroTikRouter: {
    id: string;
    name: string;
  } | null;
  hargaPaket: Array<{
    id: string;
    name: string;
  }>;
}

type DeleteProfilePPPResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      status: number;
      error: string;
    };

export class ProfilePPPService {
  constructor(
    private readonly hargaPaketRepository: ProfilePPPRepository = new HargaPaketRepository(),
  ) {}

  private async getRadiusSyncService(): Promise<RadiusSyncService> {
    return new RadiusSyncService();
  }

  private sanitizeProfilePPPBody(body: Record<string, unknown>) {
    return {
      name:
        typeof body.name === "string" ? sanitizeInput(body.name) : undefined,
      localAddress:
        typeof body.localAddress === "string"
          ? sanitizeInput(body.localAddress)
          : undefined,
      remoteAddress:
        typeof body.remoteAddress === "string"
          ? sanitizeInput(body.remoteAddress)
          : undefined,
      ipRange:
        typeof body.ipRange === "string" && body.ipRange.trim()
          ? sanitizeInput(body.ipRange)
          : undefined,
      dnsServer:
        typeof body.dnsServer === "string" && body.dnsServer.trim()
          ? sanitizeInput(body.dnsServer)
          : undefined,
      sessionTimeout:
        body.sessionTimeout !== undefined &&
        body.sessionTimeout !== null &&
        body.sessionTimeout !== ""
          ? Number(body.sessionTimeout)
          : undefined,
      idleTimeout:
        body.idleTimeout !== undefined &&
        body.idleTimeout !== null &&
        body.idleTimeout !== ""
          ? Number(body.idleTimeout)
          : undefined,
      poolMode:
        typeof body.poolMode === "string" && body.poolMode
          ? body.poolMode
          : "MIKROTIK",
      mikroTikRouterId:
        typeof body.mikroTikRouterId === "string" &&
        body.mikroTikRouterId.trim()
          ? body.mikroTikRouterId
          : undefined,
      bandwidthId:
        typeof body.bandwidthId === "string" && body.bandwidthId.trim()
          ? body.bandwidthId
          : undefined,
      description:
        typeof body.description === "string" && body.description.trim()
          ? sanitizeInput(body.description)
          : undefined,
      status:
        typeof body.status === "string" && body.status ? body.status : "AKTIF",
      siteId:
        typeof body.siteId === "string" && body.siteId.trim()
          ? body.siteId
          : undefined,
    };
  }

  private validateProfilePPPBody(body: Record<string, unknown>) {
    return profilePPPSchema.safeParse(this.sanitizeProfilePPPBody(body));
  }

  private applyRestrictedSite(
    session: Session | null,
    data: ProfilePPPSchema,
  ): ProfilePPPSchema {
    const { isRestricted, primarySiteId } = checkSiteRestriction(
      session,
      "profileppp",
    );

    if (!isRestricted || !primarySiteId) {
      return data;
    }

    return {
      ...data,
      siteId: primarySiteId,
    };
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

  private buildDeleteBlockedMessage(profile: DeleteProfilePPPRecord): string {
    const paketNames = profile.hargaPaket
      .slice(0, 3)
      .map((paket) => paket.name)
      .join(", ");
    const moreCount =
      profile.hargaPaket.length > 3
        ? ` dan ${profile.hargaPaket.length - 3} lainnya`
        : "";

    return `Profile PPP "${profile.name}" tidak dapat dihapus karena masih digunakan oleh ${profile.hargaPaket.length} paket (${paketNames}${moreCount}). Hapus atau ubah profile pada paket tersebut terlebih dahulu.`;
  }

  private async cleanupProfileInMikroTik(
    profile: DeleteProfilePPPRecord,
  ): Promise<DeleteProfilePPPResult | null> {
    if (!profile.mikroTikRouterId) {
      return null;
    }

    try {
      const result = await deletePPPProfileInMikroTik(
        profile.mikroTikRouterId,
        profile.name,
        profile.remoteAddress,
      );

      if (result.success) {
        return null;
      }

      return {
        success: false,
        status: 502,
        error: result.error || "Gagal menghapus profile PPP di MikroTik",
      };
    } catch (error: unknown) {
      return {
        success: false,
        status: 502,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menghapus profile PPP di MikroTik",
      };
    }
  }

  private buildCreatePrismaData(data: ProfilePPPSchema) {
    return {
      id: randomUUID(),
      name: data.name,
      localAddress: data.localAddress,
      remoteAddress: data.remoteAddress,
      dnsServer: data.dnsServer || null,
      sessionTimeout: data.sessionTimeout || null,
      idleTimeout: data.idleTimeout || null,
      poolMode: data.poolMode,
      description: data.description || null,
      status: data.status,
      siteId: data.siteId || null,
      mikroTikRouterId: data.mikroTikRouterId || null,
      updatedAt: new Date(),
    };
  }

  private buildUpdatePrismaData(data: ProfilePPPSchema) {
    return {
      name: data.name,
      localAddress: data.localAddress,
      remoteAddress: data.remoteAddress,
      dnsServer: data.dnsServer !== undefined ? data.dnsServer : null,
      sessionTimeout:
        data.sessionTimeout !== undefined ? data.sessionTimeout : null,
      idleTimeout: data.idleTimeout !== undefined ? data.idleTimeout : null,
      poolMode: data.poolMode,
      description: data.description !== undefined ? data.description : null,
      status: data.status,
      mikroTikRouterId:
        data.mikroTikRouterId !== undefined ? data.mikroTikRouterId : null,
      updatedAt: new Date(),
    };
  }

  private async syncRadiusOnCreate(
    session: SessionContext,
    profilePPP: ProfilePPPRecord,
    data: ProfilePPPSchema,
  ): Promise<void> {
    try {
      const radiusSync = await this.getRadiusSyncService();
      const mode = await radiusSync.getConnectionMode();
      if (mode !== "RADIUS") {
        return;
      }

      const radiusRepo = new RadiusRepository();
      await radiusRepo.syncProfileToRadius(profilePPP.id);

      if (profilePPP.poolMode === "RADIUS" && data.ipRange) {
        const tenantId = profilePPP.tenantId || session.user.tenantId;
        if (tenantId) {
          await radiusRepo.syncIpPoolToRadius(
            profilePPP.remoteAddress,
            data.ipRange,
            tenantId,
          );
        }
      }
    } catch (error) {
      console.error(
        "[API ProfilePPP] RADIUS sync error during creation:",
        error,
      );
    }
  }

  private async syncRadiusOnUpdate(
    session: SessionContext,
    oldProfile: ProfilePPPRecord,
    profilePPP: ProfilePPPRecord,
    data: ProfilePPPSchema,
  ): Promise<void> {
    try {
      const radiusSync = await this.getRadiusSyncService();
      const mode = await radiusSync.getConnectionMode();
      if (mode !== "RADIUS") {
        return;
      }

      const radiusRepo = new RadiusRepository();
      await radiusRepo.syncProfileToRadius(profilePPP.id);

      if (oldProfile.poolMode === "RADIUS" && oldProfile.remoteAddress) {
        if (
          profilePPP.poolMode !== "RADIUS" ||
          oldProfile.remoteAddress !== profilePPP.remoteAddress
        ) {
          const tenantId = oldProfile.tenantId || session.user.tenantId;
          if (tenantId) {
            await radiusRepo.syncIpPoolToRadius(
              oldProfile.remoteAddress,
              "",
              tenantId,
            );
          }
        }
      }

      if (profilePPP.poolMode === "RADIUS" && data.ipRange) {
        const tenantId = profilePPP.tenantId || session.user.tenantId;
        if (tenantId) {
          await radiusRepo.syncIpPoolToRadius(
            profilePPP.remoteAddress,
            data.ipRange,
            tenantId,
          );
        }
      }
    } catch (error) {
      console.error("[API ProfilePPP] RADIUS sync error during update:", error);
    }
  }

  private async syncMikroTikOnCreate(
    profilePPP: ProfilePPPRecord,
    data: ProfilePPPSchema,
    bandwidthId?: string | null,
  ): Promise<void> {
    try {
      const radiusSync = await this.getRadiusSyncService();
      const connectionMode = await radiusSync.getConnectionMode();
      const isRadiusMode = connectionMode === "RADIUS";

      if (isRadiusMode) {
        const activeRouters =
          await this.hargaPaketRepository.findRoutersForProfileBroadcast({
            tenantId: profilePPP.tenantId,
            siteId: profilePPP.siteId,
          });

        for (const router of activeRouters) {
          try {
            const isRadiusPool = data.poolMode === "RADIUS";
            const profilePPPDataForMikrotik = {
              name: data.name,
              localAddress: data.localAddress,
              remoteAddress: data.remoteAddress,
              ...(!isRadiusPool && data.ipRange && { ipRange: data.ipRange }),
              ...(data.dnsServer && { dnsServer: data.dnsServer }),
              ...(data.sessionTimeout && {
                sessionTimeout: data.sessionTimeout,
              }),
              ...(data.idleTimeout && { idleTimeout: data.idleTimeout }),
              skipPoolCheck: isRadiusPool,
              skipRateLimit: true,
            };

            await createPPPProfileInMikroTik(
              router.id,
              profilePPPDataForMikrotik,
            );
          } catch (routerErr) {
            console.error(
              `[API ProfilePPP] Failed to create profile in router ${router.name}:`,
              routerErr,
            );
          }
        }

        return;
      }

      if (data.mikroTikRouterId && profilePPP.mikroTikRouter) {
        const rateLimit = await getRateLimitFromBandwidth(
          profilePPP.id,
          bandwidthId,
        );
        const profilePPPDataForMikrotik = {
          name: data.name,
          localAddress: data.localAddress,
          remoteAddress: data.remoteAddress,
          ...(data.ipRange && { ipRange: data.ipRange }),
          ...(data.dnsServer && { dnsServer: data.dnsServer }),
          ...(data.sessionTimeout && { sessionTimeout: data.sessionTimeout }),
          ...(data.idleTimeout && { idleTimeout: data.idleTimeout }),
          ...(rateLimit && { rateLimit }),
          skipPoolCheck: false,
        };

        await createPPPProfileInMikroTik(
          data.mikroTikRouterId,
          profilePPPDataForMikrotik,
        );
      }
    } catch (syncError) {
      console.error(
        "[API ProfilePPP] Error during MikroTik profile broadcast (POST):",
        syncError,
      );
    }
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

  async getProfilePPPDetail(input: {
    id: string;
    getIPPoolRanges: (
      routerId: string,
      remoteAddress: string,
    ) => Promise<{ success: boolean; ranges?: string | null }>;
  }) {
    const profile = await this.hargaPaketRepository.findProfilePppDetail(
      input.id,
    );
    if (!profile) {
      return null;
    }

    return {
      ...profile,
      ipRange: await this.resolveProfileIpRange(profile, input.getIPPoolRanges),
    };
  }

  private async resolveProfileIpRange(
    profile: ProfilePPPDetailRecord,
    getIPPoolRanges: (
      routerId: string,
      remoteAddress: string,
    ) => Promise<{ success: boolean; ranges?: string | null }>,
  ) {
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
      console.error("[API ProfilePPP] Error getting IP Pool ranges:", error);
      return null;
    }
  }

  private async syncMikroTikOnUpdate(
    oldProfile: ProfilePPPRecord,
    profilePPP: ProfilePPPRecord,
    data: ProfilePPPSchema,
    bandwidthId?: string | null,
  ): Promise<void> {
    try {
      const radiusSync = await this.getRadiusSyncService();
      const connectionMode = await radiusSync.getConnectionMode();
      const isRadiusMode = connectionMode === "RADIUS";

      if (isRadiusMode) {
        const activeRouters =
          await this.hargaPaketRepository.findRoutersForProfileBroadcast({
            tenantId: profilePPP.tenantId,
            siteId: profilePPP.siteId,
          });

        for (const router of activeRouters) {
          try {
            const isRadiusPool = data.poolMode === "RADIUS";
            const profilePPPDataForMikrotik = {
              name: data.name,
              localAddress: data.localAddress,
              remoteAddress: data.remoteAddress,
              ...(!isRadiusPool && data.ipRange && { ipRange: data.ipRange }),
              ...(data.dnsServer && { dnsServer: data.dnsServer }),
              ...(data.sessionTimeout && {
                sessionTimeout: data.sessionTimeout,
              }),
              ...(data.idleTimeout && { idleTimeout: data.idleTimeout }),
              skipPoolCheck: isRadiusPool,
              skipRateLimit: true,
            };

            await updatePPPProfileInMikroTik(
              router.id,
              oldProfile.name,
              profilePPPDataForMikrotik,
            );
          } catch (routerErr) {
            console.error(
              `[API ProfilePPP] Failed to update profile in router ${router.name}:`,
              routerErr,
            );
          }
        }

        return;
      }

      if (data.mikroTikRouterId && profilePPP.mikroTikRouter) {
        const rateLimit = await getRateLimitFromBandwidth(
          profilePPP.id,
          bandwidthId,
        );
        const profilePPPDataForMikrotik = {
          name: data.name,
          localAddress: data.localAddress,
          remoteAddress: data.remoteAddress,
          ...(data.ipRange && { ipRange: data.ipRange }),
          ...(data.dnsServer && { dnsServer: data.dnsServer }),
          ...(data.sessionTimeout && { sessionTimeout: data.sessionTimeout }),
          ...(data.idleTimeout && { idleTimeout: data.idleTimeout }),
          ...(rateLimit && { rateLimit }),
          skipPoolCheck: false,
        };

        await updatePPPProfileInMikroTik(
          data.mikroTikRouterId,
          oldProfile.name,
          profilePPPDataForMikrotik,
        );
      }
    } catch (syncError) {
      console.error(
        "[API ProfilePPP] Error during MikroTik profile broadcast:",
        syncError,
      );
    }
  }

  async createProfilePPPFromRequest(input: CreateProfilePPPInput) {
    const validation = this.validateProfilePPPBody(input.body);
    if (!validation.success) {
      return {
        success: false as const,
        status: 400,
        error: "Validasi gagal",
        details: z.flattenError(validation.error),
      };
    }

    const data = this.applyRestrictedSite(input.session, validation.data);

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
      this.buildCreatePrismaData(data),
    );

    await this.syncRadiusOnCreate(session, profilePPP, data);
    await this.syncMikroTikOnCreate(profilePPP, data, data.bandwidthId);

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

    const validation = this.validateProfilePPPBody(input.body);
    if (!validation.success) {
      return {
        success: false as const,
        status: 400,
        error: "Validasi gagal",
        details: z.flattenError(validation.error),
      };
    }

    const data = this.applyRestrictedSite(input.session, validation.data);

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
      this.buildUpdatePrismaData(data),
    );

    await this.syncRadiusOnUpdate(session, oldProfile, profilePPP, data);
    await this.syncMikroTikOnUpdate(
      oldProfile,
      profilePPP,
      data,
      data.bandwidthId,
    );

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
        error: this.buildDeleteBlockedMessage(profile),
      };
    }

    const cleanupError = await this.cleanupProfileInMikroTik(profile);
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
