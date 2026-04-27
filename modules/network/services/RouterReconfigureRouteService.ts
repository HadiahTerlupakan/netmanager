import { prisma } from "@/lib/prisma";
import { MikroTikProvisioningService } from "./MikroTikProvisioningService";
import {
  MikroTikRouterService,
  RouterAccessDeniedError,
} from "./MikroTikRouterService";

const DEFAULT_RADIUS_SECRET = "testing123";
const SETTINGS_KEYS = [
  "RADIUS_SECRET",
  "ISOLIR_URL",
  "MIKROTIK_API_URL",
] as const;

interface RouterCredentialsInput {
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated?: string | null;
  apiPasswordGenerated?: string | null;
}

interface ReconfigureContext {
  tenantId?: string;
  userId: string;
  role?: string;
  restrictedToOwnSite: boolean;
}

/** Service untuk kebutuhan route reconfigure router MikroTik. */
export class RouterReconfigureRouteService {
  constructor(
    private readonly provisioningService: MikroTikProvisioningService = new MikroTikProvisioningService(),
    private readonly routerService: MikroTikRouterService = new MikroTikRouterService(),
  ) {}

  /** Reconfigure router yang dipilih dan kembalikan hasil per router. */
  async reconfigureRouters(routerIds: string[], context: ReconfigureContext) {
    const settings = await this.getSettings();
    const routers = await this.getAuthorizedRouters(routerIds, context);
    const results = await this.reconfigureAuthorizedRouters(
      routers,
      settings.radiusSecret,
      settings.isolirUrl,
    );
    const successCount = results.filter((item) => item.success).length;
    return this.buildResponse(results, routers.length, successCount);
  }

  private async getSettings() {
    const settings = await prisma.settings.findMany({
      where: { key: { in: [...SETTINGS_KEYS] } },
    });
    return {
      radiusSecret:
        settings.find((item) => item.key === "RADIUS_SECRET")?.value ||
        DEFAULT_RADIUS_SECRET,
      isolirUrl: settings.find((item) => item.key === "ISOLIR_URL")?.value,
    };
  }

  private async getAuthorizedRouters(
    routerIds: string[],
    context: ReconfigureContext,
  ) {
    let hasDeniedRouter = false;
    const routers = await Promise.all(
      routerIds.map(async (routerId) => {
        try {
          const router = await this.routerService.getRouterById({
            id: routerId,
            tenantId: context.tenantId || "",
            userId: context.userId,
            restrictedToOwnSite: context.restrictedToOwnSite,
          });
          return router.pingStatus === "online" ? router : null;
        } catch (error) {
          if (error instanceof RouterAccessDeniedError) hasDeniedRouter = true;
          return null;
        }
      }),
    );

    if (hasDeniedRouter) throw new Error("FORBIDDEN:Akses ditolak");
    return routers.filter(
      (router): router is NonNullable<(typeof routers)[number]> =>
        Boolean(router),
    );
  }

  private async reconfigureAuthorizedRouters(
    routers: Array<{
      id: string;
      name: string;
      ipAddress: string;
      apiPort: number;
      apiUsername: string;
      apiPassword: string;
      apiUsernameGenerated?: string | null;
      apiPasswordGenerated?: string | null;
    }>,
    radiusSecret: string,
    isolirUrl?: string,
  ) {
    const results = [];
    for (const router of routers) {
      results.push(
        await this.reconfigureSingleRouter(router, radiusSecret, isolirUrl),
      );
    }
    return results;
  }

  private async reconfigureSingleRouter(
    router: {
      id: string;
      name: string;
      ipAddress: string;
      apiPort: number;
      apiUsername: string;
      apiPassword: string;
      apiUsernameGenerated?: string | null;
      apiPasswordGenerated?: string | null;
    },
    radiusSecret: string,
    isolirUrl?: string,
  ) {
    try {
      const credentials = this.getRouterCredentials(router);
      const result = await this.provisioningService.provisionRadius(
        {
          ip: router.ipAddress,
          port: router.apiPort,
          username: credentials.username,
          password: credentials.password,
        },
        null,
        radiusSecret,
        isolirUrl,
      );
      return this.buildRouterResult(
        router,
        result.success,
        result.logs,
        result.success ? null : "Provisioning failed",
      );
    } catch (error) {
      return this.buildRouterResult(
        router,
        false,
        [],
        error instanceof Error ? error.message : "Terjadi kesalahan",
      );
    }
  }

  private getRouterCredentials(router: RouterCredentialsInput) {
    return {
      username: router.apiUsernameGenerated || router.apiUsername,
      password: router.apiPasswordGenerated || router.apiPassword,
    };
  }

  private buildRouterResult(
    router: { id: string; name: string },
    success: boolean,
    logs: string[],
    error: string | null,
  ) {
    return { id: router.id, name: router.name, success, logs, error };
  }

  private buildResponse(
    results: unknown[],
    total: number,
    successCount: number,
  ) {
    if (total === 0) {
      throw new Error("NOT_FOUND:No valid routers found among selection");
    }

    return {
      success: true,
      message: `Reconfiguration completed. ${successCount}/${total} successful.`,
      results,
    };
  }
}
