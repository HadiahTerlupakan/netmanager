import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

/**
 * OAuth Security Utilities
 * Provides enhanced security features for OAuth flows including:
 * - CSRF protection via state parameter validation
 * - PKCE (Proof Key for Code Exchange) support
 * - Email verification handling
 */

export interface OAuthState {
  state: string
  codeVerifier?: string
  codeChallenge?: string
  codeChallengeMethod?: 'S256'
  provider: string
  redirectUrl?: string
  createdAt: number
}

/**
 * Store OAuth state in a secure cookie or database
 * For production, consider using Redis or secure HTTP-only cookies
 */
const oauthStateStore = new Map<string, OAuthState>()

/**
 * Generate a secure random state parameter for CSRF protection
 */
export function generateOAuthState(provider: string, redirectUrl?: string): OAuthState {
  const state = randomBytes(32).toString('hex')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  const oauthState: OAuthState = {
    state,
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
    provider,
    redirectUrl,
    createdAt: Date.now()
  }

  // Store state with 10-minute expiration
  oauthStateStore.set(state, oauthState)

  // Clean up expired states
  setTimeout(() => {
    oauthStateStore.delete(state)
  }, 10 * 60 * 1000)

  return oauthState
}

/**
 * Validate OAuth state parameter for CSRF protection
 */
export function validateOAuthState(state: string, provider: string): OAuthState | null {
  const storedState = oauthStateStore.get(state)

  if (!storedState) {
    console.error('[OAUTH-SECURITY] Invalid or expired state parameter')
    return null
  }

  if (storedState.provider !== provider) {
    console.error('[OAUTH-SECURITY] Provider mismatch in state validation')
    return null
  }

  // Check if state is expired (10 minutes)
  if (Date.now() - storedState.createdAt > 10 * 60 * 1000) {
    console.error('[OAUTH-SECURITY] State parameter expired')
    oauthStateStore.delete(state)
    return null
  }

  return storedState
}

/**
 * Verify code challenge for PKCE flow
 */
export function verifyCodeChallenge(codeVerifier: string, codeChallenge: string): boolean {
  const computedChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  return computedChallenge === codeChallenge
}

/**
 * Enhanced email verification for OAuth accounts
 */
export async function verifyOAuthEmail(userId: string, email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.error('[OAUTH-SECURITY] User not found for email verification')
      return false
    }

    if (user.email !== email) {
      console.error('[OAUTH-SECURITY] Email mismatch during verification')
      return false
    }

    // Update email verification status
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() }
    })

    console.log('[OAUTH-SECURITY] Email verified successfully:', email)
    return true
  } catch (error) {
    console.error('[OAUTH-SECURITY] Error verifying OAuth email:', error)
    return false
  }
}

/**
 * Check if account linking is allowed based on email verification status
 */
export async function canLinkAccount(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    // New user can always create account
    if (!user) {
      return true
    }

    // Existing user must have verified email to link additional OAuth accounts
    if (!user.emailVerified) {
      console.log('[OAUTH-SECURITY] Cannot link account: email not verified')
      return false
    }

    return true
  } catch (error) {
    console.error('[OAUTH-SECURITY] Error checking account linking eligibility:', error)
    return false
  }
}

/**
 * Secure OAuth redirect URL validation
 */
export function validateRedirectUrl(url: string, baseUrl?: string): boolean {
  if (!url) return false

  try {
    const redirectUrl = new URL(url)
    const appUrl = new URL(baseUrl || process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'http://localhost:3000')

    // Allow only same-origin redirects
    if (redirectUrl.origin !== appUrl.origin) {
      console.error('[OAUTH-SECURITY] Invalid redirect URL: different origin')
      return false
    }

    // Allow specific paths
    const allowedPaths = ['/auth/callback', '/api/auth/callback', '/login', '/dashboard']
    if (allowedPaths.some(path => redirectUrl.pathname === path)) {
      return true
    }

    // Allow any path under /auth/
    if (redirectUrl.pathname.startsWith('/auth/')) {
      return true
    }

    console.error('[OAUTH-SECURITY] Invalid redirect URL path:', redirectUrl.pathname)
    return false
  } catch (error) {
    console.error('[OAUTH-SECURITY] Error validating redirect URL:', error)
    return false
  }
}

/**
 * Get OAuth provider configuration with enhanced security
 */
export async function getSecureOAuthConfig(provider: string) {
  try {
    // Import dynamically to avoid circular dependencies
    const { getOAuthConfigWithCredentials } = await import('./oauth-manager')
    const config = await getOAuthConfigWithCredentials(provider)

    if (!config) {
      return null
    }

    // Ensure secure defaults
    return {
      ...config,
      settings: {
        ...(config.settings || {}),
        // Force PKCE if supported
        usePKCE: true,
        // Additional security parameters
        enforceHTTPS: process.env.NODE_ENV === 'production',
        stateValidation: true,
      }
    }
  } catch (error) {
    console.error('[OAUTH-SECURITY] Error getting secure OAuth config:', error)
    return null
  }
}

/**
 * Log OAuth security events
 */
export function logOAuthSecurityEvent(
  event: string,
  details: Record<string, any>,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details,
    level
  }

  console.log(`[OAUTH-SECURITY-${level.toUpperCase()}]`, JSON.stringify(logEntry, null, 2))

  // In production, you might want to send this to a security monitoring service
  if (level === 'error' && process.env.NODE_ENV === 'production') {
    // Send to security monitoring system
  }
}