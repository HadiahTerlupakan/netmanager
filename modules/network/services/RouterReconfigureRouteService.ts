import {
  NetworkRepository,
  type RouterReconfigureRecord,
} from "../repositories/NetworkRepository";
import { MikroTikProvisioningService } from "./MikroTikProvisioningService";
import {
  MikroTikRouterService,
  RouterAccessDeniedError,
} from "./MikroTikRouterService";
import {
  getRadiusDefaultPorts,
  getRouterReconfigureSettings,
} from "./radius-runtime.helpers";
import { resolveRadiusRouting } from "./mikrotik-router.provisioning";
import {
  buildIsolirPageSync,
  recordIsolirPageSync,
  tryResolveIsolirProvisioning,
  type IsolirProvisioning,
} from "../isolir/isolir-provisioning";
import { getRouterCredentials } from "./router-credentials";

const FORBIDDEN_ERROR = "FORBIDDEN:Akses ditolak";
const NOT_FOUND_ERROR = "NOT_FOUND:No valid routers found among selection";
const PROVISIONING_FAILED_MESSAGE = "Provisioning failed";

interface ReconfigureContext {
  tenantId?: string;
  userId: string;
  role?: string;
  restrictedToOwnSite: boolean;
}

interface RouterSettings {
  radiusSecret: string;
}

interface RouterReconfigureResult {
  id: string;
  name: string;
  success: boolean;
  logs: string[];
  error: string | null;
}

// Port RADIUS sama dengan saat router ditambahkan: kembali ke 1812/1813
// bawaan service membuat router yang RADIUS-nya di port lain timeout di
// setiap login setelah reconfigure. Router VPN juga memakai alamat core dan
// IP tunnel-nya sebagai src-address. Isolir mengikuti mode dan URL milik
// router sendiri, supaya hasilnya sama dengan saat router ditambahkan dan
// tidak berubah karena setting global ISOLIR_URL.
function buildProvisionRadiusArgs(
  router: RouterReconfigureRecord,
  settings: RouterSettings,
  isolir: IsolirProvisioning | null,
): Parameters<MikroTikProvisioningService["provisionRadius"]> {
  const credentials = getRouterCredentials(router);
  const connection = {
    ip: router.ipAddress,
    port: router.apiPort,
    username: credentials.username,
    password: credentials.password,
  };
  const { radiusServerIp, srcAddress } = resolveRadiusRouting(router);
  const { authPort, accountingPort } = getRadiusDefaultPorts();
  return [
    connection,
    radiusServerIp,
    settings.radiusSecret,
    isolir,
    authPort,
    accountingPort,
    srcAddress ?? undefined,
  ];
}

function buildRouterResult(
  router: Pick<RouterReconfigureRecord, "id" | "name">,
  success: boolean,
  logs: string[],
  error: string | null,
): RouterReconfigureResult {
  return { id: router.id, name: router.name, success, logs, error };
}

/** Service untuk kebutuhan route reconfigure router MikroTik. */
export class RouterReconfigureRouteService {
  constructor(
    private readonly provisioningService: MikroTikProvisioningService = new MikroTikProvisioningService(),
    private readonly routerService: MikroTikRouterService = new MikroTikRouterService(),
    private readonly networkRepository: NetworkRepository = new NetworkRepository(),
  ) {}

  /** Reconfigure router yang dipilih dan kembalikan hasil per router. */
  async reconfigureRouters(routerIds: string[], context: ReconfigureContext) {
    const settings = await this.getSettings();
    const routers = await this.getAuthorizedRouters(routerIds, context);
    const results = await this.reconfigureAuthorizedRouters(routers, settings);
    const successCount = results.filter((item) => item.success).length;

    if (routers.length === 0) {
      throw new Error(NOT_FOUND_ERROR);
    }

    return {
      success: true,
      message: `Reconfiguration completed. ${successCount}/${routers.length} successful.`,
      results,
    };
  }

  private async getSettings(): Promise<RouterSettings> {
    return getRouterReconfigureSettings(this.networkRepository);
  }

  private async getAuthorizedRouters(
    routerIds: string[],
    context: ReconfigureContext,
  ): Promise<RouterReconfigureRecord[]> {
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

          const reconfigureRouter =
            await this.networkRepository.findRouterForReconfigure(
              router.id,
              context.tenantId || "",
            );

          return reconfigureRouter?.pingStatus === "online"
            ? reconfigureRouter
            : null;
        } catch (error) {
          if (error instanceof RouterAccessDeniedError) {
            hasDeniedRouter = true;
          }

          return null;
        }
      }),
    );

    if (hasDeniedRouter) {
      throw new Error(FORBIDDEN_ERROR);
    }

    return routers.filter((router): router is RouterReconfigureRecord =>
      Boolean(router),
    );
  }

  private async reconfigureAuthorizedRouters(
    routers: RouterReconfigureRecord[],
    settings: RouterSettings,
  ) {
    const results: RouterReconfigureResult[] = [];

    for (const router of routers) {
      results.push(await this.reconfigureSingleRouter(router, settings));
    }

    return results;
  }

  private async reconfigureSingleRouter(
    router: RouterReconfigureRecord,
    settings: RouterSettings,
  ): Promise<RouterReconfigureResult> {
    try {
      const resolution = await tryResolveIsolirProvisioning(router);
      const result = await this.provisioningService.provisionRadius(
        ...buildProvisionRadiusArgs(router, settings, resolution.isolir),
      );
      await recordIsolirPageSync(
        this.networkRepository,
        router.id,
        buildIsolirPageSync(resolution, result),
      );

      return buildRouterResult(
        router,
        result.success,
        result.logs,
        result.success ? null : PROVISIONING_FAILED_MESSAGE,
      );
    } catch (error) {
      return buildRouterResult(
        router,
        false,
        [],
        error instanceof Error ? error.message : "Terjadi kesalahan",
      );
    }
  }
}
