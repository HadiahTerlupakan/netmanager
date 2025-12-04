import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import AzureADProvider from 'next-auth/providers/azure-ad'
import { getEnabledOAuthProviders } from './oauth-manager'

/**
 * Get dynamic OAuth providers for NextAuth configuration
 * This allows runtime configuration of OAuth providers from database
 */
export async function getDynamicOAuthProviders(): Promise<any[]> {
  try {
    const enabledProviders = await getEnabledOAuthProviders()
    const providers = []

    for (const config of enabledProviders) {
      // Skip if required credentials are missing
      if (!config.clientId || !config.clientSecret) {
        console.warn(`Missing credentials for OAuth provider: ${config.provider}`)
        continue
      }

      try {
        switch (config.provider) {
          case 'GOOGLE':
            providers.push(
              GoogleProvider({
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                authorization: {
                  params: {
                    scope: config.scope || 'openid email profile',
                    prompt: (config.settings as Record<string, string> | null)?.prompt || undefined,
                    hd: (config.settings as Record<string, string> | null)?.hostedDomain || undefined
                  }
                },
                allowDangerousEmailAccountLinking: true,
                client: {
                  token_endpoint_auth_method: 'client_secret_post'
                }
              })
            )
            break

          case 'GITHUB':
            providers.push(
              GitHubProvider({
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                authorization: {
                  params: {
                    scope: config.scope || 'user:email'
                  }
                },
                allowDangerousEmailAccountLinking: true,
                client: {
                  token_endpoint_auth_method: 'client_secret_post'
                }
              })
            )
            break

          case 'MICROSOFT':
            if (!config.tenantId) {
              console.warn(`Missing tenant ID for Microsoft OAuth provider`)
              continue
            }

            providers.push(
              AzureADProvider({
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                tenantId: config.tenantId,
                authorization: {
                  params: {
                    scope: config.scope || 'openid email profile'
                  }
                },
                allowDangerousEmailAccountLinking: true,
                client: {
                  token_endpoint_auth_method: 'client_secret_post'
                }
              })
            )
            break

          case 'FACEBOOK':
            // Note: NextAuth doesn't have built-in Facebook provider in v4
            // You would need to add a custom provider or use a different library
            console.warn('Facebook provider not supported in NextAuth v4')
            break

          case 'LINKEDIN':
            // Note: LinkedIn provider would require custom implementation
            console.warn('LinkedIn provider not supported in NextAuth v4')
            break

          default:
            console.warn(`Unsupported OAuth provider: ${config.provider}`)
        }
      } catch (error) {
        console.error(`Error configuring OAuth provider ${config.provider}:`, error)
      }
    }

    return providers

  } catch (error) {
    console.error('Error loading dynamic OAuth providers:', error)
    return []
  }
}

/**
 * Get fallback OAuth providers from environment variables
 * Used when dynamic configuration is not available
 */
export function getFallbackOAuthProviders(): any[] {
  const providers = []

  // Google OAuth
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true
      })
    )
  }

  // GitHub OAuth
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true
      })
    )
  }

  // Microsoft Azure AD OAuth
  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
    providers.push(
      AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        tenantId: process.env.AZURE_AD_TENANT_ID,
        allowDangerousEmailAccountLinking: true
      })
    )
  }

  return providers
}

/**
 * Get all OAuth providers (dynamic + fallback)
 * This is the main function used in NextAuth configuration
 */
export async function getAllOAuthProviders(): Promise<any[]> {
  try {
    const dynamicProviders = await getDynamicOAuthProviders()

    // If dynamic providers are available, use them
    if (dynamicProviders.length > 0) {
      console.log(`Using ${dynamicProviders.length} dynamic OAuth providers`)
      return dynamicProviders
    }

    // Fallback to environment variables
    console.log('Using fallback OAuth providers from environment variables')
    return getFallbackOAuthProviders()

  } catch (error) {
    console.error('Error getting OAuth providers:', error)
    // Always return fallback providers as last resort
    return getFallbackOAuthProviders()
  }
}