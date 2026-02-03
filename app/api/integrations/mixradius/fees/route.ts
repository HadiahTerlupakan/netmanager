import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

const SETTINGS_KEY = 'mixradius_fees'

// GET - Retrieve fee configuration
export async function GET(req: NextRequest) {
    try {
        const session = await verifyAuth(req)
        if (!session) return ApiErrors.unauthorized()

        const hasAccess = (await getUserPermissions(session.id)).includes('mixradius:read')
        if (!hasAccess) return ApiErrors.forbidden()

        const setting = await prisma.settings.findUnique({
            where: { key: SETTINGS_KEY }
        })

        const config = setting?.value ? JSON.parse(setting.value) : {}

        return apiSuccess(config)
    } catch (error) {
        console.error('Error fetching fees:', error)
        return ApiErrors.internalError('Gagal mengambil konfigurasi fee')
    }
}

// POST - Save fee configuration
export async function POST(req: NextRequest) {
    try {
        const session = await verifyAuth(req)
        if (!session) return ApiErrors.unauthorized()

        const hasAccess = (await getUserPermissions(session.id)).includes('mixradius:read') // Assuming read access is enough or check for update
        // Better to check for settings update permission if available, but stick to mixradius context
        if (!hasAccess) return ApiErrors.forbidden()

        const body = await req.json()

        // Upsert the settings
        const setting = await prisma.settings.upsert({
            where: { key: SETTINGS_KEY },
            update: {
                value: JSON.stringify(body),
                updatedAt: new Date()
            },
            create: {
                id: crypto.randomUUID(),
                key: SETTINGS_KEY,
                value: JSON.stringify(body),
                description: 'Konfigurasi Fee Transaksi MixRadius (Payment Gateway)',
                encrypted: false
            }
        })

        return apiSuccess(JSON.parse(setting.value || '{}'), { message: 'Konfigurasi fee berhasil disimpan' })

    } catch (error) {
        console.error('Error saving fees:', error)
        return ApiErrors.internalError('Gagal menyimpan konfigurasi fee')
    }
}
