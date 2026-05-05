import { prisma } from "@/lib/prisma";
import {
  buildRouterReconfigureSelect,
  buildTenantOrGlobalScope,
  getDefaultRouterOrder,
} from "./networkRepository.selectors";
import type {
  ActiveTenant,
  PelangganBasic,
  PelangganWithRouter,
  PelangganWithRouterBasic,
  RouterBasic,
  RouterConnectionRecord,
  RouterGeneratedApiUserRecord,
  RouterReconfigureRecord,
  RouterTenantId,
  SettingKeyValue,
  SettingRecord,
  UserSiteRecord,
} from "./networkRepository.types";

export type {
  ActiveTenant,
  PelangganBasic,
  PelangganWithRouter,
  PelangganWithRouterBasic,
  RouterBasic,
  RouterConnectionRecord,
  RouterGeneratedApiUserRecord,
  RouterReconfigureRecord,
  RouterTenantId,
  SettingKeyValue,
  SettingRecord,
  UserSiteRecord,
} from "./networkRepository.types";

const DEFAULT_ROUTER_ORDER = getDefaultRouterOrder();

function buildRouterBasicSelect() {
  return {
    id: true,
    ipAddress: true,
    tenantId: true,
  } as const;
}

function buildRouterConnectionSelect() {
  return {
    id: true,
    ipAddress: true,
    apiPort: true,
    apiUsername: true,
    apiPassword: true,
    apiUsernameGenerated: true,
    apiPasswordGenerated: true,
  } as const;
}

function buildPelangganBasicSelect() {
  return {
    id: true,
    username: true,
    status: true,
    tenantId: true,
  } as const;
}

function buildPelangganRouterUsernameSelect() {
  return {
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
  } as const;
}

function buildPelangganWithRouterInclude() {
  return {
    hargaPaket: {
      include: {
        profilePPP: {
          include: {
            mikroTikRouter: true,
          },
        },
      },
    },
  } as const;
}

function buildProfilePPPWithHargaPaketInclude() {
  return {
    hargaPaket: {
      include: {
        bandwidth: true,
      },
    },
  } as const;
}

function buildGeneratedApiUserData(credentials: RouterGeneratedApiUserRecord) {
  return {
    apiUsernameGenerated: credentials.apiUsernameGenerated,
    apiPasswordGenerated: credentials.apiPasswordGenerated,
  };
}

function buildRouterHealthData(health: {
  pingStatus: string;
  userOnline: number;
  lastStatusCheck: Date;
}) {
  return {
    pingStatus: health.pingStatus,
    userOnline: health.userOnline,
    lastStatusCheck: health.lastStatusCheck,
  };
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
      select: buildRouterBasicSelect(),
    });
  }

  /** Ambil satu router pertama dalam scope tenant. */
  async findAnyRouterByTenant(tenantId: string): Promise<RouterBasic | null> {
    return prisma.mikroTikRouter.findFirst({
      where: buildTenantOrGlobalScope(tenantId),
      orderBy: DEFAULT_ROUTER_ORDER,
      select: buildRouterBasicSelect(),
    });
  }

  /** Ambil router untuk koneksi langsung tanpa memaksa tenant non-null. */
  async findRouterConnectionById(
    routerId: string,
  ): Promise<RouterConnectionRecord | null> {
    return prisma.mikroTikRouter.findUnique({
      where: { id: routerId },
      select: buildRouterConnectionSelect(),
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
      data: buildGeneratedApiUserData(credentials),
    });
  }

  /** Perbarui status kesehatan router. */
  async updateRouterHealth(
    id: string,
    health: { pingStatus: string; userOnline: number; lastStatusCheck: Date },
  ): Promise<void> {
    await prisma.mikroTikRouter.update({
      where: { id },
      data: buildRouterHealthData(health),
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
      include: buildProfilePPPWithHargaPaketInclude(),
    });
  }

  /** Ambil pelanggan beserta router terkait untuk provisioning. */
  async findPelangganWithRouter(
    pelangganId: string,
  ): Promise<PelangganWithRouter | null> {
    return prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      include: buildPelangganWithRouterInclude(),
    });
  }

  /** Ambil data dasar pelanggan. */
  async findPelangganBasic(
    pelangganId: string,
  ): Promise<PelangganBasic | null> {
    return prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: buildPelangganBasicSelect(),
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
      select: buildPelangganRouterUsernameSelect(),
    });
  }
}
