import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { encryptApiKey, decryptApiKey } from '@/lib/utils/encryption'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    if (!await hasPermission('whatsapp:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan WhatsApp')
    }

    // Get WhatsApp settings from Settings table
    const settings = await prisma.settings.findMany({
        where: {
            key: {
                in: ['WHATSAPP_PROVIDER', 'WHATSAPP_API_KEY', 'WABLAS_DOMAIN', 'WABLAS_DEVICE_ID']
            }
        }
    })

    const settingsMap: Record<string, string> = {}
    for (const setting of settings) {
        if (setting.key === 'WHATSAPP_API_KEY' && setting.value) {
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

export const PUT = createHandler({ auth: true }, async (req, _ctx) => {
    if (!await hasPermission('whatsapp:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah pengaturan WhatsApp')
    }

    const body = await req.json()
    const { whatsappProvider, whatsappApiKey, whatsappDeviceId, whatsappDomain } = body

    // Prepare settings to save
    const settingsToSave: Array<{ key: string, value: string }> = []

    // Provider
    if (whatsappProvider) {
        settingsToSave.push({ key: 'WHATSAPP_PROVIDER', value: whatsappProvider })
    }

    // API Key (encrypt before saving)
    if (whatsappApiKey) {
        const encryptedKey = encryptApiKey(whatsappApiKey.trim())
        settingsToSave.push({ key: 'WHATSAPP_API_KEY', value: encryptedKey })
    }

    // Device ID (for Wablas)
    if (whatsappDeviceId) {
        settingsToSave.push({ key: 'WABLAS_DEVICE_ID', value: whatsappDeviceId.trim() })
    }

    // Domain (for Wablas)
    if (whatsappDomain) {
        settingsToSave.push({ key: 'WABLAS_DOMAIN', value: whatsappDomain.trim() })
    }

    // Save all settings using findFirst + create/update
    for (const setting of settingsToSave) {
        const existing = await prisma.settings.findFirst({
            where: { key: setting.key }
        })
        if (existing) {
            await prisma.settings.update({
                where: { id: existing.id },
                data: { value: setting.value, updatedAt: new Date() }
            })
        } else {
            await prisma.settings.create({
                data: {
                    id: randomUUID(),
                    key: setting.key,
                    value: setting.value,
                    updatedAt: new Date()
                }
            })
        }
    }

    return apiSuccess(null, { message: 'Pengaturan WhatsApp berhasil disimpan' })
})
