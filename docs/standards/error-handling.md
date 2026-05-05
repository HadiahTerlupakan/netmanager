# Error Handling Standard

## Standardized Error Pattern: Result<T, E>

Gunakan Result pattern untuk predictable error handling:

```typescript
// Type definition
type Result<T, E = string> = 
  | { success: true; data: T }
  | { success: false; error: E; code?: string };

// Service layer
async function createInvoice(data: CreateInvoiceInput): Promise<Result<Invoice>> {
  // Validation error
  if (!data.pelangganId) {
    return { success: false, error: "Pelanggan required", code: "VALIDATION_ERROR" };
  }
  
  // Business rule violation
  const existing = await repository.findByNumber(data.invoiceNumber);
  if (existing) {
    return { success: false, error: "Invoice number already exists", code: "DUPLICATE" };
  }
  
  // Success
  const invoice = await repository.create(data);
  return { success: true, data: invoice };
}

// API route
const result = await service.createInvoice(data);
if (!result.success) {
  if (result.code === "VALIDATION_ERROR") return ApiErrors.badRequest(result.error);
  if (result.code === "DUPLICATE") return ApiErrors.conflict(result.error);
  return ApiErrors.internalError(result.error);
}
return apiSuccess(result.data);
```

## When to Throw (Exceptions)

- Unexpected errors: database connection lost, out of memory
- Programming errors: null pointer, type mismatch, assertion failure
- Infrastructure failures: external API timeout, file system error
- Framework errors: Next.js routing error, middleware failure

## When to Return Result

- Business rule violations: insufficient balance, duplicate entry, invalid state transition
- Validation errors: invalid input, missing required field, format error
- Expected failures: not found, already exists, permission denied
- Domain errors: workflow violation, constraint violation

## Error Categories

- `400 Bad Request`: Input validation failure
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permission
- `404 Not Found`: Resource tidak ditemukan
- `409 Conflict`: Business rule violation
- `500 Internal Error`: Unexpected server error

## Error Handling Pattern

```typescript
// API Route
try {
  const result = await service.doSomething(input);
  return apiSuccess(result);
} catch (error) {
  logger.error("operation.failed", error, { context });
  return ApiErrors.internalError("Gagal memproses request");
}

// Service Layer
if (!entity) {
  return { success: false, error: "Entity not found", code: "NOT_FOUND" };
}
```
