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
    } catch (error: any) {
        console.error('Error fetching WhatsApp settings:', error)
        return ApiErrors.internalError('Gagal mengambil pengaturan WhatsApp')
    }
}

export async function PUT(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('whatsapp:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah pengaturan WhatsApp')
        }

        const body = await request.json()
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

        // Save all settings using upsert
        for (const setting of settingsToSave) {
            await prisma.settings.upsert({
                where: { key: setting.key },
                update: { value: setting.value, updatedAt: new Date() },
                create: {
                    id: randomUUID(),
                    key: setting.key,
                    value: setting.value,
                    updatedAt: new Date()
                }
            })
        }

        console.log('[WhatsApp Settings] Saved configuration:', whatsappProvider)

        return apiSuccess(null, { message: 'Pengaturan WhatsApp berhasil disimpan' })
    } catch (error: any) {
        console.error('Error saving WhatsApp settings:', error)
        return ApiErrors.internalError('Gagal menyimpan pengaturan WhatsApp')
    }
}
