# Pelanggan Authentication Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate authentication guarding for the `pelanggan` (customer) subdomain and root paths into `proxy.ts`.

**Architecture:** We will add a guard in Section 4 to check for the `CUSTOMER` role, a rewrite in Section 5 to map the root path to `/dashboard`, and root domain protection for `/dashboard` and `/customer`.

**Tech Stack:** Next.js, TypeScript, Next-Auth.

---

### Task 1: Add Pelanggan Guard to Section 4

**Files:**
- Modify: `proxy.ts`

**Step 1: Implement the guard**

Add the following block after the `karyawan` guard:

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

**Step 2: Verify with lsp_diagnostics**

Run: `lsp_diagnostics proxy.ts`
Expected: No errors related to the new block.

**Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(proxy): add authentication guard for pelanggan subdomain"
```

### Task 2: Add Pelanggan Rewrite to Section 5

**Files:**
- Modify: `proxy.ts`

**Step 1: Implement the rewrite**

Add the following block after the `investor` rewrite:

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

**Step 2: Verify with lsp_diagnostics**

Run: `lsp_diagnostics proxy.ts`
Expected: No errors.

**Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(proxy): add rewrite logic for pelanggan subdomain"
```

### Task 3: Add Root Domain Protection

**Files:**
- Modify: `proxy.ts`

**Step 1: Implement root domain guard**

Add the following block to the `else` (root domain) section of Section 5:

```typescript
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/customer')) {
      if (token?.role !== 'CUSTOMER' && token?.role !== 'SUPER_ADMIN' && !pathname.includes('/login')) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }
```

**Step 2: Final Verification**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(proxy): protect customer root paths on main domain"
```
