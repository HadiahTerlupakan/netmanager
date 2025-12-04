// API for uploading payment proof images
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import crypto from 'crypto'
import sharp from 'sharp'
import FinanceAuthService from '@/lib/services/FinanceAuthService'
import { validateFileUpload, sanitizeString, checkValidationRateLimit } from '@/lib/validation/middleware'
import { createSuccessResponse, createFileUploadError, handleApiError, createAuthError } from '@/lib/utils/secure-error-handler'

// Store upload quotas per user (in production, use Redis)
const userUploadQuotas = new Map<string, { count: number; resetTime: number }>()
const DAILY_UPLOAD_LIMIT = 50
const DAILY_RESET_HOURS = 24

export async function POST(request: NextRequest) {
    try {
        // Authenticate user
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            return createAuthError()
        }

        const userId = authResult.user!.id
        const userIP = request.headers.get('x-forwarded-for') || 'unknown'

        // Check upload quota
        const quotaCheck = checkUserUploadQuota(userId)
        if (!quotaCheck.allowed) {
            return createFileUploadError('size', {
                maxSize: DAILY_UPLOAD_LIMIT,
                retryAfter: quotaCheck.hoursUntilReset
            })
        }

        // Rate limiting for upload attempts
        if (!checkValidationRateLimit(`upload:${userId}:${userIP}`, 20, 60000)) {
            return createFileUploadError('size', { retryAfter: 60 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return createFileUploadError('type')
        }

        // Sanitize filename
        const originalName = sanitizeString(file.name)
        if (!originalName || originalName.includes('../') || originalName.includes('..\\')) {
            return createFileUploadError('malicious')
        }

        // Enhanced file validation
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
        const maxSize = 5 * 1024 * 1024 // 5MB

        const validation = validateFileUpload(file, allowedTypes, maxSize)
        if (!validation.success) {
            return createFileUploadError(
                file.size > maxSize ? 'size' : 'type',
                { maxSize, allowedTypes }
            )
        }

        // Verify file extension matches content type
        const ext = path.extname(originalName).toLowerCase()
        if (!allowedExtensions.includes(ext)) {
            return createFileUploadError('type', { allowedTypes })
        }

        // Read file for content verification
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Verify image content using Sharp
        try {
            const metadata = await sharp(buffer).metadata()

            // Additional image validation
            if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
                return createFileUploadError('malicious')
            }

            // Validate image dimensions (prevent extremely large images)
            if (metadata.width && metadata.height) {
                const maxDimension = 4096
                if (metadata.width > maxDimension || metadata.height > maxDimension) {
                    return createFileUploadError('size', {
                        maxSize: `${maxDimension}x${maxDimension} pixels`
                    })
                }

                // Minimum dimension check
                const minDimension = 100
                if (metadata.width < minDimension || metadata.height < minDimension) {
                    return createFileUploadError('type', {
                        allowedTypes: 'Images must be at least 100x100 pixels'
                    })
                }
            }

            // Check for malicious patterns in image metadata
            if (metadata.exif) {
                // Basic EXIF validation - remove potentially sensitive data
                const cleanedBuffer = await sharp(buffer)
                    .withMetadata({ exif: undefined })
                    .toBuffer()

                // Calculate hash for integrity check
                const fileHash = crypto.createHash('sha256').update(cleanedBuffer).digest('hex')

                // Save processed file
                const savedFile = await saveSecureFile(cleanedBuffer, originalName, ext, userId)

                // Update user quota
                updateUserUploadQuota(userId)

                return createSuccessResponse({
                    success: true,
                    url: savedFile.relativePath,
                    filename: savedFile.filename,
                    size: cleanedBuffer.length,
                    hash: fileHash,
                    metadata: {
                        width: metadata.width,
                        height: metadata.height,
                        format: metadata.format
                    }
                }, 'File uploaded successfully')

            } else {
                // No EXIF data, process normally
                const fileHash = crypto.createHash('sha256').update(buffer).digest('hex')
                const savedFile = await saveSecureFile(buffer, originalName, ext, userId)

                updateUserUploadQuota(userId)

                return createSuccessResponse({
                    success: true,
                    url: savedFile.relativePath,
                    filename: savedFile.filename,
                    size: buffer.length,
                    hash: fileHash,
                    metadata: {
                        width: metadata.width,
                        height: metadata.height,
                        format: metadata.format
                    }
                }, 'File uploaded successfully')
            }

        } catch (imageError) {
            console.error('Image processing error:', imageError)
            return createFileUploadError('malicious')
        }

    } catch (error) {
        return handleApiError(error, {
            method: 'POST',
            url: request.url,
            ip: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent')
        })
    }
}

/**
 * Securely save file with proper directory structure and naming
 */
async function saveSecureFile(buffer: Buffer, originalName: string, ext: string, userId: string): Promise<{
    relativePath: string
    filename: string
}> {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    // Create secure directory structure
    const uploadDir = path.join(
        process.cwd(),
        'public',
        'uploads',
        'payment-proofs',
        String(year),
        month,
        day
    )

    // Create directory if it doesn't exist
    if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
    }

    // Generate secure filename
    const timestamp = now.getTime()
    const userHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8)
    const randomStr = crypto.randomBytes(8).toString('hex')
    const filename = `proof_${timestamp}_${userHash}_${randomStr}${ext}`

    const filepath = path.join(uploadDir, filename)
    await writeFile(filepath, buffer)

    // Calculate relative path for database storage
    const relativePath = `/uploads/payment-proofs/${year}/${month}/${day}/${filename}`

    return { relativePath, filename }
}

/**
 * Check if user has exceeded daily upload quota
 */
function checkUserUploadQuota(userId: string): { allowed: boolean; hoursUntilReset?: number } {
    const now = Date.now()
    const userQuota = userUploadQuotas.get(userId)

    if (!userQuota || now > userQuota.resetTime) {
        // Reset quota
        userUploadQuotas.set(userId, {
            count: 0,
            resetTime: now + (DAILY_RESET_HOURS * 60 * 60 * 1000)
        })
        return { allowed: true }
    }

    if (userQuota.count >= DAILY_UPLOAD_LIMIT) {
        const hoursUntilReset = Math.ceil((userQuota.resetTime - now) / (60 * 60 * 1000))
        return { allowed: false, hoursUntilReset }
    }

    return { allowed: true }
}

/**
 * Update user's upload quota
 */
function updateUserUploadQuota(userId: string): void {
    const userQuota = userUploadQuotas.get(userId)
    if (userQuota) {
        userQuota.count++
    }
}
