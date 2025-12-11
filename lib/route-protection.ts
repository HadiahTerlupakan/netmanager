import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

// Define user roles and their hierarchy
export enum UserRole {
  USER = 'USER',
  TECHNICIAN = 'TECHNICIAN',
  HR = 'HR',
  FINANCE = 'FINANCE',
  ADMIN = 'ADMIN',
}

// Role hierarchy for permission checking
const roleHierarchy: Record<UserRole, number> = {
  [UserRole.USER]: 0,
  [UserRole.TECHNICIAN]: 1,
  [UserRole.HR]: 2,
  [UserRole.FINANCE]: 3,
  [UserRole.ADMIN]: 4,
}

// Permission sets for different operations
const permissions = {
  // User management
  users: {
    read: [UserRole.HR, UserRole.ADMIN],
    create: [UserRole.HR, UserRole.ADMIN],
    update: [UserRole.HR, UserRole.ADMIN],
    delete: [UserRole.ADMIN],
  },
  // Financial data
  finance: {
    read: [UserRole.FINANCE, UserRole.ADMIN],
    create: [UserRole.FINANCE, UserRole.ADMIN],
    update: [UserRole.FINANCE, UserRole.ADMIN],
    delete: [UserRole.FINANCE, UserRole.ADMIN],
  },
  // Billing and payments
  billing: {
    read: [UserRole.FINANCE, UserRole.ADMIN],
    create: [UserRole.FINANCE, UserRole.ADMIN],
    update: [UserRole.FINANCE, UserRole.ADMIN],
    delete: [UserRole.FINANCE, UserRole.ADMIN],
  },
  // OLT/ONU management
  network: {
    read: [UserRole.TECHNICIAN, UserRole.ADMIN],
    create: [UserRole.TECHNICIAN, UserRole.ADMIN],
    update: [UserRole.TECHNICIAN, UserRole.ADMIN],
    delete: [UserRole.ADMIN],
  },
  // Work orders
  workorders: {
    read: [UserRole.TECHNICIAN, UserRole.ADMIN],
    create: [UserRole.TECHNICIAN, UserRole.ADMIN],
    update: [UserRole.TECHNICIAN, UserRole.ADMIN],
    delete: [UserRole.ADMIN],
  },
  // Tickets
  tickets: {
    read: [UserRole.USER, UserRole.TECHNICIAN, UserRole.ADMIN],
    create: [UserRole.USER, UserRole.TECHNICIAN, UserRole.ADMIN],
    update: [UserRole.TECHNICIAN, UserRole.ADMIN],
    delete: [UserRole.ADMIN],
  },
  // Reports
  reports: {
    read: [UserRole.HR, UserRole.FINANCE, UserRole.ADMIN],
    create: [UserRole.HR, UserRole.FINANCE, UserRole.ADMIN],
    update: [UserRole.HR, UserRole.FINANCE, UserRole.ADMIN],
    delete: [UserRole.ADMIN],
  },
}

// Log security events
function logSecurityEvent(
  request: NextRequest,
  event: string,
  details: any = null
) {
  const timestamp = new Date().toISOString()
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown'
  const userAgent = request.headers.get('user-agent') || 'Unknown'

  console.warn(`[SECURITY] ${event}`, {
    timestamp,
    ip,
    userAgent,
    url: request.url,
    method: request.method,
    details,
  })
}

// Verify JWT token and get session
export async function verifySession(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig as any)
    return session
  } catch (error) {
    console.error('[AUTH] Error verifying session:', error)
    return null
  }
}

// Check if user has required role
export function hasRole(userRole: string | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false

  const userLevel = roleHierarchy[userRole as UserRole] ?? -1
  const requiredLevel = roleHierarchy[requiredRole] ?? 999

  return userLevel >= requiredLevel
}

// Check if user has specific permission
export function hasPermission(
  userRole: string | undefined,
  resource: keyof typeof permissions,
  action: keyof typeof permissions[keyof typeof permissions]
): boolean {
  if (!userRole) return false

  const userRoleEnum = userRole as UserRole
  const allowedRoles = permissions[resource]?.[action] || []

  return allowedRoles.includes(userRoleEnum)
}

// Middleware function to protect API routes
export async function protectRoute(
  request: NextRequest,
  options: {
    requireAuth?: boolean
    requireRole?: UserRole
    requirePermission?: {
      resource: keyof typeof permissions
      action: keyof typeof permissions[keyof typeof permissions]
    }
    allowSelf?: boolean // For routes that allow users to access their own data
  } = {}
) {
  const {
    requireAuth = true,
    requireRole,
    requirePermission,
    allowSelf = false
  } = options

  // Get session
  const session = await verifySession(request)

  // Check if authentication is required
  if (requireAuth && !session) {
    logSecurityEvent(request, 'UNAUTHORIZED_ACCESS', {
      reason: 'No session found',
      required: options
    })

    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // If session exists, extract user info
  const sessionData = session as any
  const userRole = sessionData?.user?.role as string | undefined
  const userId = sessionData?.user?.id as string | undefined

  // Check role requirement
  if (requireRole && session) {
    if (!hasRole(userRole, requireRole)) {
      logSecurityEvent(request, 'INSUFFICIENT_ROLE', {
        userRole,
        requireRole,
        userId
      })

      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          required: requireRole,
          current: userRole
        },
        { status: 403 }
      )
    }
  }

  // Check permission requirement
  if (requirePermission && session) {
    if (!hasPermission(userRole, requirePermission.resource, requirePermission.action)) {
      logSecurityEvent(request, 'INSUFFICIENT_PERMISSION', {
        userRole,
        permission: requirePermission,
        userId
      })

      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          required: requirePermission,
          current: userRole
        },
        { status: 403 }
      )
    }
  }

  // Check self-access (for routes like /api/users/[id] where users can access their own data)
  if (allowSelf && session && request.url.includes('/')) {
    const urlParts = request.url.split('/')
    const resourceId = urlParts[urlParts.length - 1]

    // If trying to access someone else's data and not admin
    if (resourceId !== userId && !hasRole(userRole, UserRole.ADMIN)) {
      logSecurityEvent(request, 'UNAUTHORIZED_SELF_ACCESS', {
        userId,
        attemptedAccess: resourceId,
        userRole
      })

      return NextResponse.json(
        { error: 'Cannot access other users\' data' },
        { status: 403 }
      )
    }
  }

  // Return null if all checks pass (allow the request to proceed)
  return null
}

// SIMPLIFIED RBAC: Role-based helpers now only require authentication
// Authorization is controlled by CustomRole.allowedFeatures at UI level
// All authenticated users can call APIs - the frontend controls access

export const requireAdmin = (request: NextRequest) =>
  protectRoute(request, { requireAuth: true })

export const requireFinance = (request: NextRequest) =>
  protectRoute(request, { requireAuth: true })

export const requireHR = (request: NextRequest) =>
  protectRoute(request, { requireAuth: true })

export const requireTechnician = (request: NextRequest) =>
  protectRoute(request, { requireAuth: true })

export const requireAuth = (request: NextRequest) =>
  protectRoute(request, { requireAuth: true })

// Permission-based helpers - now just require auth
export const requireUserRead = (request: NextRequest) =>
  protectRoute(request, { requireAuth: true })

export const requireFinanceRead = (request: NextRequest) =>
  protectRoute(request, { requireAuth: true })

export const requireNetworkWrite = (request: NextRequest) =>
  protectRoute(request, { requireAuth: true })

export const requireSelfAccessOrAdmin = (request: NextRequest) =>
  protectRoute(request, {
    requireAuth: true,
    allowSelf: true
  })

// Rate limiting wrapper
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    maxRequests?: number
    windowMs?: number
    keyGenerator?: (req: NextRequest) => string
  } = {}
) {
  const {
    maxRequests = 100,
    windowMs = 15 * 60 * 1000, // 15 minutes
    keyGenerator = (req) => {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      const userId = req.headers.get('x-user-id') || 'anonymous'
      return `${ip}:${userId}`
    }
  } = options

  // This is a simple in-memory rate limiter
  // In production, you should use Redis or another distributed store
  const requests = new Map<string, { count: number; resetTime: number }>()

  return async (request: NextRequest): Promise<NextResponse> => {
    const key = keyGenerator(request)
    const now = Date.now()
    const resetTime = now + windowMs

    const current = requests.get(key)

    if (current) {
      if (now > current.resetTime) {
        // Reset the window
        requests.set(key, { count: 1, resetTime })
      } else if (current.count >= maxRequests) {
        logSecurityEvent(request, 'RATE_LIMIT_EXCEEDED', {
          key,
          count: current.count,
          maxRequests
        })

        return NextResponse.json(
          { error: 'Too many requests' },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString()
            }
          }
        )
      } else {
        current.count++
      }
    } else {
      requests.set(key, { count: 1, resetTime })
    }

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [k, v] of requests.entries()) {
        if (now > v.resetTime) {
          requests.delete(k)
        }
      }
    }

    return handler(request)
  }
}