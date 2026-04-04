import { randomUUID } from 'crypto'
import { prisma } from '@/modules/database'
import { encryptApiKey, decryptApiKey } from '@/lib/utils/encryption'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId

    if (!await hasPermission('whatsapp:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan WhatsApp')
    }

    // Get WhatsApp settings from Settings table
    const settings = await prisma.settings.findMany({
        where: {
            tenantId,
            key: {
                in: ['WHATSAPP_PROVIDER', 'WHATSAPP_API_KEY', 'WABLAS_DOMAIN', 'WABLAS_DEVICE_ID']
            }
        }
    })

    const settingsMap: Record<string, string> = {}
    for (const setting of settings) {
        if (setting.key === 'WHATSAPP_API_KEY' && setting.value && setting.encrypted) {
            try {
                settingsMap[setting.key] = decryptApiKey(setting.value)
            } catch (error) {
                console.error('[WhatsApp Settings GET] Failed to decrypt API key:', error)
                settingsMap[setting.key] = ''
            }
        } else {
            settingsMap[setting.key] = setting.value || ''
        }
    }

    return apiSuccess({
        whatsappProvider: settingsMap['WHATSAPP_PROVIDER'] || 'WABLAS',
        whatsappApiKey: settingsMap['WHATSAPP_API_KEY'] || '',
        whatsappDeviceId: settingsMap['WABLAS_DEVICE_ID'] || '',
        whatsappDomain: settingsMap['WABLAS_DOMAIN'] || ''
    })
})

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    const tenantId = ctx.session!.user.tenantId

    if (!await hasPermission('whatsapp:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah pengaturan WhatsApp')
    }

    const body = await req.json()
    const { whatsappProvider, whatsappApiKey, whatsappDeviceId, whatsappDomain } = body

    // Prepare settings to save
    const settingsToSave: Array<{ key: string, value: string, encrypted: boolean }> = []

    // Provider
    if (whatsappProvider) {
        settingsToSave.push({ key: 'WHATSAPP_PROVIDER', value: whatsappProvider, encrypted: false })
    }

    // API Key (encrypt before saving)
    if (whatsappApiKey) {
        const encryptedKey = encryptApiKey(whatsappApiKey.trim())
        settingsToSave.push({ key: 'WHATSAPP_API_KEY', value: encryptedKey, encrypted: true })
    }

    // Device ID (for Wablas)
    if (whatsappDeviceId) {
        settingsToSave.push({ key: 'WABLAS_DEVICE_ID', value: whatsappDeviceId.trim(), encrypted: false })
    }

    // Domain (for Wablas)
    if (whatsappDomain) {
        settingsToSave.push({ key: 'WABLAS_DOMAIN', value: whatsappDomain.trim(), encrypted: false })
    }

    // Save all settings using findFirst + create/update
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
                    description: `WhatsApp configuration: ${setting.key}`,
                    updatedAt: new Date()
                }
            })
        }
    }

    return apiSuccess(null, { message: 'Pengaturan WhatsApp berhasil disimpan' })
})
