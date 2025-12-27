import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock next-auth
const mockGetServerSession = vi.fn()
vi.mock('next-auth', () => ({
  getServerSession: () => mockGetServerSession()
}))

// Mock auth config
vi.mock('@/lib/auth', () => ({
  authConfig: {}
}))

// Mock next/navigation
const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url)
}))

// Import after mocks
import { hasPermission, hasAnyPermission, getCurrentUser, ensurePermission, ensureAnyPermission } from '@/lib/rbac'

describe('RBAC Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hasPermission', () => {
    it('should return false when no session', async () => {
      mockGetServerSession.mockResolvedValueOnce(null)
      
      const result = await hasPermission('users:read')
      
      expect(result).toBe(false)
    })

    it('should return false when no user in session', async () => {
      mockGetServerSession.mockResolvedValueOnce({ user: null })
      
      const result = await hasPermission('users:read')
      
      expect(result).toBe(false)
    })

    it('should return true for SUPER_ADMIN regardless of permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'admin-1',
          role: 'SUPER_ADMIN',
          permissions: [] // Empty permissions but should bypass
        }
      })
      
      const result = await hasPermission('any:permission')
      
      expect(result).toBe(true)
    })

    it('should return true when user has the required permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: ['users:read', 'users:create']
        }
      })
      
      const result = await hasPermission('users:read')
      
      expect(result).toBe(true)
    })

    it('should return false when user lacks the required permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: ['users:read']
        }
      })
      
      const result = await hasPermission('users:delete')
      
      expect(result).toBe(false)
    })

    it('should handle undefined permissions array', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN'
          // No permissions property
        }
      })
      
      const result = await hasPermission('users:read')
      
      expect(result).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    it('should return false when no session', async () => {
      mockGetServerSession.mockResolvedValueOnce(null)
      
      const result = await hasAnyPermission(['users:read', 'roles:read'])
      
      expect(result).toBe(false)
    })

    it('should return true for SUPER_ADMIN', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'admin-1',
          role: 'SUPER_ADMIN',
          permissions: []
        }
      })
      
      const result = await hasAnyPermission(['any:permission'])
      
      expect(result).toBe(true)
    })

    it('should return true when user has at least one required permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: ['users:read'] // Has one of the required
        }
      })
      
      const result = await hasAnyPermission(['users:read', 'roles:read', 'dashboard:read'])
      
      expect(result).toBe(true)
    })

    it('should return false when user has none of the required permissions', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: ['inventory:read']
        }
      })
      
      const result = await hasAnyPermission(['users:read', 'roles:read'])
      
      expect(result).toBe(false)
    })
  })

  describe('getCurrentUser', () => {
    it('should return null when no session', async () => {
      mockGetServerSession.mockResolvedValueOnce(null)
      
      const result = await getCurrentUser()
      
      expect(result).toBeUndefined()
    })

    it('should return user from session', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'ADMIN'
      }
      mockGetServerSession.mockResolvedValueOnce({ user: mockUser })
      
      const result = await getCurrentUser()
      
      expect(result).toEqual(mockUser)
    })
  })

  describe('ensurePermission', () => {
    it('should not redirect when user has permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: ['users:read']
        }
      })
      
      await ensurePermission('users:read')
      
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('should redirect when user lacks permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: []
        }
      })
      
      await ensurePermission('users:read')
      
      expect(mockRedirect).toHaveBeenCalledWith('/admin')
    })

    it('should redirect to custom URL when specified', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: []
        }
      })
      
      await ensurePermission('users:read', '/403')
      
      expect(mockRedirect).toHaveBeenCalledWith('/403')
    })
  })

  describe('ensureAnyPermission', () => {
    it('should not redirect when user has any required permission', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: ['users:read']
        }
      })
      
      await ensureAnyPermission(['users:read', 'roles:read'])
      
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('should redirect when user has none of required permissions', async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: ['inventory:read']
        }
      })
      
      await ensureAnyPermission(['users:read', 'roles:read'])
      
      expect(mockRedirect).toHaveBeenCalledWith('/admin')
    })
  })
})

describe('Permission Config', () => {
  it('should have expected permission groups', async () => {
    const { PERMISSION_GROUPS } = await import('@/lib/permission-config')
    
    expect(PERMISSION_GROUPS.DASHBOARD).toBeDefined()
    expect(PERMISSION_GROUPS.NETWORK).toBeDefined()
    expect(PERMISSION_GROUPS.PELANGGAN).toBeDefined()
    expect(PERMISSION_GROUPS.USERS).toBeDefined()
  })

  it('should have correct actions defined', async () => {
    const { ACTIONS } = await import('@/lib/permission-config')
    
    expect(ACTIONS).toContain('read')
    expect(ACTIONS).toContain('create')
    expect(ACTIONS).toContain('update')
    expect(ACTIONS).toContain('delete')
  })

  it('should have karyawan permission groups', async () => {
    const { PERMISSION_GROUPS_KARYAWAN } = await import('@/lib/permission-config')
    
    expect(PERMISSION_GROUPS_KARYAWAN.DASHBOARD).toBeDefined()
    expect(PERMISSION_GROUPS_KARYAWAN.WORK_ORDER).toBeDefined()
    expect(PERMISSION_GROUPS_KARYAWAN.ATTENDANCE).toBeDefined()
  })
})
