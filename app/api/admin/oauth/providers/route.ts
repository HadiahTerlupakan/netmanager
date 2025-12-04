import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authConfig } from '@/lib/auth'
import { SUPPORTED_OAUTH_PROVIDERS } from '@/lib/oauth-manager'

// GET: Fetch list of supported OAuth providers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has admin role
    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Return supported OAuth providers
    return NextResponse.json({
      success: true,
      data: SUPPORTED_OAUTH_PROVIDERS
    })

  } catch (error) {
    console.error('Error fetching OAuth providers:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch OAuth providers'
      },
      { status: 500 }
    )
  }
}