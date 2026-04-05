import {
    AppVersionRepository,
    type AppVersion,
    type CreateAppVersionDTO,
    type UpdateAppVersionDTO,
    type AppVersionWithUser,
    type AppVersionRolloutStats,
} from '../repositories/AppVersionRepository'
import { isR2Enabled, uploadToR2, generateR2Key, deleteFromR2, getR2ObjectBuffer, getR2ObjectMetadata, getR2Settings } from '@/lib/utils/r2-client'
import { isPrismaRecordNotFoundError } from '@/lib/prisma-errors'
import fs from 'fs/promises'
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
    apkPath?: string
    apkFilename?: string
    apkSize?: number
    createdBy?: string
    // New fields for pre-uploaded files
    uploadedKey?: string
    uploadedFilename?: string
    uploadedSize?: number
    forceLocal?: boolean
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

export interface VersionAccessResult extends CheckVersionResult {
    isSupported: boolean
    currentVersionCode: number
    minimumVersion: string | null
}

export interface AppVersionStatsResult extends AppVersionRolloutStats {
    latestVersion: {
        version: string
        versionCode: number
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

    private validateUploadedKey(key: string) {
        if (!key.startsWith('uploads/apk/')) {
            throw new Error('Lokasi file direct upload tidak valid')
        }
    }

    private async cleanupStoredApk(apkUrl?: string | null): Promise<void> {
        if (!apkUrl) {
            return
        }

        if (apkUrl.startsWith('/uploads/apk/') || apkUrl.startsWith('/apk/')) {
            const relativePath = apkUrl.replace(/^\//, '')
            const localPath = path.join(process.cwd(), 'public', relativePath)
            await fs.unlink(localPath)
            return
        }

        if ((apkUrl.startsWith('http://') || apkUrl.startsWith('https://')) && apkUrl.includes('uploads/apk/')) {
            const keyIndex = apkUrl.indexOf('uploads/apk/')
            if (keyIndex !== -1) {
                const key = apkUrl.substring(keyIndex)
                await deleteFromR2(key)
            }
        }
    }

    private async loadUploadedApkDetails(input: UploadVersionInput): Promise<{
        apkBuffer?: Buffer
        apkSize?: number
        apkUrl?: string
    }> {
        if (!input.uploadedKey) {
            return {}
        }

        this.validateUploadedKey(input.uploadedKey)

        const metadata = await getR2ObjectMetadata(input.uploadedKey)

        if (input.uploadedSize && metadata.contentLength !== null && input.uploadedSize !== metadata.contentLength) {
            throw new Error('Ukuran file APK yang diupload tidak sesuai')
        }

        const settings = await getR2Settings()
        const apkUrl = settings?.publicUrl
            ? `${settings.publicUrl.replace(/\/$/, '')}/${input.uploadedKey}`
            : settings
                ? `https://${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com/${input.uploadedKey}`
                : input.uploadedKey

        const resolvedSize = metadata.contentLength ?? input.uploadedSize
        const apkBuffer = await getR2ObjectBuffer(input.uploadedKey)

        return {
            apkBuffer,
            ...(resolvedSize ? { apkSize: resolvedSize } : {}),
            apkUrl
        }
    }

    /**
     * Parse APK file to extract version info
     */
    /**
     * Parse APK file to extract version info
     */
    async parseApkInfo(input: { buffer?: Buffer, path?: string }): Promise<ParsedApkInfo | null> {
        let tempFilePath: string | null = null

        try {
            // console.log('[AppVersionService] Starting APK parsing...')

            // Dynamic import for adbkit-apkreader (CommonJS module)
            const apkReaderModule = await import('adbkit-apkreader')
            const ApkReader = apkReaderModule.default || apkReaderModule
            // console.log('[AppVersionService] APK reader module loaded')

            // Use provided path or write buffer to temp file
            if (input.path) {
                tempFilePath = input.path
                // console.log(`[AppVersionService] Using provided APK path: ${tempFilePath}`)
            } else if (input.buffer) {
                tempFilePath = path.join(os.tmpdir(), `apk_${Date.now()}.apk`)
                // console.log(`[AppVersionService] Writing APK buffer to temp file: ${tempFilePath}`)
                await fs.writeFile(tempFilePath, input.buffer)
            } else {
                console.warn('[AppVersionService] No APK buffer or path provided')
                return null
            }

            // Open and read APK
            // console.log(`[AppVersionService] Opening APK file: ${tempFilePath}`)
            const reader = await ApkReader.open(tempFilePath)
            // console.log('[AppVersionService] Reading APK manifest...')
            const manifest = await reader.readManifest() as ApkManifest
            // console.log(`[AppVersionService] APK manifest read: versionName=${manifest.versionName}, versionCode=${manifest.versionCode}`)

            // Extract version info
            const versionName = manifest.versionName || ''
            const versionCode = manifest.versionCode || 0

            // Parse build number from version (e.g., "1.0.54" -> 54)
            const versionParts = versionName.split('.')
            const buildNumber = versionParts.length >= 3 ? parseInt(versionParts[2] ?? '0', 10) || versionCode : versionCode

            const result = {
                versionName,
                versionCode,
                packageName: manifest.package || '',
                buildNumber
            }
            // console.log(`[AppVersionService] APK parsed successfully: ${JSON.stringify(result)}`)
            return result
        } catch (error: unknown) {
            console.error('[AppVersionService] Error parsing APK:', error)
            const err = error as { message?: string; stack?: string; code?: string }
            console.error('[AppVersionService] Error details:', {
                message: err?.message,
                stack: err?.stack,
                code: err?.code
            })
            return null
        } finally {
            // Only cleanup if we created the temp file from buffer
            if (tempFilePath && !input.path) {
                try {
                    // console.log(`[AppVersionService] Cleaning up temp file: ${tempFilePath}`)
                    await fs.unlink(tempFilePath)
                } catch (e: unknown) {
                    const err = e as { message?: string }
                    console.warn(`[AppVersionService] Failed to cleanup temp file: ${err?.message}`)
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

    async getStats(platform: string = 'android'): Promise<AppVersionStatsResult> {
        const latestVersion = await this.repository.getLatestVersion(platform)

        if (!latestVersion) {
            return {
                updatedCount: 0,
                outdatedCount: 0,
                unknownCount: 0,
                latestVersion: null,
            }
        }

        const rolloutStats = await this.repository.getRolloutStatsByVersionCode(latestVersion.versionCode)

        return {
            ...rolloutStats,
            latestVersion: {
                version: latestVersion.version,
                versionCode: latestVersion.versionCode,
            }
        }
    }

    /**
     * Upload new app version with APK file
     * If version/buildNumber/versionCode not provided, auto-extract from APK
     */
    async uploadVersion(input: UploadVersionInput): Promise<AppVersion> {
        let version = input.version
        let buildNumber = input.buildNumber
        let versionCode = input.versionCode
        let apkUrl: string | undefined
        let apkSize = input.apkSize
        let uploadedByService = false

        try {
            const uploadedApk = await this.loadUploadedApkDetails(input)

            if (uploadedApk.apkUrl) {
                apkUrl = uploadedApk.apkUrl
            }

            if (uploadedApk.apkSize !== undefined) {
                apkSize = uploadedApk.apkSize
            }

            if (input.apkBuffer || input.apkPath || uploadedApk.apkBuffer) {
                const apkInfo = await this.parseApkInfo({
                    ...(uploadedApk.apkBuffer ? { buffer: uploadedApk.apkBuffer } : {}),
                    ...(input.apkBuffer ? { buffer: input.apkBuffer } : {}),
                    ...(input.apkPath ? { path: input.apkPath } : {})
                })

                if (apkInfo) {
                    if (
                        (version && version !== apkInfo.versionName) ||
                        (buildNumber && buildNumber !== apkInfo.buildNumber) ||
                        (versionCode && versionCode !== apkInfo.versionCode)
                    ) {
                        throw new Error('Metadata versi tidak cocok dengan APK yang diupload')
                    }

                    version = version || apkInfo.versionName
                    buildNumber = buildNumber || apkInfo.buildNumber
                    versionCode = versionCode || apkInfo.versionCode
                } else {
                    throw new Error('Gagal membaca metadata APK yang diupload')
                }
            }

            // Validate required fields
            if (!version || !buildNumber || !versionCode) {
                throw new Error('Version, buildNumber, dan versionCode wajib diisi atau upload APK untuk auto-detect')
            }

            // Validate version doesn't already exist
            // console.log(`[AppVersionService] Checking if version ${version} (code ${versionCode}) already exists...`)
            const exists = await this.repository.exists(version, versionCode)
            if (exists.versionExists) {
                throw new Error(`Version ${version} sudah ada`)
            }
            if (exists.versionCodeExists) {
                throw new Error(`Version code ${versionCode} sudah ada`)
            }

            if (!input.uploadedKey && (input.apkBuffer || input.apkPath) && input.apkFilename) {
                apkUrl = await this.uploadApkFile({
                    ...(input.apkBuffer ? { buffer: input.apkBuffer } : {}),
                    ...(input.apkPath ? { path: input.apkPath } : {}),
                    filename: input.apkFilename,
                    version,
                    forceLocal: input.forceLocal
                })
                uploadedByService = true
            }

            // Create version record
            // console.log(`[AppVersionService] Creating version record in database...`)
            const createData: CreateAppVersionDTO = {
                version,
                buildNumber,
                versionCode,
                platform: input.platform || 'android',
                ...(apkUrl ? { apkUrl } : {}),
                ...(apkSize ? { apkSize: BigInt(apkSize) } : {}),
                ...(input.releaseNotes ? { releaseNotes: input.releaseNotes } : {}),
                isForceUpdate: input.isForceUpdate || false,
                ...(input.minVersion ? { minVersion: input.minVersion } : {}),
                isActive: true,
                publishedAt: new Date(),
                ...(input.createdBy ? { createdBy: input.createdBy } : {})
            }

            const result = await this.repository.create(createData)
            // console.log(`[AppVersionService] Version created successfully: ${result.id}`)
            return result
        } catch (error: unknown) {
            if (uploadedByService && apkUrl) {
                try {
                    await this.cleanupStoredApk(apkUrl)
                } catch (cleanupError) {
                    console.warn('Gagal membersihkan APK setelah create versi gagal:', cleanupError)
                }
            }
            console.error('[AppVersionService] Error in uploadVersion:', error)
            const err = error as { message?: string }
            // Re-throw with more context
            throw new Error(`Gagal mengunggah versi aplikasi: ${err?.message || 'Terjadi kesalahan'}`)
        }
    }

    /**
     * Upload APK file to storage (R2 or local)
     */
    /**
     * Upload APK file to storage (R2 or local)
     */
    private async uploadApkFile(input: {
        buffer?: Buffer,
        path?: string,
        filename: string,
        version: string,
        forceLocal?: boolean
    }): Promise<string> {
        const { buffer, path: filePath, version, forceLocal } = input
        const sanitizedFilename = `netmanager_v${version}.apk`

        try {
            // Check if R2 is enabled
            // console.log('[AppVersionService] Checking R2 storage status...')
            const r2Enabled = await isR2Enabled()
            // console.log(`[AppVersionService] R2 enabled: ${r2Enabled}`)

            if (r2Enabled && !forceLocal) {
                // Upload to R2
                // console.log('[AppVersionService] Uploading to R2 storage...')
                const key = generateR2Key('app-version', sanitizedFilename)
                // console.log(`[AppVersionService] R2 key: ${key}`)

                // Note: uploadToR2 currently expects buffer, assuming it can handle it or we might need to update it too.
                // For now, if we have path, read it to buffer (R2 Might limit this, but let's assume R2 client handles small chunks or we optimize later)
                // Ideally R2 client should support stream.
                let uploadBuffer = buffer
                if (!uploadBuffer && filePath) {
                    // Warning: Reading full file for R2 upload if R2 client doesn't support stream
                    // console.log(`[AppVersionService] Reading APK from path: ${filePath}`)
                    uploadBuffer = await fs.readFile(filePath)
                }

                if (!uploadBuffer) {
                    throw new Error('Konten APK tidak disediakan')
                }

                // console.log(`[AppVersionService] Uploading APK to R2 (${(uploadBuffer.length / 1024 / 1024).toFixed(2)}MB)`)
                const contentDisposition = `attachment; filename="${sanitizedFilename}"`
                const url = await uploadToR2(uploadBuffer, key, 'application/vnd.android.package-archive', contentDisposition)
                // console.log(`[AppVersionService] R2 upload successful: ${url}`)
                return url
            } else {
                // Save to local storage
                // Use 'public/uploads/apk' to ensure persistence (mounted volume)
                // console.log('[AppVersionService] Uploading to local storage...')
                const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'apk')
                // console.log(`[AppVersionService] Upload directory: ${uploadDir}`)
                await fs.mkdir(uploadDir, { recursive: true })

                const destPath = path.join(uploadDir, sanitizedFilename)
                // console.log(`[AppVersionService] Destination path: ${destPath}`)

                if (filePath) {
                    // Efficient copy/move
                    // console.log(`[AppVersionService] Copying file from ${filePath} to ${destPath}`)
                    await fs.copyFile(filePath, destPath)
                } else if (buffer) {
                    // console.log(`[AppVersionService] Writing buffer to ${destPath}`)
                    await fs.writeFile(destPath, buffer)
                } else {
                    throw new Error('Konten APK tidak disediakan (tidak ada buffer atau path)')
                }

                const url = `/uploads/apk/${sanitizedFilename}`
                // console.log(`[AppVersionService] Local upload successful: ${url}`)
                return url
            }
        } catch (error: unknown) {
            console.error('[AppVersionService] Error uploading APK file:', error)
            const err = error as { message?: string }
            throw new Error(`Gagal mengunggah file APK: ${err?.message || 'Terjadi kesalahan'}`)
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

        const updateData: UpdateAppVersionDTO = {
            ...data,
            ...(data.minVersion === undefined ? { minVersion: existing.minVersion } : {})
        }

        // Check for version conflicts if changing version or versionCode
        if (updateData.version && updateData.version !== existing.version) {
            const versionExists = await this.repository.findByVersion(updateData.version)
            if (versionExists) {
                throw new Error(`Version ${updateData.version} sudah ada`)
            }
        }

        if (updateData.versionCode && updateData.versionCode !== existing.versionCode) {
            const codeExists = await this.repository.findByVersionCode(updateData.versionCode)
            if (codeExists) {
                throw new Error(`Version code ${updateData.versionCode} sudah ada`)
            }
        }

        return this.repository.update(id, updateData)
    }

    /**
     * Soft delete version
     */
    async deleteVersion(id: string): Promise<void> {
        const existing = await this.repository.findById(id)
        if (!existing) {
            throw new Error('Versi tidak ditemukan')
        }

        // 1. Delete Physical File
        if (existing.apkUrl) {
            try {
                await this.cleanupStoredApk(existing.apkUrl)
            } catch (error) {
                console.error('Error deleting physical APK file:', error)
                // Continue to delete DB record even if file deletion fails
            }
        }

        // 2. Hard Delete DB Record
        try {
            await this.repository.delete(id)
        } catch (error) {
            if (isPrismaRecordNotFoundError(error)) {
                throw new Error('Versi tidak ditemukan')
            }

            throw error
        }
    }

    async evaluateVersionAccess(
        currentVersionCode: number,
        platform: string = 'android'
    ): Promise<VersionAccessResult> {
        const latestVersion = await this.repository.getLatestVersion(platform)

        if (!latestVersion) {
            return {
                isSupported: true,
                updateAvailable: false,
                isForceUpdate: false,
                currentVersion: '',
                currentVersionCode,
                minimumVersion: null,
                latestVersion: null
            }
        }

        const updateAvailable = latestVersion.versionCode > currentVersionCode

        let isForceUpdate = false
        if (updateAvailable && latestVersion.isForceUpdate) {
            isForceUpdate = true
        }

        if (updateAvailable && latestVersion.minVersion) {
            const minVersionCode = this.parseVersionToCode(latestVersion.minVersion)
            if (minVersionCode && currentVersionCode < minVersionCode) {
                isForceUpdate = true
            }
        }

        return {
            isSupported: !isForceUpdate,
            updateAvailable,
            isForceUpdate,
            currentVersion: latestVersion.version,
            currentVersionCode,
            minimumVersion: latestVersion.minVersion ?? null,
            latestVersion: updateAvailable ? this.mapLatestVersion(latestVersion) : null
        }
    }

    /**
     * Check for available update
     */
    async checkForUpdate(
        currentVersionCode: number,
        platform: string = 'android'
    ): Promise<CheckVersionResult> {
        const result = await this.evaluateVersionAccess(currentVersionCode, platform)

        return {
            updateAvailable: result.updateAvailable,
            isForceUpdate: result.isForceUpdate,
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion
        }
    }

    private mapLatestVersion(latestVersion: AppVersion): CheckVersionResult['latestVersion'] {
        return {
            id: latestVersion.id,
            version: latestVersion.version,
            buildNumber: latestVersion.buildNumber,
            versionCode: latestVersion.versionCode,
            releaseNotes: latestVersion.releaseNotes,
            downloadUrl: latestVersion.apkUrl ? (latestVersion.apkUrl.startsWith('http://') || latestVersion.apkUrl.startsWith('https://') ? latestVersion.apkUrl : `/api/mobile/app-version/download/${latestVersion.id}`) : null,
            apkSize: latestVersion.apkSize ? Number(latestVersion.apkSize) : null
        }
    }

    /**
     * Parse version string to version code (rough estimation)
     * e.g., "1.0.54" -> 10054
     */
    private parseVersionToCode(version: string): number | null {
        const parts = version.split('.')
        if (parts.length !== 3) return null

        const major = parseInt(parts[0] ?? '0', 10)
        const minor = parseInt(parts[1] ?? '0', 10)
        const patch = parseInt(parts[2] ?? '0', 10)

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
