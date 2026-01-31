/**
 * AppVersionMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { AppVersion } from '@prisma/client'
import type {
    AppVersionListItemDTO,
    AppVersionDetailDTO,
    VersionCheckDTO,
} from '../dto/AppVersionDTO'

// Extended types
type AppVersionWithRelations = AppVersion & {
    user?: {
        id: string
        name: string | null
    } | null
}

export class AppVersionMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: AppVersion): AppVersionListItemDTO {
        return {
            id: entity.id,
            version: entity.version,
            buildNumber: entity.buildNumber,
            versionCode: entity.versionCode,
            platform: entity.platform,
            isForceUpdate: entity.isForceUpdate,
            isActive: entity.isActive,
            publishedAt: entity.publishedAt?.toISOString() ?? null,
            createdAt: entity.createdAt.toISOString(),
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: AppVersion[]): AppVersionListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: AppVersionWithRelations): AppVersionDetailDTO {
        return {
            id: entity.id,
            version: entity.version,
            buildNumber: entity.buildNumber,
            versionCode: entity.versionCode,
            platform: entity.platform,
            apkUrl: entity.apkUrl,
            apkSize: entity.apkSize ? Number(entity.apkSize) : null,
            releaseNotes: entity.releaseNotes,
            isForceUpdate: entity.isForceUpdate,
            minVersion: entity.minVersion,
            isActive: entity.isActive,
            publishedAt: entity.publishedAt?.toISOString() ?? null,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            createdBy: entity.user ? {
                id: entity.user.id,
                name: entity.user.name,
            } : null,
        }
    }

    /**
     * Create version check response
     */
    static toVersionCheck(
        currentVersionCode: number,
        latestVersion: AppVersion | null
    ): VersionCheckDTO {
        if (!latestVersion) {
            return {
                currentVersion: '',
                latestVersion: '',
                latestVersionCode: 0,
                isUpdateAvailable: false,
                isForceUpdate: false,
                downloadUrl: null,
                releaseNotes: null,
            }
        }

        const isUpdateAvailable = currentVersionCode < latestVersion.versionCode

        return {
            currentVersion: this.versionCodeToString(currentVersionCode),
            latestVersion: latestVersion.version,
            latestVersionCode: latestVersion.versionCode,
            isUpdateAvailable,
            isForceUpdate: isUpdateAvailable && latestVersion.isForceUpdate,
            downloadUrl: latestVersion.apkUrl,
            releaseNotes: latestVersion.releaseNotes,
        }
    }

    // ==================== Private Helpers ====================

    /**
     * Convert version code to version string (rough estimate)
     */
    private static versionCodeToString(versionCode: number): string {
        const major = Math.floor(versionCode / 10000)
        const minor = Math.floor((versionCode % 10000) / 100)
        const patch = versionCode % 100
        return `${major}.${minor}.${patch}`
    }
}
