import { prisma } from '@/lib/prisma'

export interface ActiveTenant {
    id: string
}

export interface SettingRecord {
    id: string
    key: string
    value: string
    tenantId: string | null
    createdAt: Date
    updatedAt: Date
}

export interface RouterTenantId {
    tenantId: string | null
}

export interface RouterBasic {
    id: string
    ipAddress: string
    tenantId: string | null
}

export interface PelangganWithRouter {
    id: string
    username: string
    password: string
    nama: string
    status: string
    tenantId: string | null
    hargaPaket: {
        id: string
        profilePPP: {
            id: string
            name: string
            mikroTikRouter: {
                id: string
                ipAddress: string
                apiPort: number
                apiUsername: string
                apiPassword: string
                apiUsernameGenerated: string | null
                apiPasswordGenerated: string | null
            } | null
        } | null
    } | null
}

export interface PelangganBasic {
    id: string
    username: string
    status: string
    tenantId: string | null
}

export interface PelangganWithRouterBasic {
    id: string
    username: string
    tenantId: string | null
    hargaPaket: {
        profilePPP: {
            mikroTikRouter: {
                id: string
            } | null
        } | null
    } | null
}

export class NetworkRepository {
    async findActiveTenants(): Promise<ActiveTenant[]> {
        return prisma.tenant.findMany({
            where: { isActive: true },
            select: { id: true }
        })
    }

    async findRouterTenantId(routerId: string): Promise<RouterTenantId | null> {
        return prisma.mikroTikRouter.findUnique({
            where: { id: routerId },
            select: { tenantId: true }
        })
    }

    async findRouterByNasIp(nasIpAddress: string, tenantId: string): Promise<RouterBasic | null> {
        return prisma.mikroTikRouter.findFirst({
            where: {
                ipAddress: nasIpAddress,
                OR: [
                    { tenantId },
                    { tenantId: null }
                ]
            },
            select: {
                id: true,
                ipAddress: true,
                tenantId: true
            }
        })
    }

    async findAnyRouterByTenant(tenantId: string): Promise<RouterBasic | null> {
        return prisma.mikroTikRouter.findFirst({
            where: {
                OR: [
                    { tenantId },
                    { tenantId: null }
                ]
            },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                ipAddress: true,
                tenantId: true
            }
        })
    }

    async findSettingByKey(key: string): Promise<SettingRecord | null> {
        return prisma.settings.findFirst({
            where: { key }
        })
    }

    async findBandwidthById(bandwidthId: string) {
        return prisma.bandwidth.findUnique({
            where: { id: bandwidthId }
        })
    }

    async findProfilePPPWithHargaPaket(profilePPPId: string) {
        return prisma.profilePPP.findUnique({
            where: { id: profilePPPId },
            include: {
                hargaPaket: {
                    include: {
                        bandwidth: true
                    }
                }
            }
        })
    }

    async findPelangganWithRouter(pelangganId: string): Promise<PelangganWithRouter | null> {
        return prisma.pelanggan.findUnique({
            where: { id: pelangganId },
            include: {
                hargaPaket: {
                    include: {
                        profilePPP: {
                            include: {
                                mikroTikRouter: true
                            }
                        }
                    }
                }
            }
        })
    }

    async findPelangganBasic(pelangganId: string): Promise<PelangganBasic | null> {
        return prisma.pelanggan.findUnique({
            where: { id: pelangganId },
            select: {
                id: true,
                username: true,
                status: true,
                tenantId: true
            }
        })
    }

    async findPelangganWithRouterByUsername(username: string, tenantId: string): Promise<PelangganWithRouterBasic | null> {
        return prisma.pelanggan.findFirst({
            where: {
                username,
                OR: [
                    { tenantId },
                    { tenantId: null }
                ]
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
                                        id: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
    }
}
