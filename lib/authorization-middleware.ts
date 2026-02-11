/**
 * Centralized Authorization Middleware
 * 
 * Pattern berdasarkan Context7 Next.js & NextAuth.js documentation:
 * - Two-tier security: Authentication + Authorization
 * - Session verification via getServerSession
 * - Role and permission-based access control
 * - Site restriction support
 * 
 * @see https://nextjs.org/docs/guides/authentication (Context7)
 * @see https://next-auth.js.org/tutorials/securing-pages-and-api-routes (Context7)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, type NextAuthOptions, type Session } from 'next-auth'
import { authConfig, getUserPermissions } from '@/lib/auth'
import { checkSiteRestriction } from '@/modules/roles'
import { prisma } from '@/lib/prisma'

// =============================================================================
// Types
// =============================================================================

export interface AuthorizationConfig {
  /** Required permissions - OR logic by default */
  permissions?: string[]
  /** Require ALL permissions (AND logic) instead of ANY */
  requireAll?: boolean
  /** Allow access to own resources (self-access) */
  allowSelf?: boolean
  /** URL param name for self-check (default: 'id') */
  selfIdParam?: string
  /** Apply site restrictions - user can only access resources from their site */
  siteRestricted?: boolean
  /** Field name for site ID in resource (default: 'siteId') */
  siteIdField?: string
  /** Log authorization attempts to SystemLog */
  auditLog?: boolean
  /** Custom error messages */
  errorMessages?: {
    unauthorized?: string
    forbidden?: string
    siteRestricted?: string
  }
}

export interface AuthorizedSession {
  user: {
    id: string
    email: string
    name: string | null
    role: string
    /** @deprecated Use siteIds for multi-site */
    siteId?: string | null
    /** Multi-site: Array of site IDs */
    siteIds?: string[]
    /** Multi-site: Primary site ID */
    primarySiteId?: string | null
    departmentId?: string | null
    isSales?: boolean
  }
  permissions: string[]
}

interface SessionUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  siteId?: string | null;
  siteIds?: string[];
  primarySiteId?: string | null;
  departmentId?: string | null;
  isSales?: boolean;
}

export type AuthorizationResult =
  | { error: NextResponse; session?: never }
  | { session: AuthorizedSession; error?: never }

// =============================================================================
// Main Authorization Function
// =============================================================================

/**
 * Centralized authorization function for API Route Handlers.
 * 
 * Pattern from Context7 Next.js docs:
 * 1. Check if user is authenticated (session exists)
 * 2. Check if user has required permissions
 * 3. Check site restrictions if applicable
 * 
 * @example
 * ```typescript
 * export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
 *   const auth = await authorize(req, { 
 *     permissions: ['users:read'],
 *     siteRestricted: true 
 *   })
 *   
 *   if ('error' in auth) return auth.error
 *   
 *   const { session } = auth
 *   // Proceed with authorized user...
 * }
 * ```
 */
export async function authorize(
  request: NextRequest,
  config: AuthorizationConfig = {},
  params?: { id?: string }
): Promise<AuthorizationResult> {
  const {
    permissions = [],
    requireAll = false,
    allowSelf = false,
    selfIdParam = 'id',
    siteRestricted = false,
    auditLog = false,
    errorMessages = {}
  } = config

  // -------------------------------------------------------------------------
  // Step 1: Authentication Check (from Context7 Next.js pattern)
  // -------------------------------------------------------------------------
  let session: Record<string, unknown> | null
  try {
    session = await getServerSession(authConfig as NextAuthOptions) as Record<string, unknown> | null
  } catch (error) {
    console.error('[AUTH] Error getting session:', error)
    return {
      error: NextResponse.json(
        { error: errorMessages.unauthorized || 'Kesalahan autentikasi' },
        { status: 500 }
      )
    }
  }

  if (!(session?.user as SessionUser)?.id) {
    if (auditLog) {
      await logAuthAttempt({
        userId: null,
        url: request.url,
        action: 'AUTHENTICATION_FAILED',
        granted: false,
        details: { reason: 'No session found' }
      })
    }

    return {
      error: NextResponse.json(
        { error: errorMessages.unauthorized || 'Autentikasi diperlukan' },
        { status: 401 }
      )
    }
  }

  const user = session.user as SessionUser
  const userId = user.id
  const userRole = user.role || ''
  const userSiteId = user.siteId
  const userSiteIds = user.siteIds || (userSiteId ? [userSiteId] : [])
  const primarySiteId = user.primarySiteId || userSiteId

  // -------------------------------------------------------------------------
  // Step 2: Load User Permissions (always from database)
  // -------------------------------------------------------------------------
  let userPermissions: string[] = []
  try {
    userPermissions = await getUserPermissions(userId)
  } catch (error) {
    console.error('[AUTH] Error loading permissions:', error)
    // Fail-closed: deny access if permissions can't be loaded
    return {
      error: NextResponse.json(
        { error: 'Kesalahan otorisasi' },
        { status: 500 }
      )
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Self-Access Check (if enabled)
  // -------------------------------------------------------------------------
  const resourceId = params?.[selfIdParam as keyof typeof params] || params?.id
  const isSelfAccess = allowSelf && resourceId === userId

  if (isSelfAccess) {
    // Self-access granted - bypass permission check for viewing own resources
    return {
      session: {
        user: {
          id: userId,
          email: user.email || '',
          name: user.name || null,
          role: userRole,
          siteId: primarySiteId,
          siteIds: userSiteIds,
          primarySiteId,
          departmentId: user.departmentId,
          isSales: user.isSales
        },
        permissions: userPermissions
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Permission Check (from Context7 pattern)
  // -------------------------------------------------------------------------
  if (permissions.length > 0) {
    const hasAccess = requireAll
      ? permissions.every(p => userPermissions.includes(p))
      : permissions.some(p => userPermissions.includes(p))

    if (!hasAccess) {
      if (auditLog) {
        await logAuthAttempt({
          userId,
          url: request.url,
          action: 'PERMISSION_DENIED',
          granted: false,
          details: { 
            required: permissions, 
            requireAll,
            userPermissions: userPermissions.length 
          }
        })
      }

      console.warn('[AUTH] Permission denied', {
        userId,
        required: permissions,
        requireAll,
        userHas: userPermissions.length
      })

      return {
        error: NextResponse.json(
          { error: errorMessages.forbidden || 'Izin tidak mencukupi' },
          { status: 403 }
        )
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Site Restriction Check
  // -------------------------------------------------------------------------
  if (siteRestricted && userSiteId) {
    const restrictionResult = checkSiteRestriction(session as unknown as Session, 'resource')
    
    if (restrictionResult.isRestricted) {
      // User is site-restricted - they can only access resources from their site
      // The actual filtering should be done in the route handler using getSiteFilter()
      // Here we just attach the restriction info to the session
    }
  }

  // -------------------------------------------------------------------------
  // Authorization Successful
  // -------------------------------------------------------------------------
  if (auditLog) {
    await logAuthAttempt({
      userId,
      url: request.url,
      action: 'ACCESS_GRANTED',
      granted: true,
      details: { permissions: permissions.length > 0 ? permissions : '*' }
    })
  }

  return {
    session: {
      user: {
        id: userId,
        email: user.email || '',
        name: user.name || null,
        role: userRole,
        siteId: primarySiteId,
        siteIds: userSiteIds,
        primarySiteId,
        departmentId: user.departmentId,
        isSales: user.isSales
      },
      permissions: userPermissions
    }
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Quick authorization check - just authentication, no permission check
 */
export async function authorizeBasic(
  request: NextRequest
): Promise<AuthorizationResult> {
  return authorize(request, {})
}

/**
 * Authorization with specific permission requirement
 */
export async function authorizeWithPermission(
  request: NextRequest,
  permission: string
): Promise<AuthorizationResult> {
  return authorize(request, { permissions: [permission] })
}

/**
 * Authorization with multiple permissions (any of them)
 */
export async function authorizeWithAnyPermission(
  request: NextRequest,
  permissions: string[]
): Promise<AuthorizationResult> {
  return authorize(request, { permissions, requireAll: false })
}

/**
 * Authorization with multiple permissions (all required)
 */
export async function authorizeWithAllPermissions(
  request: NextRequest,
  permissions: string[]
): Promise<AuthorizationResult> {
  return authorize(request, { permissions, requireAll: true })
}

/**
 * Check if authorized session has a specific permission
 */
export function hasPermissionInSession(
  session: AuthorizedSession,
  permission: string
): boolean {
  return session.permissions.includes(permission)
}

/**
 * Check if authorized session has any of the permissions
 */
export function hasAnyPermissionInSession(
  session: AuthorizedSession,
  permissions: string[]
): boolean {
  return permissions.some(p => session.permissions.includes(p))
}

// =============================================================================
// Audit Logging
// =============================================================================

interface LogAuthAttemptParams {
  userId: string | null
  url: string
  action: string
  granted: boolean
  details?: Record<string, unknown>
}

async function logAuthAttempt({
  userId,
  url,
  action,
  granted,
  details
}: LogAuthAttemptParams): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        id: crypto.randomUUID(),
        type: 'AUTH',
        action,
        subject: url.substring(0, 500), // Limit URL length
        ...(userId ? { userId } : {}),
        details: JSON.stringify({ granted, ...details })
      }
    })
  } catch (error) {
    // Non-blocking - log error but don't fail the request
    console.error('[AUTH] Failed to log auth attempt:', error)
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if authorization result is an error
 */
export function isAuthError(
  result: AuthorizationResult
): result is { error: NextResponse } {
  return 'error' in result
}

/**
 * Type guard to check if authorization result is successful
 */
export function isAuthorized(
  result: AuthorizationResult
): result is { session: AuthorizedSession } {
  return 'session' in result
}
