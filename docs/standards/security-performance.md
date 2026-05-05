# Security & Performance Standards

## Security Checklist

### Input Validation
- Semua API input wajib validasi dengan Zod schema
- Sanitize user input sebelum render ke HTML
- Validate file upload: type, size, content
- Reject unexpected fields (strict schema)

### Authentication & Authorization
- Session-based auth dengan secure cookie (httpOnly, sameSite)
- RBAC enforcement di setiap protected route via `hasPermission()`
- Site restriction untuk multi-tenant isolation
- Token version untuk force logout

### Data Protection
- Sensitive data (password, token) wajib hashed/encrypted
- No secrets di code atau environment variables production
- Audit log untuk sensitive operations (delete, permission change)
- PII data handling sesuai regulasi

### API Security
- Rate limiting per endpoint (prevent brute force)
- CSRF protection untuk state-changing operations
- SQL injection prevention via Prisma parameterized queries
- No raw SQL query kecuali absolutely necessary

### Network Security
- HTTPS only di production
- Secure headers (HSTS, X-Frame-Options, CSP)
- CORS configuration yang ketat

## Observability & Logging

### Structured Logging
```typescript
// Good
logger.info("user.created", { 
  userId, 
  tenantId, 
  duration: Date.now() - start,
  metadata: { role, site }
});

// Bad
console.log("User created:", userId);
```

### Log Levels
- `error`: System failure, requires immediate action (500 errors, unhandled exceptions)
- `warn`: Degraded state, needs investigation (retry exhausted, fallback used)
- `info`: Business events, audit trail (user.created, invoice.paid)
- `debug`: Development troubleshooting (disabled in production)

### What to Log
- API requests: method, path, status, duration, userId
- Database operations: operation type, table, duration
- Business events: domain events untuk audit trail
- Errors: full stack trace + context

### What NOT to Log
- Passwords, tokens, API keys
- PII data (email, phone) kecuali untuk audit trail
- Large payloads (> 1KB) — log summary saja

### Metrics to Track
- API response time (p50, p95, p99)
- Database query duration
- Error rate per endpoint
- Active sessions count
- Cache hit rate

## Performance Budget

### API Response Time
- p50: < 100ms
- p95: < 200ms
- p99: < 500ms
- Max: 1000ms (timeout threshold)

### Database Query
- Simple query: < 10ms
- Complex query: < 100ms
- Report query: < 1000ms (use background job if > 1000ms)

### Bundle Size
- Initial JS: < 200KB
- Images: Lazy load, WebP format
- API Payload: < 100KB (gzip)

### Memory Usage
- API route: < 50MB per request
- Background job: < 256MB
- Total instance: < 1GB (untuk horizontal scaling)

## Scalability Preparation

### Database Strategy
```typescript
// WAJIB index untuk field yang sering di-query
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  tenantId  String   // WAJIB index
  siteId    String?  // WAJIB index
  roleId    String?  // WAJIB index
  createdAt DateTime @default(now())
  
  @@index([tenantId, createdAt]) // Compound index untuk query common
  @@index([siteId, roleId])      // Compound index untuk filter
}
```

### Query Optimization
- Selalu `EXPLAIN` query sebelum deploy ke production
- N+1 query detection: gunakan Prisma `include` atau DataLoader pattern
- Pagination wajib untuk list endpoint (no unlimited queries)

### Horizontal Scaling
- No in-memory session (gunakan Redis)
- No local file storage (gunakan S3)
- No in-memory cache untuk shared data (gunakan Redis)
- Semua config via environment variables
- Support multiple instances (no singleton yang prevent scaling)
