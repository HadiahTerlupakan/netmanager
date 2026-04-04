import { prisma } from '@/modules/database'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import * as crypto from 'crypto'

export const dynamic = 'force-dynamic'

const SETTINGS_KEY = 'mixradius_fees'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)
    const permissions = await getUserPermissions(user.id)
    const hasAccess = isSuper || permissions.includes('*') || permissions.includes('mixradius:read')
    
    if (!hasAccess) return ApiErrors.forbidden()

    const setting = await prisma.settings.findFirst({ where: { key: SETTINGS_KEY }
    })

    const config = setting?.value ? JSON.parse(setting.value) : {}

    return apiSuccess(config)
})

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)
    const permissions = await getUserPermissions(user.id)
    const hasAccess = isSuper || permissions.includes('*') || permissions.includes('mixradius:read')

    if (!hasAccess) return ApiErrors.forbidden()

    const body = await req.json()

    const existing = await prisma.settings.findFirst({
        where: { key: SETTINGS_KEY }
    })
    
    let setting
    if (existing) {
        setting = await prisma.settings.update({
            where: { id: existing.id },
            data: {
                value: JSON.stringify(body),
                updatedAt: new Date()
            }
        })
    } else {
        setting = await prisma.settings.create({
            data: {
                id: crypto.randomUUID(),
                key: SETTINGS_KEY,
                value: JSON.stringify(body),
                description: 'Konfigurasi Fee Transaksi MixRadius (Payment Gateway)',
                encrypted: false,
                updatedAt: new Date()
            }
        })
    }

    return apiSuccess(JSON.parse(setting.value || '{}'), { message: 'Konfigurasi fee berhasil disimpan' })
})
