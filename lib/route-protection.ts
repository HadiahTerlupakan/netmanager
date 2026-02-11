import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

// Log security events
function logSecurityEvent(
  request: NextRequest,
  event: string,
  details: unknown = null
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
export async function verifySession(_request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    return session
  } catch (error) {
    console.error('[AUTH] Error verifying session:', error)
    return null
  }
}


// Middleware function to protect API routes
export async function protectRoute(
  request: NextRequest,
  options: {
    requireAuth?: boolean
    allowSelf?: boolean // For routes that allow users to access their own data
  } = {}
) {
  const {
    requireAuth = true,
    allowSelf = false
  } = options

  // Get session
  const session = await verifySession(request)

  // Check if authentication is required
  if (requireAuth && !session) {
    logSecurityEvent(request, 'UNAUTHORIZED_ACCESS', {
      reason: 'No session found'
    })

    return NextResponse.json(
      { error: 'Autentikasi diperlukan' },
      { status: 401 }
    )
  }

  // If session exists, extract user info
  const sessionData = session as { user?: { id?: string } } | null
  const userId = sessionData?.user?.id

  // Check self-access (for routes like /api/users/[id] where users can access their own data)
  if (allowSelf && session && request.url.includes('/')) {
    const urlParts = request.url.split('/')
    const resourceId = urlParts[urlParts.length - 1]

    // If trying to access someone else's data
    if (resourceId !== userId) {
      logSecurityEvent(request, 'UNAUTHORIZED_SELF_ACCESS', {
        userId,
        attemptedAccess: resourceId
      })

      return NextResponse.json(
        { error: 'Tidak dapat mengakses data user lain' },
        { status: 403 }
      )
    }
  }

  // Return null if all checks pass (allow the request to proceed)
  return null
}

// All authenticated users can access protected routes
export const requireAuth = (request: NextRequest) =>
  protectRoute(request, { requireAuth: true })

// For routes where users can access their own data
export const requireSelfAccess = (request: NextRequest) =>
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
          { error: 'Terlalu banyak permintaan' },
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