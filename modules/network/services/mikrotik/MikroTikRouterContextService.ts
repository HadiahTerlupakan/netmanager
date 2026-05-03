import type { MikroTikRouterEntity } from "../../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../../domain/ports/IMikroTikRouterRepository";
import type {
  PelangganWithRouter,
  RouterTenantId,
} from "../../repositories/NetworkRepository";
import type { PelangganRouterContext } from "./ppp-secret.types";

/**
 * MikroTik Router Context Service
 *
 * Bertanggung jawab untuk resolusi router context dari routerId atau pelangganId.
 * Memisahkan logic context resolution dari business logic PPP Secret.
 */

interface MikroTikRouterContextNetworkRepository {
  findRouterTenantId(routerId: string): Promise<RouterTenantId | null>;
  findPelangganWithRouter(
    pelangganId: string,
  ): Promise<PelangganWithRouter | null>;
}

type MikroTikRouterContextDependencies = {
  networkRepository: MikroTikRouterContextNetworkRepository;
  routerRepository: IMikroTikRouterRepository;
};

export class MikroTikRouterContextService {
  private readonly networkRepository: MikroTikRouterContextNetworkRepository;
  private readonly routerRepository: IMikroTikRouterRepository;

  constructor(deps: MikroTikRouterContextDependencies) {
    this.networkRepository = deps.networkRepository;
    this.routerRepository = deps.routerRepository;
  }

  /**
   * Find router entity by routerId
   * Returns router entity atau null jika tidak ditemukan
   */
  async findRouter(routerId: string): Promise<MikroTikRouterEntity | null> {
    const routerTenant =
      await this.networkRepository.findRouterTenantId(routerId);
    if (!routerTenant?.tenantId) {
      return null;
    }

    return this.routerRepository.findById(routerId, routerTenant.tenantId);
  }

  /**
   * Get router context dari pelanggan
   * Menggunakan generated API user jika tersedia, fallback ke master user
   * Returns context object atau null jika pelanggan/router tidak ditemukan
   */
  async getRouterFromPelanggan(
    pelangganId: string,
  ): Promise<PelangganRouterContext | null> {
    const pelanggan =
      await this.networkRepository.findPelangganWithRouter(pelangganId);

    if (!pelanggan?.hargaPaket?.profilePPP?.mikroTikRouter) {
      return null;
    }

    const router = pelanggan.hargaPaket.profilePPP.mikroTikRouter;

    const apiUsername = router.apiUsernameGenerated || router.apiUsername;
    const apiPassword = router.apiPasswordGenerated || router.apiPassword;

    return {
      router: {
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: apiUsername,
        apiPassword: apiPassword,
      },
      routerId: router.id,
      pelanggan: {
        username: pelanggan.username,
        password: pelanggan.password,
        nama: pelanggan.nama,
      },
      profileName: pelanggan.hargaPaket.profilePPP.name,
    };
  }
}
