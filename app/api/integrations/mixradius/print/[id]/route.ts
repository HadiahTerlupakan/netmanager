import { NextRequest, NextResponse } from 'next/server'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) {
      return new NextResponse('Tidak terautentikasi', { status: 401 })
    }

    // Permission check
    const user = session as { id: string; role?: string; isSuperAdmin?: boolean }
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(user.id)
      const hasAccess = permissions.includes('mixradius:read') ||
                        permissions.includes('*')
      if (!hasAccess) {
        return new NextResponse('Akses ditolak: Anda tidak memiliki akses ke data MixRadius', { status: 403 })
      }
    }

    const { id } = await params
    const service = getMixRadiusService()

    // Default to 'standard' type, but could support 'thermal' via query param if needed
    // The client currently just calls /print/[id]
    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') as 'standard' | 'thermal') || 'standard'

    const html = await service.getPrintInvoiceHtml(id, type)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return new NextResponse(message, { status: 500 })
  }
}
