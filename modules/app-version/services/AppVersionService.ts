import { AppVersionRepository, type AppVersion, type CreateAppVersionDTO, type UpdateAppVersionDTO, type AppVersionWithUser } from '../repositories/AppVersionRepository'
import { isR2Enabled, uploadToR2, generateR2Key, deleteFromR2 } from '@/lib/utils/r2-client'
import fs from 'fs/promises'
import fss from 'fs'
import path from 'path'
import os from 'os'

// APK parsing types
interface ApkManifest {
    versionCode: number
    versionName: string
    package: string
}

export interface ParsedApkInfo {
    versionName: string
    versionCode: number
    packageName: string
    buildNumber: number
}

export interface UploadVersionInput {
    version?: string           // Optional jika auto-extract dari APK
    buildNumber?: number       // Optional jika auto-extract dari APK
    versionCode?: number       // Optional jika auto-extract dari APK
    platform?: string
    releaseNotes?: string
    isForceUpdate?: boolean
    minVersion?: string
    apkBuffer?: Buffer
    apkFilename?: string
    apkSize?: number
    createdBy?: string
}

export interface CheckVersionResult {
    updateAvailable: boolean
    isForceUpdate: boolean
    currentVersion: string
    latestVersion: {
        id: string
        version: string
        buildNumber: number
        versionCode: number
        releaseNotes: string | null
        downloadUrl: string | null
        apkSize: number | null
    } | null
}

// Singleton instance
let serviceInstance: AppVersionService | null = null

export function getAppVersionService(): AppVersionService {
    if (!serviceInstance) {
        serviceInstance = new AppVersionService()
    }
    return serviceInstance
}

export class AppVersionService {
    private repository: AppVersionRepository

    constructor() {
        this.repository = new AppVersionRepository()
    }

    /**
     * Parse APK file to extract version info
     */
    async parseApkInfo(apkBuffer: Buffer): Promise<ParsedApkInfo | null> {
        let tempFilePath: string | null = null
        
        try {
            // Dynamic import for adbkit-apkreader (CommonJS module)
            const apkReaderModule = await import('adbkit-apkreader')
            const ApkReader = apkReaderModule.default || apkReaderModule
            
            // Write buffer to temp file (apkreader needs file path)
            tempFilePath = path.join(os.tmpdir(), `apk_${Date.now()}.apk`)
            await fs.writeFile(tempFilePath, apkBuffer)
            
            // Open and read APK
            const reader = await ApkReader.open(tempFilePath)
            const manifest = await reader.readManifest() as ApkManifest
            
            // Extract version info
            const versionName = manifest.versionName || ''
            const versionCode = manifest.versionCode || 0
            
            // Parse build number from version (e.g., "1.0.54" -> 54)
            const versionParts = versionName.split('.')
            const buildNumber = versionParts.length >= 3 ? parseInt(versionParts[2], 10) || versionCode : versionCode
            
            return {
                versionName,
                versionCode,
                packageName: manifest.package || '',
                buildNumber
            }
        } catch (error) {
            console.error('Error parsing APK:', error)
            return null
        } finally {
            // Cleanup temp file
            if (tempFilePath) {
                try {
                    await fs.unlink(tempFilePath)
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }
    }

    /**
     * Get all versions with pagination
     */
    async getAllVersions(options?: {
        page?: number
        limit?: number
        platform?: string
        isActive?: boolean
    }): Promise<{ data: AppVersionWithUser[]; total: number; page: number; limit: number }> {
        const page = options?.page || 1
        const limit = options?.limit || 10
        const result = await this.repository.findAll(options)
        
        return {
            ...result,
            page,
            limit
        }
    }

    /**
     * Get version by ID
     */
    async getVersionById(id: string): Promise<AppVersionWithUser | null> {
        return this.repository.findById(id)
    }

    /**
     * Upload new app version with APK file
     * If version/buildNumber/versionCode not provided, auto-extract from APK
     */
    async uploadVersion(input: UploadVersionInput): Promise<AppVersion> {
        let version = input.version
        let buildNumber = input.buildNumber
        let versionCode = input.versionCode

        // Auto-parse APK jika ada APK dan version info tidak lengkap
        if (input.apkBuffer && (!version || !buildNumber || !versionCode)) {
            const apkInfo = await this.parseApkInfo(input.apkBuffer)
            if (apkInfo) {
                version = version || apkInfo.versionName
                buildNumber = buildNumber || apkInfo.buildNumber
                versionCode = versionCode || apkInfo.versionCode
                console.log(`Auto-extracted from APK: v${version}, build ${buildNumber}, code ${versionCode}`)
            }
        }

        // Validate required fields
        if (!version || !buildNumber || !versionCode) {
            throw new Error('Version, buildNumber, dan versionCode wajib diisi atau upload APK untuk auto-detect')
        }

        // Validate version doesn't already exist
        const exists = await this.repository.exists(version, versionCode)
        if (exists.versionExists) {
            throw new Error(`Version ${version} sudah ada`)
        }
        if (exists.versionCodeExists) {
            throw new Error(`Version code ${versionCode} sudah ada`)
        }

        let apkUrl: string | undefined

        // Upload APK if provided
        if (input.apkBuffer && input.apkFilename) {
            apkUrl = await this.uploadApkFile(
                input.apkBuffer, 
                input.apkFilename,
                version
            )
        }

        // Create version record
        const createData: CreateAppVersionDTO = {
            version,
            buildNumber,
            versionCode,
            platform: input.platform || 'android',
            apkUrl,
            apkSize: input.apkSize ? BigInt(input.apkSize) : undefined,
            releaseNotes: input.releaseNotes,
            isForceUpdate: input.isForceUpdate || false,
            minVersion: input.minVersion,
            isActive: true,
            publishedAt: new Date(),
            createdBy: input.createdBy
        }

        return this.repository.create(createData)
    }

    /**
     * Upload APK file to storage (R2 or local)
     */
    private async uploadApkFile(
        buffer: Buffer, 
        filename: string,
        version: string
    ): Promise<string> {
        const sanitizedFilename = `netmanager_v${version}.apk`
        
        // Check if R2 is enabled
        const r2Enabled = await isR2Enabled()

        if (r2Enabled) {
            // Upload to R2
            const key = generateR2Key('app-version' as any, sanitizedFilename)
            return uploadToR2(buffer, key, 'application/vnd.android.package-archive')
        } else {
            // Save to local storage
            const uploadDir = path.join(process.cwd(), 'public', 'apk')
            await fs.mkdir(uploadDir, { recursive: true })
            
            const filePath = path.join(uploadDir, sanitizedFilename)
            await fs.writeFile(filePath, buffer)
            
            return `/apk/${sanitizedFilename}`
        }
    }

    /**
     * Update version info
     */
    async updateVersion(id: string, data: UpdateAppVersionDTO): Promise<AppVersion> {
        const existing = await this.repository.findById(id)
        if (!existing) {
            throw new Error('Versi tidak ditemukan')
        }

        // Check for version conflicts if changing version or versionCode
        if (data.version && data.version !== existing.version) {
            const versionExists = await this.repository.findByVersion(data.version)
            if (versionExists) {
                throw new Error(`Version ${data.version} sudah ada`)
            }
        }

        if (data.versionCode && data.versionCode !== existing.versionCode) {
            const codeExists = await this.repository.findByVersionCode(data.versionCode)
            if (codeExists) {
                throw new Error(`Version code ${data.versionCode} sudah ada`)
            }
        }

        return this.repository.update(id, data)
    }

    /**
     * Soft delete version
     */
    async deleteVersion(id: string): Promise<AppVersion> {
        const existing = await this.repository.findById(id)
        if (!existing) {
            throw new Error('Versi tidak ditemukan')
        }

        return this.repository.softDelete(id)
    }

    /**
     * Check for available update
     */
    async checkForUpdate(
        currentVersionCode: number,
        platform: string = 'android'
    ): Promise<CheckVersionResult> {
        const latestVersion = await this.repository.getLatestVersion(platform)

        if (!latestVersion) {
            return {
                updateAvailable: false,
                isForceUpdate: false,
                currentVersion: '',
                latestVersion: null
            }
        }

        const updateAvailable = latestVersion.versionCode > currentVersionCode
        
        // Determine if force update is required
        let isForceUpdate = false
        if (updateAvailable && latestVersion.isForceUpdate) {
            isForceUpdate = true
        }

        // Also check minVersion if specified
        if (updateAvailable && latestVersion.minVersion) {
            // Parse minVersion and compare
            const minVersionCode = this.parseVersionToCode(latestVersion.minVersion)
            if (minVersionCode && currentVersionCode < minVersionCode) {
                isForceUpdate = true
            }
        }

        return {
            updateAvailable,
            isForceUpdate,
            currentVersion: latestVersion.version,
            latestVersion: updateAvailable ? {
                id: latestVersion.id,
                version: latestVersion.version,
                buildNumber: latestVersion.buildNumber,
                versionCode: latestVersion.versionCode,
                releaseNotes: latestVersion.releaseNotes,
                downloadUrl: latestVersion.apkUrl ? `/api/mobile/app-version/download/${latestVersion.id}` : null,
                apkSize: latestVersion.apkSize ? Number(latestVersion.apkSize) : null
            } : null
        }
    }

    /**
     * Parse version string to version code (rough estimation)
     * e.g., "1.0.54" -> 10054
     */
    private parseVersionToCode(version: string): number | null {
        const parts = version.split('.')
        if (parts.length !== 3) return null

        const major = parseInt(parts[0], 10)
        const minor = parseInt(parts[1], 10)
        const patch = parseInt(parts[2], 10)

        if (isNaN(major) || isNaN(minor) || isNaN(patch)) return null

        return major * 10000 + minor * 100 + patch
    }

    /**
     * Get APK file path for download
     */
    async getApkForDownload(id: string): Promise<{
        url: string
        filename: string
        size: number
    } | null> {
        const version = await this.repository.findById(id)
        if (!version || !version.apkUrl) {
            return null
        }

        return {
            url: version.apkUrl,
            filename: `netmanager_v${version.version}.apk`,
            size: version.apkSize ? Number(version.apkSize) : 0
        }
    }
}
