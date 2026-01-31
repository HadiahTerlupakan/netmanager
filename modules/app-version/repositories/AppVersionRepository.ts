import { prisma } from '@/lib/prisma'
import type { Prisma, User } from '@prisma/client'

// Infer AppVersion type dari Prisma client
export type AppVersion = Prisma.AppVersionGetPayload<Record<string, never>>

export type AppVersionWithUser = AppVersion & {
    user: Pick<User, 'id' | 'name' | 'email'> | null
}

export interface CreateAppVersionDTO {
    version: string
    buildNumber: number
    versionCode: number
    platform?: string
    apkUrl?: string
    apkSize?: bigint
    releaseNotes?: string
    isForceUpdate?: boolean
    minVersion?: string
    isActive?: boolean
    publishedAt?: Date
    createdBy?: string
}

export interface UpdateAppVersionDTO {
    version?: string
    buildNumber?: number
    versionCode?: number
    platform?: string
    apkUrl?: string
    apkSize?: bigint
    releaseNotes?: string
    isForceUpdate?: boolean
    minVersion?: string
    isActive?: boolean
    publishedAt?: Date
}

export class AppVersionRepository {
    /**
     * Find all app versions with pagination
     */
    async findAll(options?: {
        page?: number
        limit?: number
        platform?: string
        isActive?: boolean
    }): Promise<{ data: AppVersionWithUser[]; total: number }> {
        const page = options?.page || 1
        const limit = options?.limit || 10
        const skip = (page - 1) * limit

        const where: Prisma.AppVersionWhereInput = {}
        
        if (options?.platform) {
            where.platform = options.platform
        }
        
        if (options?.isActive !== undefined) {
            where.isActive = options.isActive
        }

        const [data, total] = await Promise.all([
            prisma.appVersion.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, name: true, email: true }
                    }
                },
                orderBy: { versionCode: 'desc' },
                skip,
                take: limit
            }),
            prisma.appVersion.count({ where })
        ])

        return { data, total }
    }

    /**
     * Find by ID
     */
    async findById(id: string): Promise<AppVersionWithUser | null> {
        return prisma.appVersion.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                }
            }
        })
    }

    /**
     * Find by version string
     */
    async findByVersion(version: string): Promise<AppVersion | null> {
        return prisma.appVersion.findUnique({
            where: { version }
        })
    }

    /**
     * Find by version code
     */
    async findByVersionCode(versionCode: number): Promise<AppVersion | null> {
        return prisma.appVersion.findUnique({
            where: { versionCode }
        })
    }

    /**
     * Get latest active version for a platform
     */
    async getLatestVersion(platform: string = 'android'): Promise<AppVersion | null> {
        return prisma.appVersion.findFirst({
            where: {
                isActive: true,
                OR: [
                    { platform },
                    { platform: 'all' }
                ]
            },
            orderBy: { versionCode: 'desc' }
        })
    }

    /**
     * Create new app version
     */
    async create(data: CreateAppVersionDTO): Promise<AppVersion> {
        const createData: Prisma.AppVersionUncheckedCreateInput = {
            version: data.version,
            buildNumber: data.buildNumber,
            versionCode: data.versionCode,
            platform: data.platform || 'android',
            apkUrl: data.apkUrl ?? null,
            apkSize: data.apkSize ?? null,
            releaseNotes: data.releaseNotes ?? null,
            isForceUpdate: data.isForceUpdate || false,
            minVersion: data.minVersion ?? null,
            isActive: data.isActive ?? true,
            publishedAt: data.publishedAt || new Date(),
        }

        if (data.createdBy) {
            createData.createdBy = data.createdBy
        }

        return prisma.appVersion.create({
            data: createData
        })
    }

    /**
     * Update app version
     */
    async update(id: string, data: UpdateAppVersionDTO): Promise<AppVersion> {
        return prisma.appVersion.update({
            where: { id },
            data
        })
    }

    /**
     * Soft delete (set isActive to false)
     */
    async softDelete(id: string): Promise<AppVersion> {
        return prisma.appVersion.update({
            where: { id },
            data: { isActive: false }
        })
    }

    /**
     * Hard delete
     */
    async delete(id: string): Promise<void> {
        await prisma.appVersion.delete({
            where: { id }
        })
    }

    /**
     * Check if version or versionCode already exists
     */
    async exists(version: string, versionCode: number): Promise<{
        versionExists: boolean
        versionCodeExists: boolean
    }> {
        const [versionRecord, versionCodeRecord] = await Promise.all([
            prisma.appVersion.findUnique({ where: { version } }),
            prisma.appVersion.findUnique({ where: { versionCode } })
        ])

        return {
            versionExists: !!versionRecord,
            versionCodeExists: !!versionCodeRecord
        }
    }
}
