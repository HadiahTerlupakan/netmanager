import { describe, it, expect } from 'vitest'
import { 
    checkSiteRestriction, 
    getSiteFilter, 
    canAccessSite, 
    validateSiteAccess,
    buildSiteWhereClause 
} from '@/lib/site-restriction'

// Mock session factory
const mockSession = (overrides: any = {}) => ({
    user: {
        id: 'user-1',
        role: 'ADMIN',
        permissions: ['users:read'],
        siteId: 'site-1',
        ...overrides
    }
})

describe('Site Restriction Helper', () => {

    describe('checkSiteRestriction', () => {
        it('should return unrestricted for null session', () => {
            const result = checkSiteRestriction(null, 'users')
            expect(result.isRestricted).toBe(false)
            expect(result.siteId).toBeUndefined()
        })

        it('should return unrestricted for SUPER_ADMIN', () => {
            const session = mockSession({ role: 'SUPER_ADMIN', permissions: ['users:site_only'] })
            const result = checkSiteRestriction(session as any, 'users')
            
            expect(result.isRestricted).toBe(false)
            expect(result.siteId).toBeUndefined()
        })

        it('should return restricted with siteId when user has site_only permission', () => {
            const session = mockSession({ 
                role: 'ADMIN', 
                permissions: ['users:read', 'users:site_only'],
                siteId: 'site-abc'
            })
            const result = checkSiteRestriction(session as any, 'users')
            
            expect(result.isRestricted).toBe(true)
            expect(result.siteId).toBe('site-abc')
            expect(result.userSiteId).toBe('site-abc')
        })

        it('should return unrestricted when user does not have site_only permission', () => {
            const session = mockSession({ 
                role: 'MANAGER', 
                permissions: ['users:read', 'users:create'],
                siteId: 'site-abc'
            })
            const result = checkSiteRestriction(session as any, 'users')
            
            expect(result.isRestricted).toBe(false)
            expect(result.siteId).toBeUndefined()
        })

        it('should return undefined siteId when restricted but user has no site', () => {
            const session = mockSession({ 
                role: 'ADMIN', 
                permissions: ['users:site_only'],
                siteId: null
            })
            const result = checkSiteRestriction(session as any, 'users')
            
            expect(result.isRestricted).toBe(true)
            expect(result.siteId).toBeUndefined()
        })
    })

    describe('getSiteFilter', () => {
        it('should return siteId when restricted', () => {
            const session = mockSession({ 
                permissions: ['list:site_only'],
                siteId: 'site-xyz'
            })
            const siteId = getSiteFilter(session as any, 'list')
            
            expect(siteId).toBe('site-xyz')
        })

        it('should return undefined when not restricted', () => {
            const session = mockSession({ 
                permissions: ['list:read'],
                siteId: 'site-xyz'
            })
            const siteId = getSiteFilter(session as any, 'list')
            
            expect(siteId).toBeUndefined()
        })
    })

    describe('canAccessSite', () => {
        it('should allow access when not restricted', () => {
            const session = mockSession({ permissions: ['users:read'] })
            
            expect(canAccessSite(session as any, 'users', 'any-site')).toBe(true)
        })

        it('should allow access when restricted and sites match', () => {
            const session = mockSession({ 
                permissions: ['users:site_only'],
                siteId: 'site-1'
            })
            
            expect(canAccessSite(session as any, 'users', 'site-1')).toBe(true)
        })

        it('should deny access when restricted and sites do not match', () => {
            const session = mockSession({ 
                permissions: ['users:site_only'],
                siteId: 'site-1'
            })
            
            expect(canAccessSite(session as any, 'users', 'site-2')).toBe(false)
        })

        it('should allow access when target has no site (backwards compat)', () => {
            const session = mockSession({ 
                permissions: ['users:site_only'],
                siteId: 'site-1'
            })
            
            expect(canAccessSite(session as any, 'users', null)).toBe(true)
            expect(canAccessSite(session as any, 'users', undefined)).toBe(true)
        })

        it('should deny access when restricted user has no site assigned', () => {
            const session = mockSession({ 
                permissions: ['users:site_only'],
                siteId: null
            })
            
            expect(canAccessSite(session as any, 'users', 'site-2')).toBe(false)
        })
    })

    describe('validateSiteAccess', () => {
        it('should return null when access allowed', () => {
            const session = mockSession({ permissions: ['users:read'] })
            
            expect(validateSiteAccess(session as any, 'users', 'any-site')).toBeNull()
        })

        it('should return error message when access denied', () => {
            const session = mockSession({ 
                permissions: ['users:site_only'],
                siteId: 'site-1'
            })
            const error = validateSiteAccess(session as any, 'users', 'site-2')
            
            expect(error).toContain('Unauthorized')
            expect(error).toContain('users')
        })
    })

    describe('buildSiteWhereClause', () => {
        it('should return undefined when not restricted', () => {
            const session = mockSession({ permissions: ['users:read'] })
            
            expect(buildSiteWhereClause(session as any, 'users')).toBeUndefined()
        })

        it('should return where clause with default field when restricted', () => {
            const session = mockSession({ 
                permissions: ['users:site_only'],
                siteId: 'site-abc'
            })
            const where = buildSiteWhereClause(session as any, 'users')
            
            expect(where).toEqual({ siteId: 'site-abc' })
        })

        it('should use custom field name', () => {
            const session = mockSession({ 
                permissions: ['list:site_only'],
                siteId: 'site-xyz'
            })
            const where = buildSiteWhereClause(session as any, 'list', 'assignedSiteId')
            
            expect(where).toEqual({ assignedSiteId: 'site-xyz' })
        })
    })
})
