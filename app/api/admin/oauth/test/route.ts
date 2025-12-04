import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authConfig } from '@/lib/auth'
import { testOAuthConnection } from '@/lib/oauth-manager'

// POST: Test OAuth provider connection
export async function POST(request: NextRequest) {
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

    const body = await request.json()

    if (!body.provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      )
    }

    const result = await testOAuthConnection(body.provider)

    // Return result with success ensured at the end to override any existing success key
    return NextResponse.json({
      ...result,
      success: true
    })

  } catch (error) {
    console.error('Error testing OAuth connection:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test OAuth connection'
      },
      { status: 500 }
    )
  }
}