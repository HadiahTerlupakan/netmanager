import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authConfig } from '@/lib/auth'
import { getOAuthConfigForFrontend, upsertOAuthConfig, deleteOAuthConfig } from '@/lib/oauth-manager'

// GET: Fetch specific OAuth provider configuration
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ provider: string }> }
) {
  const params = await props.params;
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

    const config = await getOAuthConfigForFrontend(params.provider)

    if (!config) {
      return NextResponse.json(
        { error: 'OAuth provider configuration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: config
    })

  } catch (error) {
    console.error('Error fetching OAuth configuration:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch OAuth configuration'
      },
      { status: 500 }
    )
  }
}

// PUT: Update OAuth provider configuration
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ provider: string }> }
) {
  const params = await props.params;
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
    if (!body.providerName || !body.clientId || !body.clientSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: providerName, clientId, clientSecret' },
        { status: 400 }
      )
    }

    const config = await upsertOAuthConfig(params.provider, {
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
      message: 'OAuth provider configuration updated successfully'
    })

  } catch (error) {
    console.error('Error updating OAuth configuration:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update OAuth configuration'
      },
      { status: 500 }
    )
  }
}

// DELETE: Delete OAuth provider configuration
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ provider: string }> }
) {
  const params = await props.params;
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

    await deleteOAuthConfig(params.provider)

    return NextResponse.json({
      success: true,
      message: 'OAuth provider configuration deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting OAuth configuration:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete OAuth configuration'
      },
      { status: 500 }
    )
  }
}