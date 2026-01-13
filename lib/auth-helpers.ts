import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

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

/**
 * Fungsi autentikasi terpusat untuk memeriksa session user
 * @param request NextRequest object
 * @returns session object atau null jika tidak authenticated
 */
export async function getCurrentSession(request: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    
    if (!session) {
      return null
    }
    
    if (session?.user) {
      // Jika session ada dan user ada, tapi role tidak ada, set role sebagai ADMIN
      if (!session.user.role) {
        session.user.role = 'ADMIN'
      }
    }
    
    return session
  } catch (error) {
    console.error('[AUTH] Error getting session:', error)
    return null
  }
}

/**
 * Fungsi requireAuth yang terpusat
 * Memeriksa apakah user sudah login
 * @param request NextRequest object
 * @returns NextResponse error jika belum login, null jika sudah login
 */
export async function requireAuth(request: NextRequest) {
  const session: any = await getCurrentSession(request)
  
  if (!session?.user) {
    logSecurityEvent(request, 'UNAUTHORIZED_ACCESS', {
      reason: 'No session found'
    })

    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  return session // Return session for use in the handler
}

/**
 * Fungsi requireAdmin yang terpusat
 * Memeriksa apakah user sudah login (untuk admin routes)
 * @param request NextRequest object
 * @returns NextResponse error jika belum login, null jika sudah login
 */
export async function requireAdmin(request: NextRequest) {
  const session: any = await getCurrentSession(request)
  
  if (!session) {
    logSecurityEvent(request, 'UNAUTHORIZED_ACCESS', {
      reason: 'No session found'
    })

    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return session // Return session for use in the handler
}

// Note: requireAdminOrEmployee and requireEmployeeOrAdmin functions are removed
// since we only have ADMIN role now. Use requireAdmin instead.

/**
 * Fungsi untuk self-access (user bisa akses data sendiri)
 * @param request NextRequest object
 * @param resourceId ID resource yang akan diakses
 * @returns NextResponse error jika tidak punya akses, null jika boleh akses
 */
export async function requireSelfAccess(request: NextRequest, resourceId: string) {
  const session: any = await getCurrentSession(request)
  
  if (!session) {
    logSecurityEvent(request, 'UNAUTHORIZED_ACCESS', {
      reason: 'No session found'
    })

    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const userId = session.user.id

  // If trying to access someone else's data
  if (resourceId !== userId) {
    logSecurityEvent(request, 'UNAUTHORIZED_SELF_ACCESS', {
      userId,
      attemptedAccess: resourceId
    })

    return NextResponse.json(
      { error: 'Cannot access other users\' data' },
      { status: 403 }
    )
  }

  return session // Return session for use in the handler
}

/**
 * Helper function untuk mendapatkan user ID dari session
 * @param request NextRequest object
 * @returns user ID atau null
 */
export async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  const session: any = await getCurrentSession(request)
  return session?.user?.id || null
}

/**
 * Helper function untuk mendapatkan employee data dari session
 * @param request NextRequest object
 * @returns employee data atau null
 */
export async function getCurrentEmployee(request: NextRequest) {
  const session: any = await getCurrentSession(request)
  return session?.user?.employee || null
}

/**
 * Helper function untuk memeriksa apakah user adalah admin
 * @param request NextRequest object
 * @returns true jika admin, false jika tidak
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  const session: any = await getCurrentSession(request)
  return session?.user?.role === 'ADMIN'
}

// Note: isEmployee function is removed since we only have ADMIN role now.
// Use isAdmin instead.

/**
 * Helper function untuk standarisasi pengecekan SUPER_ADMIN role
 * Mengatasi inkonsistensi antara 'SUPER_ADMIN' dan 'Super Admin'
 * @param roleName nama role dari session
 * @returns true jika SUPER_ADMIN, false jika tidak
 */
export function isSuperAdminRole(roleName: string | undefined | null): boolean {
  return roleName === 'SUPER_ADMIN' || roleName === 'Super Admin'
}
