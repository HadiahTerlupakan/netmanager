import { AppVersionRepository, type AppVersion, type CreateAppVersionDTO, type UpdateAppVersionDTO, type AppVersionWithUser } from '../repositories/AppVersionRepository'
import { isR2Enabled, uploadToR2, generateR2Key, deleteFromR2 } from '@/lib/utils/r2-client'
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

    /**
     * Upload new app version with APK file
     * If version/buildNumber/versionCode not provided, auto-extract from APK
     */
    async uploadVersion(input: UploadVersionInput): Promise<AppVersion> {
        let version = input.version
        let buildNumber = input.buildNumber
        let versionCode = input.versionCode

        try {
            // Auto-parse APK jika ada APK dan version info tidak lengkap (Hanya jika APK diupload via server)
            if ((input.apkBuffer || input.apkPath) && (!version || !buildNumber || !versionCode)) {
                // console.log('[AppVersionService] Parsing APK for version info...')
                const apkInfo = await this.parseApkInfo({
                    ...(input.apkBuffer ? { buffer: input.apkBuffer } : {}),
                    ...(input.apkPath ? { path: input.apkPath } : {})
                })
                if (apkInfo) {
                    version = version || apkInfo.versionName
                    buildNumber = buildNumber || apkInfo.buildNumber
                    versionCode = versionCode || apkInfo.versionCode
                    // console.log(`[AppVersionService] Auto-extracted from APK: v${version}, build ${buildNumber}, code ${versionCode}`)
                } else {
                    console.warn('[AppVersionService] Failed to parse APK info, using manual values if provided')
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

            let apkUrl: string | undefined
            let apkSize = input.apkSize

            // Scenario 1: Pre-uploaded file (Direct Upload)
            if (input.uploadedKey) {
                // console.log(`[AppVersionService] Using pre-uploaded file: ${input.uploadedKey}`)

                // Construct public URL
                const settings = await import('@/lib/utils/r2-client').then(m => m.getR2Settings())
                if (settings && settings.publicUrl) {
                    apkUrl = `${settings.publicUrl.replace(/\/$/, '')}/${input.uploadedKey}`
                } else if (settings) {
                    apkUrl = `https://${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com/${input.uploadedKey}`
                } else {
                    // Fallback purely based on key if settings fail (shouldn't happen if R2 enabled)
                    apkUrl = input.uploadedKey
                }

                if (input.uploadedSize) {
                    apkSize = input.uploadedSize
                }
            }
            // Scenario 2: Server-side Upload (Legacy/Fallback)
            else if ((input.apkBuffer || input.apkPath) && input.apkFilename) {
                // console.log(`[AppVersionService] Uploading APK file: ${input.apkFilename}`)
                apkUrl = await this.uploadApkFile({
                    ...(input.apkBuffer ? { buffer: input.apkBuffer } : {}),
                    ...(input.apkPath ? { path: input.apkPath } : {}),
                    filename: input.apkFilename,
                    version,
                    forceLocal: input.forceLocal
                })
                // console.log(`[AppVersionService] APK uploaded successfully: ${apkUrl}`)
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
    async deleteVersion(id: string): Promise<void> {
        const existing = await this.repository.findById(id)
        if (!existing) {
            throw new Error('Versi tidak ditemukan')
        }

        // 1. Delete Physical File
        if (existing.apkUrl) {
            try {
                // Cek apakah file lokal
                if (existing.apkUrl.startsWith('/apk/')) {
                    const localPath = path.join(process.cwd(), 'public', existing.apkUrl)
                    try {
                        await fs.unlink(localPath)
                        // console.log(`Deleted local APK: ${localPath}`)
                    } catch (err: unknown) {
                        const error = err as { message?: string }
                        console.warn(`Failed to delete local APK: ${error.message}`)
                    }
                }
                // Cek apakah file R2 (mengandung uploads/apk/)
                else if (existing.apkUrl.includes('uploads/apk/')) {
                    // Extract key from URL
                    // Key format: uploads/apk/timestamp-filename.apk
                    // URL format: https://domain.com/uploads/apk/timestamp-filename.apk
                    const keyIndex = existing.apkUrl.indexOf('uploads/apk/')
                    if (keyIndex !== -1) {
                        const key = existing.apkUrl.substring(keyIndex)
                        const deleted = await deleteFromR2(key)
                        if (deleted) {
                            // console.log(`Deleted R2 object: ${key}`)
                        } else {
                            console.warn(`Failed to delete R2 object: ${key}`)
                        }
                    }
                }
            } catch (error) {
                console.error('Error deleting physical APK file:', error)
                // Continue to delete DB record even if file deletion fails
            }
        }

        // 2. Hard Delete DB Record
        await this.repository.delete(id)
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
                downloadUrl: latestVersion.apkUrl ? (latestVersion.apkUrl.startsWith("http://") || latestVersion.apkUrl.startsWith("https://") ? latestVersion.apkUrl : `/api/mobile/app-version/download/${latestVersion.id}`) : null,
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
