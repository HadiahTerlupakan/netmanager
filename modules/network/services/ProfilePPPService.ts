import { randomUUID } from "crypto";
import { prisma } from "@/modules/database";
import { type ProfilePPPSchema } from "@/lib/validations/profileppp";
import { RadiusRepository } from "../repositories/RadiusRepository";
import { RadiusSyncService } from "./radius-sync-service";
import {
  createPPPProfileInMikroTik,
  getRateLimitFromBandwidth,
  updatePPPProfileInMikroTik,
} from "./mikrotik-ppp-profile";

interface SessionContext {
  user: {
    id: string;
    tenantId?: string;
  };
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

export class ProfilePPPService {
  private async getRadiusSyncService(): Promise<RadiusSyncService> {
    return new RadiusSyncService();
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
        const activeRouters = await prisma.mikroTikRouter.findMany({
          where: {
            OR: [
              { tenantId: profilePPP.tenantId },
              { siteId: profilePPP.siteId },
            ],
          },
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
        const activeRouters = await prisma.mikroTikRouter.findMany({
          where: {
            OR: [
              { tenantId: profilePPP.tenantId },
              { siteId: profilePPP.siteId },
            ],
          },
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

  async createProfilePPP(session: SessionContext, data: ProfilePPPSchema) {
    await import("@/lib/logger").then(({ logger }) => {
      logger.info("Creating Profile PPP", {
        userId: session.user.id,
        siteId: data.siteId,
        name: data.name,
      });
    });

    const profilePPP = await prisma.profilePPP.create({
      data: this.buildCreatePrismaData(data),
      include: {
        mikroTikRouter: true,
      },
    });

    await this.syncRadiusOnCreate(session, profilePPP, data);
    await this.syncMikroTikOnCreate(profilePPP, data, data.bandwidthId);

    return profilePPP;
  }

  async updateProfilePPP(
    session: SessionContext,
    id: string,
    oldProfile: ProfilePPPRecord,
    data: ProfilePPPSchema,
  ) {
    const profilePPP = await prisma.profilePPP.update({
      where: { id },
      data: this.buildUpdatePrismaData(data),
      include: {
        mikroTikRouter: true,
      },
    });

    await this.syncRadiusOnUpdate(session, oldProfile, profilePPP, data);
    await this.syncMikroTikOnUpdate(
      oldProfile,
      profilePPP,
      data,
      data.bandwidthId,
    );

    return profilePPP;
  }
}

export default ProfilePPPService;
