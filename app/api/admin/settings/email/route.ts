import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { encryptApiKey, decryptApiKey } from '@/lib/utils/encryption'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { logger } from '@/lib/logger'

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId

    // Permission check
    if (!await hasPermission('email:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan email')
    }

    // Get email settings from Settings table
    const settings = await prisma.settings.findMany({
        where: {
            tenantId,
            key: {
                in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_NAME', 'FROM_EMAIL']
            }
        }
    })

    const settingsMap: Record<string, string> = {}
    for (const setting of settings) {
        if (setting.key === 'SMTP_PASS' && setting.value && setting.encrypted) {
            try {
                const decryptedPass = decryptApiKey(setting.value)
                settingsMap[setting.key] = decryptedPass
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
        smtpUser: settingsMap['SMTP_USER'] || '',
        smtpPass: settingsMap['SMTP_PASS'] || '',
        fromName: settingsMap['FROM_NAME'] || '',
        fromEmail: settingsMap['FROM_EMAIL'] || ''
    })
})

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    const tenantId = ctx.session!.user.tenantId

    // Permission check
    if (!await hasPermission('email:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah pengaturan email')
    }

    const body = await req.json()
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
        const encryptedPass = encryptApiKey(cleanedPass)
        settingsToSave.push({ key: 'SMTP_PASS', value: encryptedPass, encrypted: true })
    }

    for (const setting of settingsToSave) {
        const existing = await prisma.settings.findFirst({
            where: {
                key: setting.key,
                tenantId
            }
        })
        if (existing) {
            await prisma.settings.update({
                where: { id: existing.id },
                data: {
                    value: setting.value,
                    encrypted: setting.encrypted,
                    updatedAt: new Date()
                }
            })
        } else {
            await prisma.settings.create({
                data: {
                    id: randomUUID(),
                    key: setting.key,
                    value: setting.value,
                    encrypted: setting.encrypted,
                    tenantId,
                    description: `Email configuration: ${setting.key}`,
                    updatedAt: new Date()
                }
            })
        }
    }

    await logger.logActivity({
        action: 'UPDATE',
        subject: 'Email Settings',
        details: {
            smtpHost,
            smtpPort,
            smtpUser,
            fromName,
            fromEmail,
            updatedFields: settingsToSave.map(s => s.key)
        },
        userId: ctx.session!.user.id
    })

    return apiSuccess(null, { message: 'Pengaturan email berhasil disimpan' })
})
