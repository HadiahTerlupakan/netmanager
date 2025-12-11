import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { checkAllMikroTikRouterStatus } from '@/lib/services/mikrotik-ping-check'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function POST() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const count = await checkAllMikroTikRouterStatus()
    return NextResponse.json({
      success: true,
      message: `Status check completed. Updated ${count} routers.`,
      count,
    })
  } catch (error: any) {
    console.error('Error checking MikroTik router status:', error)
    return NextResponse.json({ error: error.message || 'Failed to check router status' }, { status: 500 })
  }
}

