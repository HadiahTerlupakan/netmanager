import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'

async function requireAuth() {
  const session: any = await getServerSession(authConfig as any)
  if (!session) {
    return null
  }
  return session
}

/**
 * GET /api/integrations/mixradius/odps/[id]/customers
 * Fetch customers for a specific ODP
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const mixRadiusService = getMixRadiusService()
    const customers = await mixRadiusService.fetchODPCustomers(id)

    return NextResponse.json({
      success: true,
      data: customers,
      total: customers.length,
    })
  } catch (error: any) {
    console.error(`Error fetching customers for ODP ${id}:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch ODP customers', message: error.message },
      { status: 500 }
    )
  }
}
