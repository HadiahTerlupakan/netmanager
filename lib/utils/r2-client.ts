import { S3Client, PutObjectCommand, HeadBucketCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { prisma } from '@/lib/prisma'

// R2 Settings interface
export interface R2Settings {
    accountId: string
    accessKeyId: string
    secretAccessKey: string
    bucketName: string
    publicUrl: string
    enabled: boolean
}

// Cache for R2 settings
let r2SettingsCache: R2Settings | null = null
let r2SettingsCacheTime: number = 0
const R2_SETTINGS_CACHE_TTL = 60000 // 1 minute cache

/**
 * Get R2 settings from database
 */
export async function getR2Settings(): Promise<R2Settings | null> {
    // Check cache first
    if (r2SettingsCache && Date.now() - r2SettingsCacheTime < R2_SETTINGS_CACHE_TTL) {
        return r2SettingsCache
    }

    try {
        const settings = await prisma.settings.findMany({
            where: {
                key: {
                    in: [
                        'R2_ACCOUNT_ID',
                        'R2_ACCESS_KEY_ID',
                        'R2_SECRET_ACCESS_KEY',
                        'R2_BUCKET_NAME',
                        'R2_PUBLIC_URL',
                        'R2_ENABLED'
                    ]
                }
            }
        })

        const settingsMap = new Map(settings.map(s => [s.key, s.value]))

        // Check if all required settings are present
        const accountId = settingsMap.get('R2_ACCOUNT_ID')
        const accessKeyId = settingsMap.get('R2_ACCESS_KEY_ID')
        const secretAccessKey = settingsMap.get('R2_SECRET_ACCESS_KEY')
        const bucketName = settingsMap.get('R2_BUCKET_NAME')
        const publicUrl = settingsMap.get('R2_PUBLIC_URL')
        const enabled = settingsMap.get('R2_ENABLED')

        if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
            return null
        }

        const r2Settings: R2Settings = {
            accountId,
            accessKeyId,
            secretAccessKey,
            bucketName,
            publicUrl: publicUrl || '',
            enabled: enabled === 'true'
        }

        // Update cache
        r2SettingsCache = r2Settings
        r2SettingsCacheTime = Date.now()

        return r2Settings
    } catch (error) {
        console.error('Error fetching R2 settings:', error)
        return null
    }
}

/**
 * Clear R2 settings cache
 */
export function clearR2SettingsCache(): void {
    r2SettingsCache = null
    r2SettingsCacheTime = 0
}

/**
 * Check if R2 storage is enabled and properly configured
 */
export async function isR2Enabled(): Promise<boolean> {
    const settings = await getR2Settings()
    return settings?.enabled === true
}

/**
 * Get configured S3 client for Cloudflare R2
 */
export async function getR2Client(): Promise<S3Client | null> {
    const settings = await getR2Settings()

    if (!settings || !settings.enabled) {
        return null
    }

    const client = new S3Client({
        region: 'auto',
        endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: settings.accessKeyId,
            secretAccessKey: settings.secretAccessKey,
        },
    })

    return client
}

/**
 * Test R2 connection with given credentials
 */
export async function testR2Connection(settings: Omit<R2Settings, 'enabled'>): Promise<{ success: boolean; error?: string }> {
    try {
        const client = new S3Client({
            region: 'auto',
            endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: settings.accessKeyId,
                secretAccessKey: settings.secretAccessKey,
            },
        })

        // Try to head the bucket to verify access
        await client.send(new HeadBucketCommand({
            Bucket: settings.bucketName
        }))

        return { success: true }
    } catch (error: any) {
        console.error('R2 connection test failed:', error)

        let errorMessage = 'Koneksi ke R2 gagal'
        if (error.name === 'NoSuchBucket') {
            errorMessage = 'Bucket tidak ditemukan'
        } else if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
            errorMessage = 'Akses ditolak. Periksa kredensial Anda.'
        } else if (error.name === 'InvalidAccessKeyId') {
            errorMessage = 'Access Key ID tidak valid'
        } else if (error.name === 'SignatureDoesNotMatch') {
            errorMessage = 'Secret Access Key tidak valid'
        } else if (error.message) {
            errorMessage = error.message
        }

        return { success: false, error: errorMessage }
    }
}

/**
 * Upload file to R2 bucket
 * @param buffer File buffer to upload
 * @param key Object key (path in bucket)
 * @param contentType MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(
    buffer: Buffer,
    key: string,
    contentType: string
): Promise<string> {
    const settings = await getR2Settings()

    if (!settings || !settings.enabled) {
        throw new Error('R2 storage is not enabled')
    }

    const client = await getR2Client()
    if (!client) {
        throw new Error('Failed to create R2 client')
    }

    try {
        // Use Upload for better handling of larger files
        const upload = new Upload({
            client,
            params: {
                Bucket: settings.bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            },
        })

        await upload.done()

        // Return the public URL
        if (settings.publicUrl) {
            // Custom domain or R2.dev URL
            return `${settings.publicUrl.replace(/\/$/, '')}/${key}`
        } else {
            // Default R2.dev URL
            return `https://${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com/${key}`
        }
    } catch (error: any) {
        console.error('Error uploading to R2:', error)
        throw new Error(`Gagal mengupload file ke R2: ${error.message}`)
    }
}

/**
 * Delete file from R2 bucket
 * @param key Object key to delete
 */
export async function deleteFromR2(key: string): Promise<boolean> {
    const client = await getR2Client()
    const settings = await getR2Settings()

    if (!client || !settings) {
        return false
    }

    try {
        await client.send(new DeleteObjectCommand({
            Bucket: settings.bucketName,
            Key: key
        }))
        return true
    } catch (error) {
        console.error('Error deleting from R2:', error)
        return false
    }
}

/**
 * Generate upload key for different upload types
 */
export function generateR2Key(
    type: 'pelanggan' | 'payment-proofs' | 'logos' | 'kmz',
    filename: string,
    subFolder?: string
): string {
    const timestamp = Date.now()
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')

    switch (type) {
        case 'pelanggan':
            if (subFolder) {
                return `uploads/pelanggan/${subFolder}/${timestamp}-${sanitizedFilename}`
            }
            return `uploads/pelanggan/${timestamp}-${sanitizedFilename}`
        case 'payment-proofs':
            return `uploads/payment-proofs/${timestamp}-${sanitizedFilename}`
        case 'logos':
            return `uploads/logos/${timestamp}-${sanitizedFilename}`
        case 'kmz':
            return `uploads/kmz/${timestamp}-${sanitizedFilename}`
        default:
            return `uploads/${timestamp}-${sanitizedFilename}`
    }
}
