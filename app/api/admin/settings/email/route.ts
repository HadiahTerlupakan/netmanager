import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { encryptApiKey, decryptApiKey } from '@/lib/utils/encryption'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('email:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan email')
        }

        // Get email settings from Settings table
        const settings = await prisma.settings.findMany({
            where: {
                key: {
                    in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_NAME', 'FROM_EMAIL']
                }
            }
        })

        const settingsMap: Record<string, string> = {}
        for (const setting of settings) {
            if (setting.key === 'SMTP_PASS' && setting.value) {
                try {
                    const decryptedPass = decryptApiKey(setting.value)
                    settingsMap[setting.key] = decryptedPass
                    console.log(`[Email Settings GET] Password loaded, length: ${decryptedPass.length}`)
                } catch (error) {
                    console.error('[Email Settings GET] Failed to decrypt password:', error)
                    settingsMap[setting.key] = 'DECRYPTION_ERROR'
                }
            } else {
                settingsMap[setting.key] = setting.value || ''
            }
        }

        return apiSuccess({
            smtpHost: settingsMap['SMTP_HOST'] || '',
            smtpPort: settingsMap['SMTP_PORT'] || '587',
            smtpuser: settingsMap['SMTP_USER'] || '',
            smtpPass: settingsMap['SMTP_PASS'] || '',
            fromName: settingsMap['FROM_NAME'] || '',
            fromEmail: settingsMap['FROM_EMAIL'] || ''
        })
    } catch (error: unknown) {
        console.error('Error fetching email settings:', error)
        return ApiErrors.internalError('Gagal mengambil pengaturan email')
    }
}

export async function PUT(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('email:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah pengaturan email')
        }

        const body = await request.json()
        const { smtpHost, smtpPort, smtpUser, smtpPass, fromName, fromEmail } = body

        // Prepare settings to save
        const settingsToSave = [
            { key: 'SMTP_HOST', value: smtpHost, encrypted: false },
            { key: 'SMTP_PORT', value: smtpPort, encrypted: false },
            { key: 'SMTP_USER', value: smtpUser, encrypted: false },
            { key: 'FROM_NAME', value: fromName, encrypted: false },
            { key: 'FROM_EMAIL', value: fromEmail, encrypted: false },
        ]

        // Only update password if provided (not empty)
        if (smtpPass) {
            const cleanedPass = smtpPass.trim().replace(/\s+/g, '')
            console.log(`[Email Settings] Saving password, length: ${cleanedPass.length}`)
            const encryptedPass = encryptApiKey(cleanedPass)
            settingsToSave.push({ key: 'SMTP_PASS', value: encryptedPass, encrypted: true })
        }

        for (const setting of settingsToSave) {
            await prisma.settings.upsert({
                where: { key: setting.key },
                create: {
                    id: randomUUID(),
                    key: setting.key,
                    value: setting.value,
                    encrypted: setting.encrypted,
                    description: `Email configuration: ${setting.key}`,
                    updatedAt: new Date()
                },
                update: {
                    value: setting.value,
                    encrypted: setting.encrypted,
                    updatedAt: new Date()
                }
            })
        }

        return apiSuccess(null, { message: 'Pengaturan email berhasil disimpan' })
    } catch (error: unknown) {
        console.error('Error saving email settings:', error)
        return ApiErrors.internalError('Gagal menyimpan pengaturan email')
    }
}
