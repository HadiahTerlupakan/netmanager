import { hasPermission } from '@/lib/rbac'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { mikrotikRouterUpdateSchema } from '@/lib/validations/mikrotik'
import { logActivitySafe } from '@/lib/logger'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    const tenantId = ctx.session!.user.tenantId;
    const routerRepository = getMikroTikRouterRepository()
    const router = await routerRepository.findById(id, tenantId)
    
    if (!router) {
        return ApiErrors.notFound('Router')
    }

    const user = ctx.session!.user
    const isRestricted = (await hasPermission("mikrotik:site_only")) && user.role !== 'SUPER_ADMIN'
    
    if (isRestricted) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
        const userSiteId = dbUser?.siteId

        if (!userSiteId || router.siteId !== userSiteId) {
            return ApiErrors.forbidden('Akses ditolak')
        }
    }

    return apiSuccess({ router })
})

export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    const body = await req.json()
    
    const parsed = mikrotikRouterUpdateSchema.safeParse(body)
    if (!parsed.success) {
        return apiError('Data tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400, details: parsed.error.flatten() })
    }
    const data = parsed.data
    const user = ctx.session!.user
    const tenantId = user.tenantId;

    try {
        const routerRepository = getMikroTikRouterRepository()
        const existingRouter = await routerRepository.findById(id, tenantId)
        if (!existingRouter) {
            return ApiErrors.notFound('Router')
        }

        const isRestricted = (await hasPermission("mikrotik:site_only")) && user.role !== 'SUPER_ADMIN'
        if (isRestricted) {
            const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
            const userSiteId = dbUser?.siteId

            if (!userSiteId || existingRouter.siteId !== userSiteId) {
                return ApiErrors.forbidden('Akses ditolak')
            }
            // Force siteId to remain unchanged or set to user's site
            data.siteId = userSiteId
        }

        const updateData: Record<string, unknown> = {}
        if (data.name) updateData.name = data.name
        if (data.ipAddress) updateData.ipAddress = data.ipAddress
        if (data.timezone !== undefined) updateData.timezone = data.timezone
        if (data.apiPort !== undefined) updateData.apiPort = data.apiPort
        if (data.apiUsername !== undefined) updateData.apiUsername = data.apiUsername
        if (data.apiPassword !== undefined) updateData.apiPassword = data.apiPassword
        if (data.authPort !== undefined) updateData.authPort = data.authPort
        if (data.accountingPort !== undefined) updateData.accountingPort = data.accountingPort
        if (data.secretRadius !== undefined) updateData.secretRadius = data.secretRadius
        if (data.isolirUrl !== undefined) updateData.isolirUrl = data.isolirUrl
        if (data.description !== undefined) updateData.description = data.description
        if (data.siteId !== undefined) updateData.siteId = data.siteId
        updateData.tenantId = tenantId

        await routerRepository.update(id, updateData, tenantId)

        // System Log
        logActivitySafe({
            action: 'UPDATE',
            subject: 'MikroTik Router',
            userId: user.id,
            details: { id, changes: data }
        })

        return apiSuccess({ success: true })
    } catch (_e: unknown) {
        return apiError('Gagal mengupdate router atau IP Address sudah terpakai', ErrorCodes.CONFLICT, { status: 409 })
    }
})

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    const user = ctx.session!.user
    const tenantId = user.tenantId;

    try {
        const routerRepository = getMikroTikRouterRepository()
        const router = await routerRepository.findById(id, tenantId)
        
        if (router) {
             const isRestricted = (await hasPermission("mikrotik:site_only")) && user.role !== 'SUPER_ADMIN'
             if (isRestricted) {
                const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
                const userSiteId = dbUser?.siteId

                if (!userSiteId || router.siteId !== userSiteId) {
                    return ApiErrors.forbidden('Akses ditolak')
                }
            }

             // Auto Deprovisioning
             try {
                const { MikroTikProvisioningService } = await import('@/modules/network/services/MikroTikProvisioningService');
                const provisioningService = new MikroTikProvisioningService();
                
                // console.log(`Deprovisioning router ${router.ipAddress}...`);
                const result = await provisioningService.deprovisionRadius(
                    {
                        ip: router.ipAddress,
                        port: router.apiPort,
                        username: router.apiUsername,
                        password: router.apiPassword,
                    },
                    process.env.RADIUS_PUBLIC_IP || null, // IP publik RADIUS server
                    router.isolirUrl
                );
                if (!result.success) {
                    console.warn(`Deprovisioning failed: ${result.logs.join(', ')}`);
                } else {
                    // console.log(`Deprovisioning success: ${result.logs.join(', ')}`);
                }
             } catch (e) {
                 console.error('Failed to auto-deprovision:', e);
             }
        }

        await routerRepository.delete(id, tenantId)

        // System Log
        logActivitySafe({
            action: 'DELETE',
            subject: 'MikroTik Router',
            userId: user.id,
            details: { id }
        })

        return apiSuccess({ success: true })
    } catch (_e: unknown) {
        return apiError('Gagal menghapus router', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
})
