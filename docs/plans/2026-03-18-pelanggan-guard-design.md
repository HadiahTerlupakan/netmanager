# Pelanggan Authentication Guard Design

**Date:** 2026-03-18
**Status:** Approved (via system directive)

## 1. Purpose
Integrate missing authentication guards for the `pelanggan` (customer) subdomain and related root paths into `proxy.ts` without breaking existing multi-tenant logic.

## 2. Architecture

### 2.1 Subdomain Detection
The existing logic in `proxy.ts` Section 3 already identifies the `pelanggan` subdomain. We will utilize this.

### 2.2 Authentication Guard (Section 4)
We will add a specific block for `pelanggan`:
- It ensures only users with `CUSTOMER` or `SUPER_ADMIN` roles can access the subdomain.
- It redirects unauthenticated or unauthorized users to `/login`.

### 2.3 Rewrite Execution (Section 5)
We will add a rewrite block for `pelanggan`:
- If `pathname` is `/`, it rewrites to `/dashboard`.
- Other paths pass through (e.g., `pelanggan.domain.com/profil` stays `/profil` but serves from `app/(customer)/profil`).

### 2.4 Root Domain Logic
We will add protection for `/dashboard` and `/customer` paths on the root domain.

## 3. Implementation Details

### Section 4 Addition:
```typescript
  // Redirect unauthorized access to Customer Subdomain
  if (subdomain === 'pelanggan') {
    if (!pathname.includes('/login')) {
      if (token?.role !== 'CUSTOMER' && token?.role !== 'SUPER_ADMIN') {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', 'AccessDenied')
        return NextResponse.redirect(loginUrl)
      }
    }
  }
```

### Section 5 Addition (Subdomain):
```typescript
  } else if (subdomain === 'pelanggan') {
    let rewritePath = pathname
    if (rewritePath === '/') {
      rewritePath = '/dashboard'
    }
    const newUrl = new URL(rewritePath, request.url)
    newUrl.search = url.search
    response = NextResponse.rewrite(newUrl)
```

### Section 5 Addition (Root):
```typescript
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/customer')) {
      if (token?.role !== 'CUSTOMER' && token?.role !== 'SUPER_ADMIN' && !pathname.includes('/login')) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }
```

## 4. Verification
- `npm run typecheck` or `lsp_diagnostics` to ensure no errors in `proxy.ts`.
- Verify the `role` field matches `CUSTOMER`.
