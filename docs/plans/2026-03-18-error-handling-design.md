# Design Doc: Robust Custom Error Classes and Global Error Handler

- **Date**: 2026-03-18
- **Topic**: Error Handling Standardization
- **Status**: Draft (Approved)

## 1. Introduction
Currently, the application lacks a centralized and consistent error handling mechanism. While there are some existing error classes in `lib/middleware/error-handler.ts`, they are not universally used, and many routes handle errors inconsistently. This design introduces a unified set of Custom Error Classes and a global `onError` handler using Hono for the API.

## 2. Proposed Design

### 2.1. Custom Error Classes (`lib/errors.ts`)
We will create a new library dedicated to custom error classes.

```typescript
/**
 * Base Application Error
 */
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

/**
 * 400 Bad Request / Validation
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * 503 Service Unavailable (Radius specific)
 */
export class RadiusConnectionError extends AppError {
  constructor(message: string = 'Failed to connect to Radius server') {
    super(message, 503, 'RADIUS_CONNECTION_ERROR');
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}
```

### 2.2. Global Hono `onError` Middleware
We will implement a global error handler in the Hono API router.

```typescript
import { Hono } from 'hono';
import { AppError } from '@/lib/errors';

const app = new Hono().basePath('/api');

app.onError((err, c) => {
  // 1. Log all errors to console
  console.error('[Global API Error]:', err);

  // 2. Structured response for custom AppError
  if (err instanceof AppError) {
    return c.json(
      { 
        error: err.message, 
        code: err.code,
        ...(err.details ? { details: err.details } : {})
      }, 
      err.statusCode as any
    );
  }

  // 3. Structured response for other standard Errors
  return c.json(
    { error: err.message || 'An unexpected error occurred on the server' }, 
    500
  );
});

export default app;
```

## 3. Implementation Steps

1. Create `lib/errors.ts` with the new classes.
2. If Hono router exists, update it with `app.onError`. If not, we will need to wrap current Next.js API routes or introduce a Hono bridge.
3. Update existing routes that use the old error handler to use the new classes.

## 4. Success Criteria
- [ ] `lib/errors.ts` exists and contains required classes.
- [ ] API routes consistently return structured JSON errors.
- [ ] All errors are logged to `console.error`.
- [ ] Existing `AppError` usage is migrated or remains compatible.
