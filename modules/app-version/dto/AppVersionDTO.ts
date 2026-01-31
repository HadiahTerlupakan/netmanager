/**
 * AppVersion DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

/**
 * DTO for app version list views
 */
export interface AppVersionListItemDTO {
    id: string
    version: string
    buildNumber: number
    versionCode: number
    platform: string
    isForceUpdate: boolean
    isActive: boolean
    publishedAt: string | null
    createdAt: string
}

/**
 * DTO for app version detail views
 */
export interface AppVersionDetailDTO {
    id: string
    version: string
    buildNumber: number
    versionCode: number
    platform: string
    apkUrl: string | null
    apkSize: number | null
    releaseNotes: string | null
    isForceUpdate: boolean
    minVersion: string | null
    isActive: boolean
    publishedAt: string | null
    createdAt: string
    updatedAt: string
    createdBy: {
        id: string
        name: string | null
    } | null
}

/**
 * DTO for version check (mobile app)
 */
export interface VersionCheckDTO {
    currentVersion: string
    latestVersion: string
    latestVersionCode: number
    isUpdateAvailable: boolean
    isForceUpdate: boolean
    downloadUrl: string | null
    releaseNotes: string | null
}

// ==================== Request DTOs ====================

/**
 * DTO for creating app version
 */
export interface CreateAppVersionDTO {
    version: string
    buildNumber: number
    versionCode: number
    platform?: string
    apkUrl?: string
    apkSize?: number
    releaseNotes?: string
    isForceUpdate?: boolean
    minVersion?: string
}

/**
 * DTO for updating app version
 */
export interface UpdateAppVersionDTO {
    releaseNotes?: string
    isForceUpdate?: boolean
    minVersion?: string
    isActive?: boolean
    publishedAt?: string
}
