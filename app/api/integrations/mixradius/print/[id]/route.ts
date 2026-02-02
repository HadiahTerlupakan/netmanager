import { NextRequest, NextResponse } from 'next/server'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { verifyAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const service = getMixRadiusService()

    // Default to 'standard' type, but could support 'thermal' via query param if needed
    // The client currently just calls /print/[id]
    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') as 'standard' | 'thermal') || 'standard'

    const html = await service.getPrintInvoiceHtml(params.id, type)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return new NextResponse(message, { status: 500 })
  }
}
