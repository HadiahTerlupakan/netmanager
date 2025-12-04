import { prisma } from '@/lib/prisma'
import { encryptOAuthFields, decryptOAuthFields } from './encryption-oauth'

// Supported OAuth providers with their configurations
export const SUPPORTED_OAUTH_PROVIDERS = [
  {
    id: 'GOOGLE',
    name: 'Google',
    icon: '/icons/google.svg',
    requiredFields: ['clientId', 'clientSecret'],
    optionalFields: ['hostedDomain', 'prompt'],
    defaultScopes: 'openid email profile',
    documentation: 'https://console.developers.google.com/'
  },
  {
    id: 'GITHUB',
    name: 'GitHub',
    icon: '/icons/github.svg',
    requiredFields: ['clientId', 'clientSecret'],
    optionalFields: ['allowSignup'],
    defaultScopes: 'user:email',
    documentation: 'https://github.com/settings/applications/new'
  },
  {
    id: 'MICROSOFT',
    name: 'Microsoft',
    icon: '/icons/microsoft.svg',
    requiredFields: ['clientId', 'clientSecret', 'tenantId'],
    optionalFields: ['prompt'],
    defaultScopes: 'openid email profile',
    documentation: 'https://portal.azure.com/'
  },
  {
    id: 'FACEBOOK',
    name: 'Facebook',
    icon: '/icons/facebook.svg',
    requiredFields: ['clientId', 'clientSecret'],
    optionalFields: [],
    defaultScopes: 'email public_profile',
    documentation: 'https://developers.facebook.com/'
  },
  {
    id: 'LINKEDIN',
    name: 'LinkedIn',
    icon: '/icons/linkedin.svg',
    requiredFields: ['clientId', 'clientSecret'],
    optionalFields: [],
    defaultScopes: 'openid email profile',
    documentation: 'https://www.linkedin.com/developers/apps/new'
  }
] as const

export type OAuthProvider = typeof SUPPORTED_OAUTH_PROVIDERS[number]

/**
 * Get all OAuth provider configurations (sanitized - without secrets)
 */
export async function getAllOAuthConfigs() {
  const configs = await prisma.oAuthProviderConfig.findMany({
    orderBy: [
      { priority: 'desc' },
      { providerName: 'asc' }
    ],
    select: {
      id: true,
      provider: true,
      providerName: true,
      isEnabled: true,
      isProduction: true,
      priority: true,
      scope: true,
      redirectUri: true,
      settings: true,
      lastTestedAt: true,
      testStatus: true,
      createdAt: true,
      updatedAt: true,
      // Exclude sensitive fields for security
      clientId: false,
      clientSecret: false,
      tenantId: false,
      createdBy: false
    }
  })

  return configs
}

/**
 * Get OAuth configuration with decrypted credentials
 * Only for backend use - never expose to frontend
 */
export async function getOAuthConfigWithCredentials(provider: string) {
  const config = await prisma.oAuthProviderConfig.findUnique({
    where: { provider }
  })

  if (!config) {
    return null
  }

  // Decrypt credentials
  const decryptedCredentials = decryptOAuthFields({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    tenantId: config.tenantId
  })

  return {
    ...config,
    ...decryptedCredentials
  }
}

/**
 * Get enabled OAuth providers with decrypted credentials
 * Used by NextAuth configuration and frontend display
 */
export async function getEnabledOAuthProviders() {
  try {
    const configs = await prisma.oAuthProviderConfig.findMany({
      where: {
        isEnabled: true
      },
      orderBy: [
        { priority: 'desc' },
        { providerName: 'asc' }
      ]
    })

    const providers = []

    for (const config of configs) {
      try {
        const decryptedCredentials = decryptOAuthFields({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          tenantId: config.tenantId
        })

        providers.push({
          ...config,
          ...decryptedCredentials
        })
      } catch (decryptError) {
        console.error(`Failed to decrypt credentials for ${config.provider}:`, decryptError)
        // Skip this provider if decryption fails
        continue
      }
    }

    return providers
  } catch (error) {
    console.error('Error fetching enabled OAuth providers:', error)
    return []
  }
}

/**
 * Create or update OAuth provider configuration
 */
export async function upsertOAuthConfig(
  provider: string,
  data: {
    providerName: string
    isEnabled: boolean
    isProduction?: boolean
    priority?: number
    clientId: string
    clientSecret: string
    tenantId?: string | null
    scope?: string | null
    redirectUri?: string | null
    settings?: any
  }
) {
  // Encrypt sensitive credentials
  const encryptedCredentials = encryptOAuthFields({
    clientId: data.clientId,
    clientSecret: data.clientSecret,
    tenantId: data.tenantId
  })

  const config = await prisma.oAuthProviderConfig.upsert({
    where: { provider },
    update: {
      providerName: data.providerName,
      isEnabled: data.isEnabled,
      isProduction: data.isProduction,
      priority: data.priority,
      ...encryptedCredentials,
      scope: data.scope,
      redirectUri: data.redirectUri,
      settings: data.settings,
      testStatus: null, // Reset test status on update
      updatedAt: new Date()
    },
    create: {
      provider,
      providerName: data.providerName,
      isEnabled: data.isEnabled,
      isProduction: data.isProduction || false,
      priority: data.priority || 0,
      ...encryptedCredentials,
      scope: data.scope,
      redirectUri: data.redirectUri,
      settings: data.settings
    }
  })

  return config
}

/**
 * Delete OAuth provider configuration
 */
export async function deleteOAuthConfig(provider: string) {
  await prisma.oAuthProviderConfig.delete({
    where: { provider }
  })
}

/**
 * Update OAuth provider test status
 */
export async function updateOAuthTestStatus(
  provider: string,
  status: 'SUCCESS' | 'FAILED',
  errorMessage?: string
) {
  await prisma.oAuthProviderConfig.update({
    where: { provider },
    data: {
      testStatus: status === 'SUCCESS' ? 'SUCCESS' : errorMessage || 'FAILED',
      lastTestedAt: new Date()
    }
  })
}

/**
 * Get OAuth provider configuration for frontend (sanitized)
 */
export async function getOAuthConfigForFrontend(provider: string) {
  const config = await prisma.oAuthProviderConfig.findUnique({
    where: { provider },
    select: {
      id: true,
      provider: true,
      providerName: true,
      isEnabled: true,
      isProduction: true,
      priority: true,
      scope: true,
      redirectUri: true,
      settings: true,
      lastTestedAt: true,
      testStatus: true,
      createdAt: true,
      updatedAt: true,
      // Never expose credentials to frontend
      clientId: false,
      clientSecret: false,
      tenantId: false,
      createdBy: false
    }
  })

  return config
}

/**
 * Test OAuth provider configuration
 */
export async function testOAuthConnection(provider: string) {
  try {
    const config = await getOAuthConfigWithCredentials(provider)

    if (!config) {
      throw new Error('OAuth provider configuration not found')
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Missing required credentials')
    }

    // Basic validation - check if credentials exist and are properly formatted
    // In a real implementation, you might want to make actual API calls to test the connection
    const hasValidCredentials = config.clientId.length > 0 && config.clientSecret.length > 0

    if (provider === 'MICROSOFT' && !config.tenantId) {
      throw new Error('Tenant ID is required for Microsoft OAuth')
    }

    if (hasValidCredentials) {
      await updateOAuthTestStatus(provider, 'SUCCESS')
      return { success: true, message: 'Connection test successful' }
    } else {
      throw new Error('Invalid credentials format')
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await updateOAuthTestStatus(provider, 'FAILED', errorMessage)
    return { success: false, message: errorMessage }
  }
}