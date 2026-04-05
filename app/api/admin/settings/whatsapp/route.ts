import { encryptApiKey } from '@/lib/utils/encryption'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { getTenantSettingsMap, upsertTenantSettings } from '@/modules/settings'

const WHATSAPP_SETTINGS_FIELDS = [
    { key: 'WHATSAPP_PROVIDER', defaultValue: 'WABLAS' },
    { key: 'WHATSAPP_API_KEY', defaultValue: '', decryptValue: true },
    { key: 'WABLAS_DOMAIN', defaultValue: '' },
    { key: 'WABLAS_DEVICE_ID', defaultValue: '' },
] as const

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId

    if (!await hasPermission('whatsapp:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan WhatsApp')
    }

    const settingsMap = await getTenantSettingsMap(tenantId, WHATSAPP_SETTINGS_FIELDS)

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

    await upsertTenantSettings(
        tenantId,
        settingsToSave.map((setting) => ({
            key: setting.key,
            value: setting.value,
            encrypted: setting.encrypted,
            description: `WhatsApp configuration: ${setting.key}`,
        }))
    )

    return apiSuccess(null, { message: 'Pengaturan WhatsApp berhasil disimpan' })
})
