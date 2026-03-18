# Implementation Plan: Robust Custom Error Classes and Global Error Handler

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement centralized error handling using custom classes and a Hono global error handler to standardize API responses and logging.

**Architecture:** Create a central `lib/errors.ts` for error definitions and a catch-all Hono router in `app/api/[[...route]]/route.ts` with a global `onError` middleware.

**Tech Stack:** Hono, Next.js App Router, TypeScript, Vitest.

---

### Task 1: Implement Custom Error Classes

**Files:**
- Create: `lib/errors.ts`
- Test: `tests/lib/errors.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { AppError, ValidationError, RadiusConnectionError } from '@/lib/errors'

describe('Custom Error Classes', () => {
  it('AppError should have statusCode and code', () => {
    const error = new AppError('Test error', 500, 'TEST_CODE')
    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(500)
    expect(error.code).toBe('TEST_CODE')
    expect(error.name).toBe('AppError')
  })

  it('ValidationError should default to 400', () => {
    const error = new ValidationError('Invalid input')
    expect(error.statusCode).toBe(400)
    expect(error.code).toBe('VALIDATION_ERROR')
  })

  it('RadiusConnectionError should default to 503', () => {
    const error = new RadiusConnectionError('Conn failed')
    expect(error.statusCode).toBe(503)
    expect(error.code).toBe('RADIUS_CONNECTION_ERROR')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/lib/errors.test.ts`
Expected: FAIL (Module not found)

**Step 3: Write minimal implementation**

```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class RadiusConnectionError extends AppError {
  constructor(message: string = 'Failed to connect to Radius server') {
    super(message, 503, 'RADIUS_CONNECTION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest tests/lib/errors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/errors.ts tests/lib/errors.test.ts
git commit -m "feat: implement custom error classes"
```

### Task 2: Implement Hono Global Error Handler

**Files:**
- Create: `app/api/[[...route]]/route.ts`
- Test: `tests/api/error-handler.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import app from '@/app/api/[[...route]]/route'
import { AppError } from '@/lib/errors'

describe('Global Error Handler', () => {
  it('should handle AppError and return JSON', async () => {
    // Mock a route that throws AppError
    app.get('/api/test-error', () => {
      throw new AppError('Custom error', 418, 'TEAPOT')
    })

    const res = await app.request('/api/test-error')
    expect(res.status).toBe(418)
    const body = await res.json()
    expect(body).toEqual({ error: 'Custom error', code: 'TEAPOT' })
  })

  it('should handle generic Error and return 500', async () => {
    app.get('/api/generic-error', () => {
      throw new Error('Boom')
    })

    const res = await app.request('/api/generic-error')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Boom')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/api/error-handler.test.ts`
Expected: FAIL (Module not found)

**Step 3: Write minimal implementation**

```typescript
import { Hono } from 'hono'
import { handle } from 'hono/nextjs'
import { AppError } from '@/lib/errors'

const app = new Hono().basePath('/api')

app.onError((err, c) => {
  // MUST DO: Log all errors to console
  console.error('[Global API Error]:', err)

  if (err instanceof AppError) {
    return c.json(
      { 
        error: err.message, 
        code: err.code,
        ...(err.details ? { details: err.details } : {})
      }, 
      err.statusCode as any
    )
  }

  // MUST NOT DO: Do not suppress 500 errors; log them already done above
  return c.json(
    { error: err.message || 'An unexpected error occurred on the server' }, 
    500
  )
})

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const PATCH = handle(app)

export default app
```

**Step 4: Run test to verify it passes**

Run: `npx vitest tests/api/error-handler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/[[...route]]/route.ts tests/api/error-handler.test.ts
git commit -m "feat: implement global error handler in Hono"
```
