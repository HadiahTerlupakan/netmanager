import { encryptApiKey } from '@/lib/utils/encryption'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getTenantSettingsMap, upsertTenantSettings } from '@/modules/settings'

const EMAIL_SETTINGS_FIELDS = [
    { key: 'SMTP_HOST', defaultValue: '' },
    { key: 'SMTP_PORT', defaultValue: '587' },
    { key: 'SMTP_USER', defaultValue: '' },
    { key: 'SMTP_PASS', defaultValue: '', decryptValue: true },
    { key: 'FROM_NAME', defaultValue: '' },
    { key: 'FROM_EMAIL', defaultValue: '' },
] as const

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId

    // Permission check
    if (!await hasPermission('email:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan email')
    }

    const settingsMap = await getTenantSettingsMap(tenantId, EMAIL_SETTINGS_FIELDS)

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

    await upsertTenantSettings(
        tenantId,
        settingsToSave.map((setting) => ({
            key: setting.key,
            value: setting.value,
            encrypted: setting.encrypted,
            description: `Email configuration: ${setting.key}`,
        }))
    )

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
