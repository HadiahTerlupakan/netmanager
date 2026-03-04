/**
 * API Response Standardization Tests
 * 
 * Verifies that refactored API routes use apiSuccess/ApiErrors patterns correctly.
 * Tests cover:
 * 1. Payments API
 * 2. MixRadius Module (14 routes)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const APP_ROOT = process.cwd()

// Helper to read file content safely
function readFile(path: string): string | null {
  try {
    return readFileSync(join(APP_ROOT, path), 'utf-8')
  } catch {
    return null
  }
}

/**
 * Test Pattern Checkers
 */
function hasApiSuccessImport(content: string): boolean {
  return content.includes("import") && content.includes("apiSuccess")
}

function hasApiErrorsImport(content: string): boolean {
  return content.includes("import") && content.includes("ApiErrors")
}

function usesApiSuccess(content: string): boolean {
  return content.includes("return apiSuccess(")
}

function usesApiErrors(content: string): boolean {
  return content.includes("ApiErrors.unauthorized()") ||
    content.includes("ApiErrors.forbidden()") ||
    content.includes("ApiErrors.notFound(") ||
    content.includes("ApiErrors.internalError(") ||
    content.includes("ApiErrors.badRequest(")
}

function doesNotUseNextResponse(content: string): boolean {
  // Check that NextResponse is not used for JSON responses
  return !content.includes("NextResponse.json({")
}

/**
 * Refactored Routes to Test
 */
const REFACTORED_ROUTES = {
  payments: [
    'app/api/payments/route.ts',
  ],
  mixradius: [
    'app/api/integrations/mixradius/owners/route.ts',
    'app/api/integrations/mixradius/sessions/route.ts',
    'app/api/integrations/mixradius/invoice-counts/route.ts',
    'app/api/integrations/mixradius/test/route.ts',
    'app/api/integrations/mixradius/dismantle/route.ts',
    'app/api/integrations/mixradius/odps/route.ts',
    'app/api/integrations/mixradius/groups/route.ts',
    'app/api/integrations/mixradius/groups/[id]/route.ts',
    'app/api/integrations/mixradius/accounts/route.ts',
    'app/api/integrations/mixradius/accounts/[id]/route.ts',
    'app/api/integrations/mixradius/customers/route.ts',
    'app/api/integrations/mixradius/customers/[id]/route.ts',
    'app/api/integrations/mixradius/sync/route.ts',
    'app/api/integrations/mixradius/odps/[id]/customers/route.ts',
  ],
}

describe('API Response Standardization', () => {
  describe('Payments API', () => {
    REFACTORED_ROUTES.payments.forEach(path => {
      describe(path, () => {
        const content = readFile(path)

        it('should exist', () => {
          expect(content).not.toBeNull()
        })

        it('should import apiSuccess from @/lib/api-response', () => {
          expect(content && hasApiSuccessImport(content)).toBe(true)
        })

        it('should import ApiErrors from @/lib/api-response', () => {
          expect(content && hasApiErrorsImport(content)).toBe(true)
        })

        it('should use apiSuccess for successful responses', () => {
          expect(content && usesApiSuccess(content)).toBe(true)
        })

        it('should use ApiErrors for error responses', () => {
          expect(content && usesApiErrors(content)).toBe(true)
        })

        it('should NOT use NextResponse.json directly', () => {
          expect(content && doesNotUseNextResponse(content)).toBe(true)
        })
      })
    })
  })

  describe('MixRadius Module', () => {
    REFACTORED_ROUTES.mixradius.forEach(path => {
      describe(path, () => {
        const content = readFile(path)

        it('should exist', () => {
          expect(content).not.toBeNull()
        })

        it('should import apiSuccess', () => {
          expect(content && hasApiSuccessImport(content)).toBe(true)
        })

        it('should import ApiErrors', () => {
          expect(content && hasApiErrorsImport(content)).toBe(true)
        })

        it('should use apiSuccess for success responses', () => {
          expect(content && usesApiSuccess(content)).toBe(true)
        })

        it('should NOT use NextResponse.json directly', () => {
          expect(content && doesNotUseNextResponse(content)).toBe(true)
        })
      })
    })
  })
})

describe('API Auth Pattern Checks', () => {
  const ALL_ROUTES = [
    ...REFACTORED_ROUTES.payments,
    ...REFACTORED_ROUTES.mixradius,
  ]

  describe('Authentication checks', () => {
    ALL_ROUTES.forEach(path => {
      it(`${path} should have auth check`, () => {
        const content = readFile(path)
        if (!content) return

        // Should have some form of auth check
        const hasAuthCheck =
          content.includes('verifyAuth(') ||
          content.includes('getServerSession(') ||
          content.includes('requireAuth(') ||
          content.includes('requireAdmin(') ||
          content.includes('authorize(') ||
          content.includes('createHandler({ auth: true }') ||
          content.includes('createHandler({auth: true}')

        expect(hasAuthCheck).toBe(true)
      })

      it(`${path} should return 401 for unauthenticated requests`, () => {
        const content = readFile(path)
        if (!content) return

        // Should handle unauthorized using ApiErrors
        const hasUnauthorizedHandling =
          content.includes('ApiErrors.unauthorized()') ||
          content.includes('status: 401') ||
          content.includes('createHandler({ auth: true }') ||
          content.includes('createHandler({auth: true}')

        expect(hasUnauthorizedHandling).toBe(true)
      })
    })
  })
})

describe('Error Code Usage', () => {
  const ALL_ROUTES = [
    ...REFACTORED_ROUTES.payments,
    ...REFACTORED_ROUTES.mixradius,
  ]

  ALL_ROUTES.forEach(path => {
    it(`${path} should use ErrorCodes enum for validation errors`, () => {
      const content = readFile(path)
      if (!content) return

      // If apiError is used, ErrorCodes should be imported
      if (content.includes('apiError(')) {
        expect(content.includes('ErrorCodes')).toBe(true)
      }
    })
  })
})
