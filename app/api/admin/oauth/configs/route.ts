import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authConfig } from '@/lib/auth'
import { getAllOAuthConfigs, upsertOAuthConfig } from '@/lib/oauth-manager'

// GET: Fetch all OAuth provider configurations
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
    if (false) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const configs = await getAllOAuthConfigs()

    return NextResponse.json({
      success: true,
      data: configs
    })

  } catch (error) {
    console.error('Error fetching OAuth configurations:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch OAuth configurations'
      },
      { status: 500 }
    )
  }
}

// POST: Create new OAuth provider configuration
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
    if (false) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate required fields
    const requiredFields = ['provider', 'providerName', 'clientId', 'clientSecret']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate provider format
    if (!/^[A-Z_]+$/.test(body.provider)) {
      return NextResponse.json(
        { error: 'Provider must be uppercase letters and underscores only' },
        { status: 400 }
      )
    }

    const config = await upsertOAuthConfig(body.provider, {
      providerName: body.providerName,
      isEnabled: body.isEnabled || false,
      isProduction: body.isProduction || false,
      priority: body.priority || 0,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      tenantId: body.tenantId || null,
      scope: body.scope || null,
      redirectUri: body.redirectUri || null,
      settings: body.settings || null
    })

    // Return sanitized config (without credentials)
    const sanitizedConfig = {
      id: config.id,
      provider: config.provider,
      providerName: config.providerName,
      isEnabled: config.isEnabled,
      isProduction: config.isProduction,
      priority: config.priority,
      scope: config.scope,
      redirectUri: config.redirectUri,
      settings: config.settings,
      lastTestedAt: config.lastTestedAt,
      testStatus: config.testStatus,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }

    return NextResponse.json({
      success: true,
      data: sanitizedConfig,
      message: 'OAuth provider configuration created successfully'
    })

  } catch (error) {
    console.error('Error creating OAuth configuration:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create OAuth configuration'
      },
      { status: 500 }
    )
  }
}