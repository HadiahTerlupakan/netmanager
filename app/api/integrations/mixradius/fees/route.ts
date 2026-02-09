import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import * as crypto from 'crypto'

export const dynamic = 'force-dynamic'

const SETTINGS_KEY = 'mixradius_fees'

// GET - Retrieve fee configuration
export async function GET(req: NextRequest) {
    try {
        const session = await verifyAuth(req)
        if (!session) return ApiErrors.unauthorized()

        const permissions = await getUserPermissions(session.id)
        const hasAccess = session.isSuperAdmin || permissions.includes('*') || permissions.includes('mixradius:read')
        
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

        const permissions = await getUserPermissions(session.id)
        const hasAccess = session.isSuperAdmin || permissions.includes('*') || permissions.includes('mixradius:read')

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
                encrypted: false,
                updatedAt: new Date()
            }
        })

        return apiSuccess(JSON.parse(setting.value || '{}'), { message: 'Konfigurasi fee berhasil disimpan' })

    } catch (error) {
        console.error('Error saving fees:', error)
        return ApiErrors.internalError('Gagal menyimpan konfigurasi fee')
    }
}
