import { prisma } from "@/lib/prisma";

export interface ActiveTenant {
  id: string;
}

export interface SettingRecord {
  id: string;
  key: string;
  value: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingKeyValue {
  key: string;
  value: string;
}

export interface RouterTenantId {
  tenantId: string | null;
}

export interface RouterBasic {
  id: string;
  ipAddress: string;
  tenantId: string | null;
}

export interface RouterReconfigureRecord {
  id: string;
  name: string;
  ipAddress: string;
  apiPort: number;
  pingStatus: string;
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
  siteId: string | null;
}

export interface RouterGeneratedApiUserRecord {
  apiUsernameGenerated: string;
  apiPasswordGenerated: string;
}

export interface UserSiteRecord {
  siteId: string | null;
}

export interface PelangganWithRouter {
  id: string;
  username: string;
  password: string;
  nama: string;
  status: string;
  tenantId: string | null;
  hargaPaket: {
    id: string;
    profilePPP: {
      id: string;
      name: string;
      mikroTikRouter: {
        id: string;
        ipAddress: string;
        apiPort: number;
        apiUsername: string;
        apiPassword: string;
        apiUsernameGenerated: string | null;
        apiPasswordGenerated: string | null;
      } | null;
    } | null;
  } | null;
}

export interface PelangganBasic {
  id: string;
  username: string;
  status: string;
  tenantId: string | null;
}

export interface PelangganWithRouterBasic {
  id: string;
  username: string;
  tenantId: string | null;
  hargaPaket: {
    profilePPP: {
      mikroTikRouter: {
        id: string;
      } | null;
    } | null;
  } | null;
}

const DEFAULT_ROUTER_ORDER = { createdAt: "desc" as const };

function buildTenantOrGlobalScope(tenantId: string) {
  return {
    OR: [{ tenantId }, { tenantId: null }],
  };
}

function buildRouterReconfigureSelect() {
  return {
    id: true,
    name: true,
    ipAddress: true,
    apiPort: true,
    pingStatus: true,
    apiUsername: true,
    apiPassword: true,
    apiUsernameGenerated: true,
    apiPasswordGenerated: true,
    siteId: true,
  } as const;
}

export class NetworkRepository {
  /** Ambil tenant aktif untuk proses monitoring dan sinkronisasi. */
  async findActiveTenants(): Promise<ActiveTenant[]> {
    return prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
  }

  /** Ambil tenant pemilik router. */
  async findRouterTenantId(routerId: string): Promise<RouterTenantId | null> {
    return prisma.mikroTikRouter.findUnique({
      where: { id: routerId },
      select: { tenantId: true },
    });
  }

  /** Ambil router berdasarkan NAS IP dalam scope tenant. */
  async findRouterByNasIp(
    nasIpAddress: string,
    tenantId: string,
  ): Promise<RouterBasic | null> {
    return prisma.mikroTikRouter.findFirst({
      where: {
        ipAddress: nasIpAddress,
        ...buildTenantOrGlobalScope(tenantId),
      },
      select: {
        id: true,
        ipAddress: true,
        tenantId: true,
      },
    });
  }

  /** Ambil satu router pertama dalam scope tenant. */
  async findAnyRouterByTenant(tenantId: string): Promise<RouterBasic | null> {
    return prisma.mikroTikRouter.findFirst({
      where: buildTenantOrGlobalScope(tenantId),
      orderBy: DEFAULT_ROUTER_ORDER,
      select: {
        id: true,
        ipAddress: true,
        tenantId: true,
      },
    });
  }

  /** Ambil setting berdasarkan key tunggal. */
  async findSettingByKey(key: string): Promise<SettingRecord | null> {
    return prisma.settings.findFirst({
      where: { key },
    });
  }

  /** Ambil sekumpulan setting key/value untuk kebutuhan route service. */
  async findSettingsByKeys(
    keys: readonly string[],
  ): Promise<SettingKeyValue[]> {
    return prisma.settings.findMany({
      where: { key: { in: [...keys] } },
      select: { key: true, value: true },
    });
  }

  /** Ambil site user untuk validasi akses. */
  async findUserSite(userId: string): Promise<UserSiteRecord | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { siteId: true },
    });
  }

  /** Ambil router untuk proses reconfigure dengan batas tenant. */
  async findRouterForReconfigure(
    id: string,
    tenantId: string,
  ): Promise<RouterReconfigureRecord | null> {
    return prisma.mikroTikRouter.findFirst({
      where: {
        id,
        ...buildTenantOrGlobalScope(tenantId),
      },
      select: buildRouterReconfigureSelect(),
    });
  }

  /** Simpan kredensial API generated pada router. */
  async updateGeneratedApiUser(
    id: string,
    credentials: RouterGeneratedApiUserRecord,
  ): Promise<void> {
    await prisma.mikroTikRouter.update({
      where: { id },
      data: {
        apiUsernameGenerated: credentials.apiUsernameGenerated,
        apiPasswordGenerated: credentials.apiPasswordGenerated,
      },
    });
  }

  /** Perbarui status kesehatan router. */
  async updateRouterHealth(
    id: string,
    health: { pingStatus: string; userOnline: number; lastStatusCheck: Date },
  ): Promise<void> {
    await prisma.mikroTikRouter.update({
      where: { id },
      data: {
        pingStatus: health.pingStatus,
        userOnline: health.userOnline,
        lastStatusCheck: health.lastStatusCheck,
      },
    });
  }

  /** Ambil bandwidth berdasarkan id. */
  async findBandwidthById(bandwidthId: string) {
    return prisma.bandwidth.findUnique({
      where: { id: bandwidthId },
    });
  }

  /** Ambil profile PPP beserta paket harga terkait. */
  async findProfilePPPWithHargaPaket(profilePPPId: string) {
    return prisma.profilePPP.findUnique({
      where: { id: profilePPPId },
      include: {
        hargaPaket: {
          include: {
            bandwidth: true,
          },
        },
      },
    });
  }

  /** Ambil pelanggan beserta router terkait untuk provisioning. */
  async findPelangganWithRouter(
    pelangganId: string,
  ): Promise<PelangganWithRouter | null> {
    return prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      include: {
        hargaPaket: {
          include: {
            profilePPP: {
              include: {
                mikroTikRouter: true,
              },
            },
          },
        },
      },
    });
  }

  /** Ambil data dasar pelanggan. */
  async findPelangganBasic(
    pelangganId: string,
  ): Promise<PelangganBasic | null> {
    return prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: {
        id: true,
        username: true,
        status: true,
        tenantId: true,
      },
    });
  }

  /** Ambil pelanggan berdasarkan username beserta router terkait. */
  async findPelangganWithRouterByUsername(
    username: string,
    tenantId: string,
  ): Promise<PelangganWithRouterBasic | null> {
    return prisma.pelanggan.findFirst({
      where: {
        username,
        ...buildTenantOrGlobalScope(tenantId),
      },
      select: {
        id: true,
        username: true,
        tenantId: true,
        hargaPaket: {
          select: {
            profilePPP: {
              select: {
                mikroTikRouter: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
