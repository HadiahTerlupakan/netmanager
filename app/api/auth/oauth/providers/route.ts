import { NextRequest, NextResponse } from 'next/server'
import { getEnabledOAuthProviders } from '@/lib/oauth-manager'

// Helper to get fallback providers info from env vars (for display only, not actual NextAuth config)
function getFallbackProviderInfo() {
  const providers = []

  // Check GitHub (only add if env vars are set)
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push({
      id: 'github',
      name: 'GitHub',
      displayName: 'Continue with GitHub',
      color: 'bg-gray-900 dark:bg-gray-700',
      textColor: 'text-white',
      borderColor: 'border-gray-900',
      hoverColor: 'hover:bg-gray-800 dark:hover:bg-gray-600',
      icon: '⚫',
      priority: 2
    })
  }

  // Check Google (only add if env vars are set)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push({
      id: 'google',
      name: 'Google',
      displayName: 'Continue with Google',
      color: 'bg-white',
      textColor: 'text-gray-700',
      borderColor: 'border-gray-300',
      hoverColor: 'hover:bg-gray-50',
      icon: '🟢',
      priority: 1
    })
  }

  // Check Microsoft Azure AD (only add if env vars are set)
  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
    providers.push({
      id: 'azure-ad',
      name: 'Microsoft',
      displayName: 'Continue with Microsoft',
      color: 'bg-[#00A4EF]',
      textColor: 'text-white',
      borderColor: 'border-[#00A4EF]',
      hoverColor: 'hover:bg-[#0078D4]',
      icon: '🔷',
      priority: 3
    })
  }

  return providers
}

// GET: Fetch enabled OAuth providers for frontend
export async function GET(request: NextRequest) {
  console.log('[API] Fetching OAuth providers...')
  try {
    // Try to get providers from database first
    const enabledProviders = await getEnabledOAuthProviders()
    console.log(`[API] Found ${enabledProviders.length} enabled providers from database`)

    let frontendProviders = []

    if (enabledProviders.length > 0) {
      // Map database providers to frontend format
      frontendProviders = enabledProviders.map(config => {
        try {
          switch (config.provider) {
            case 'GOOGLE':
              return {
                id: 'google',
                name: 'Google',
                displayName: 'Continue with Google',
                color: 'bg-white',
                textColor: 'text-gray-700',
                borderColor: 'border-gray-300',
                hoverColor: 'hover:bg-gray-50',
                icon: '🟢',
                priority: config.priority || 0
              }
            case 'GITHUB':
              return {
                id: 'github',
                name: 'GitHub',
                displayName: 'Continue with GitHub',
                color: 'bg-gray-900 dark:bg-gray-700',
                textColor: 'text-white',
                borderColor: 'border-gray-900',
                hoverColor: 'hover:bg-gray-800 dark:hover:bg-gray-600',
                icon: '⚫',
                priority: config.priority || 0
              }
            case 'MICROSOFT':
              return {
                id: 'azure-ad',
                name: 'Microsoft',
                displayName: 'Continue with Microsoft',
                color: 'bg-[#00A4EF]',
                textColor: 'text-white',
                borderColor: 'border-[#00A4EF]',
                hoverColor: 'hover:bg-[#0078D4]',
                icon: '🔷',
                priority: config.priority || 0
              }
            case 'FACEBOOK':
              return {
                id: 'facebook',
                name: 'Facebook',
                displayName: 'Continue with Facebook',
                color: 'bg-[#1877F2]',
                textColor: 'text-white',
                borderColor: 'border-[#1877F2]',
                hoverColor: 'hover:bg-[#166FE5]',
                icon: '🔵',
                priority: config.priority || 0
              }
            case 'LINKEDIN':
              return {
                id: 'linkedin',
                name: 'LinkedIn',
                displayName: 'Continue with LinkedIn',
                color: 'bg-[#0077B5]',
                textColor: 'text-white',
                borderColor: 'border-[#0077B5]',
                hoverColor: 'hover:bg-[#005885]',
                icon: '💼',
                priority: config.priority || 0
              }
            default:
              return null
          }
        } catch (mapError) {
          console.error('[API] Error mapping provider:', config.provider, mapError)
          return null
        }
      }).filter(provider => provider !== null)
    } else {
      // Fallback to environment variables if no database config
      console.log('[API] No database providers, checking environment variables...')
      frontendProviders = getFallbackProviderInfo()
      console.log(`[API] Found ${frontendProviders.length} fallback providers from env vars`)
    }

    // Sort by priority (highest first)
    frontendProviders.sort((a: any, b: any) => (b?.priority || 0) - (a?.priority || 0))

    console.log('[API] Returning providers:', frontendProviders.map((p: any) => p?.id))

    return NextResponse.json({
      success: true,
      data: frontendProviders
    })

  } catch (error) {
    console.error('[API] Critical error fetching OAuth providers:', error)
    if (error instanceof Error) {
      console.error(error.stack)
    }

    // Even on error, try to return fallback providers
    const fallbackProviders = getFallbackProviderInfo()

    return NextResponse.json({
      success: true,
      data: fallbackProviders,
      warning: 'Using fallback providers due to database error'
    })
  }
}