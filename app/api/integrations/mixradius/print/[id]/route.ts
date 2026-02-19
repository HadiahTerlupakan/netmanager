import { NextResponse } from 'next/server'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(user.id)
      const hasAccess = permissions.includes('mixradius:read') ||
                        permissions.includes('*')
      if (!hasAccess) {
        return new NextResponse('Akses ditolak: Anda tidak memiliki akses ke data MixRadius', { status: 403 })
      }
    }

    const { id } = ctx.params
    const service = getMixRadiusService()

    const { searchParams } = req.nextUrl
    const type = (searchParams.get('type') as 'standard' | 'thermal') || 'standard'

    const html = await service.getPrintInvoiceHtml(id, type)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
})
