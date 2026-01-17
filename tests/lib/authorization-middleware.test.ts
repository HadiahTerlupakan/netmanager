import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Mock next-auth
const mockGetServerSession = vi.fn()
vi.mock('next-auth', () => ({
  getServerSession: () => mockGetServerSession()
}))

// Mock auth config and getUserPermissions  
const mockGetUserPermissions = vi.fn()
vi.mock('@/lib/auth', () => ({
  authConfig: {},
  getUserPermissions: (userId: string) => mockGetUserPermissions(userId)
}))

// Mock modules/roles
vi.mock('@/modules/roles', () => ({
  checkSiteRestriction: vi.fn().mockReturnValue({ isRestricted: false, siteId: null }),
  canAccessSite: vi.fn().mockReturnValue(true)
}))

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemLog: {
      create: vi.fn().mockResolvedValue({})
    }
  }
}))

// Import after mocks
import { 
  authorize, 
  authorizeWithPermission,
  authorizeWithAnyPermission,
  authorizeWithAllPermissions,
  hasPermissionInSession,
  isAuthError,
  isAuthorized
} from '@/lib/authorization-middleware'

// Helper to create mock NextRequest
function createMockRequest(url: string = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(url)
}

describe('Authorization Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authorize', () => {
    it('should return 401 when no session', async () => {
      mockGetServerSession.mockResolvedValueOnce(null)
      
      const request = createMockRequest()
      const result = await authorize(request)
      
      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.error.status).toBe(401)
      }
    })

    it('should return 401 when session has no user id', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { email: 'test@example.com' }
      })
      
      const request = createMockRequest()
      const result = await authorize(request)
      
      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.error.status).toBe(401)
      }
    })

    it('should return session when authenticated with no permission requirements', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'ADMIN'
        }
      })
      mockGetUserPermissions.mockResolvedValueOnce(['users:read'])
      
      const request = createMockRequest()
      const result = await authorize(request)
      
      expect(isAuthorized(result)).toBe(true)
      if (isAuthorized(result)) {
        expect(result.session.user.id).toBe('user-1')
        expect(result.session.permissions).toContain('users:read')
      }
    })

    it('should return 403 when user lacks required permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'ADMIN'
        }
      })
      mockGetUserPermissions.mockResolvedValueOnce(['inventory:read'])
      
      const request = createMockRequest()
      const result = await authorize(request, { permissions: ['users:read'] })
      
      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.error.status).toBe(403)
      }
    })

    it('should return session when user has required permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'ADMIN'
        }
      })
      mockGetUserPermissions.mockResolvedValueOnce(['users:read', 'users:create'])
      
      const request = createMockRequest()
      const result = await authorize(request, { permissions: ['users:read'] })
      
      expect(isAuthorized(result)).toBe(true)
    })

    it('should check any permission (OR logic) by default', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'ADMIN'
        }
      })
      // User only has 'users:read' but not 'roles:read'
      mockGetUserPermissions.mockResolvedValueOnce(['users:read'])
      
      const request = createMockRequest()
      const result = await authorize(request, { 
        permissions: ['users:read', 'roles:read'],
        requireAll: false 
      })
      
      expect(isAuthorized(result)).toBe(true)
    })

    it('should require all permissions when requireAll is true', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'ADMIN'
        }
      })
      // User only has 'users:read' but not 'roles:read'
      mockGetUserPermissions.mockResolvedValueOnce(['users:read'])
      
      const request = createMockRequest()
      const result = await authorize(request, { 
        permissions: ['users:read', 'roles:read'],
        requireAll: true 
      })
      
      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.error.status).toBe(403)
      }
    })

    it('should allow self access when allowSelf is true and ids match', async () => {
      const userId = 'user-1'
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: userId,
          email: 'test@example.com',
          role: 'ADMIN'
        }
      })
      mockGetUserPermissions.mockResolvedValueOnce([])
      
      const request = createMockRequest()
      const result = await authorize(request, { allowSelf: true }, { id: userId })
      
      expect(isAuthorized(result)).toBe(true)
    })
  })

  describe('Helper Functions', () => {
    it('authorizeWithPermission should check single permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', role: 'ADMIN' }
      })
      mockGetUserPermissions.mockResolvedValueOnce(['users:read'])
      
      const request = createMockRequest()
      const result = await authorizeWithPermission(request, 'users:read')
      
      expect(isAuthorized(result)).toBe(true)
    })

    it('authorizeWithAnyPermission should check OR logic', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', role: 'ADMIN' }
      })
      mockGetUserPermissions.mockResolvedValueOnce(['users:read'])
      
      const request = createMockRequest()
      const result = await authorizeWithAnyPermission(request, ['users:read', 'roles:read'])
      
      expect(isAuthorized(result)).toBe(true)
    })

    it('authorizeWithAllPermissions should require all permissions', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', role: 'ADMIN' }
      })
      mockGetUserPermissions.mockResolvedValueOnce(['users:read']) // missing roles:read
      
      const request = createMockRequest()
      const result = await authorizeWithAllPermissions(request, ['users:read', 'roles:read'])
      
      expect(isAuthError(result)).toBe(true)
    })

    it('hasPermissionInSession should check permission in session', () => {
      const session = {
        user: { id: 'user-1', email: 'test@example.com', name: null, role: 'ADMIN' },
        permissions: ['users:read', 'users:create']
      }
      
      expect(hasPermissionInSession(session, 'users:read')).toBe(true)
      expect(hasPermissionInSession(session, 'roles:read')).toBe(false)
    })
  })

  describe('Type Guards', () => {
    it('isAuthError should return true for error results', async () => {
      mockGetServerSession.mockResolvedValueOnce(null)
      
      const request = createMockRequest()
      const result = await authorize(request)
      
      expect(isAuthError(result)).toBe(true)
      expect(isAuthorized(result)).toBe(false)
    })

    it('isAuthorized should return true for success results', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', role: 'ADMIN' }
      })
      mockGetUserPermissions.mockResolvedValueOnce([])
      
      const request = createMockRequest()
      const result = await authorize(request)
      
      expect(isAuthorized(result)).toBe(true)
      expect(isAuthError(result)).toBe(false)
    })
  })
})
