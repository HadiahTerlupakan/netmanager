import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { checkAllMikroTikRouterStatus } from '@/modules/network/services/mikrotik-ping-check'

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!session) {
    return null
  }
  return session
}

export async function POST() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

  try {
    const count = await checkAllMikroTikRouterStatus()
    return NextResponse.json({
      success: true,
      message: `Status check completed. Updated ${count} routers.`,
      count,
    })
  } catch (error: unknown) {
    console.error('Error checking MikroTik router status:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to check router status'
    }, { status: 500 })
  }
}

