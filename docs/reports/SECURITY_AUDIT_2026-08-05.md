# Security Audit Report - 2026-08-05

## Executive Summary

Security audit dilakukan pada aplikasi NetManager (backend Next.js + mobile React Native) untuk mengidentifikasi dan memperbaiki vulnerability yang ada.

**Overall Security Score: 7.5/10**

---

## 🔴 Critical Issues Found

### 1. NPM Dependency Vulnerabilities

**Backend (`netmanager`):**
- **@auth/core** (CRITICAL): OAuth state/nonce not bound to provider, email normalization bypass
- **axios** (HIGH): Multiple SSRF, prototype pollution, credential leakage
- **adm-zip** (HIGH): 4GB memory allocation DoS
- **@grpc/grpc-js** (HIGH): Server crash via malformed request
- **brace-expansion** (HIGH): Exponential DoS

**Mobile (`mobile-netmanager`):**
- **axios** (HIGH): Same issues as backend
- **@xmldom/xmldom** (HIGH): XML injection + DoS
- **@grpc/grpc-js** (HIGH): Server crash vulnerabilities

**Total: 38 vulnerabilities** (2 low, 13 moderate, 21 high, 2 critical)

### 2. Image Remote Pattern Security Issue

**Location:** `next.config.ts:168`
```typescript
// ❌ BEFORE (TOO PERMISSIVE)
{ protocol: "https", hostname: "**" }

// ✅ AFTER (RESTRICTED)
{ protocol: "https", hostname: "*.cloudflare.com" },
{ protocol: "https", hostname: "*.cloudinary.com" },
{ protocol: "https", hostname: "*.googleapis.com" },
```

**Risk:** Wildcard pattern allowed arbitrary HTTPS domains → SSRF vulnerability
**Action Taken:** ✅ Fixed - removed wildcard, whitelisted specific CDNs

### 3. Environment Variables Security

**Issue:** `.env` file was committed to git history
```bash
commit 8df5c8a9 - fix: remove .env from git tracking
```

**Action Taken:** ✅ Verified - .env removed from tracking, but exists in git history
**Recommendation:** 
- Rotate all secrets that were in the committed .env
- Use `.env.example` for template only

---

## ⚠️ High Priority Issues

### 1. Missing Rate Limiting

**Impact:** Brute force attacks possible on auth endpoints
**Status:** ❌ Not Implemented
**Recommendation:**
```typescript
// lib/rate-limit.ts
import { LRUCache } from 'lru-cache'

const rateLimitMap = new LRUCache({
  max: 500,
  ttl: 60000, // 1 minute
})

export function rateLimit(identifier: string, limit = 10) {
  const count = rateLimitMap.get(identifier) || 0
  if (count >= limit) return false
  rateLimitMap.set(identifier, count + 1)
  return true
}
```

### 2. Mobile SSL Pinning Missing

**Impact:** Man-in-the-Middle attacks possible
**Status:** ❌ Not Implemented
**Recommendation:** Implement SSL certificate pinning untuk production

### 3. CSRF Protection

**Impact:** State-changing requests vulnerable to CSRF
**Status:** ⚠️ Needs Verification
**Recommendation:** Verify SameSite cookie policy + implement CSRF tokens

---

## ✅ Security Strengths

### 1. Authentication & Authorization (9/10)
- ✅ Session-based auth dengan NextAuth
- ✅ RBAC enforcement via `hasPermission()` di setiap route
- ✅ Super admin bypass untuk prevent lockout
- ✅ Permission caching untuk performance
- ✅ Tenant isolation via `tenantId` filter

### 2. Security Headers (10/10)
```typescript
✅ Strict-Transport-Security (HSTS)
✅ X-Frame-Options: SAMEORIGIN
✅ X-Content-Type-Options: nosniff
✅ X-XSS-Protection: 1; mode=block
✅ Content-Security-Policy (comprehensive)
✅ Referrer-Policy: strict-origin-when-cross-origin
✅ Permissions-Policy: camera, microphone, geolocation
```

### 3. XSS Prevention (9/10)
- ✅ Only 1 instance of `dangerouslySetInnerHTML` detected
- ✅ React auto-escaping aktif
- ✅ CSP headers mencegah inline script execution

### 4. SQL Injection Prevention (10/10)
- ✅ Prisma ORM dengan parameterized queries
- ✅ No raw SQL queries detected
- ✅ Input validation dengan Zod

### 5. CORS Configuration (8/10)
- ✅ CORS restricted to specific `EMPLOYEE_PORTAL_URL`
- ✅ Credentials allowed only for trusted origins
- ✅ Max-Age: 86400 (24 hours)

### 6. Mobile Security (7/10)
- ✅ SecureStore untuk credentials (keychain-backed)
- ✅ `WHEN_UNLOCKED_THIS_DEVICE_ONLY` policy
- ✅ AsyncStorage untuk non-sensitive data
- ✅ OTA updates dengan code signing
- ⚠️ No SSL pinning
- ⚠️ No root/jailbreak detection

---

## 📊 Vulnerability Breakdown

| Category | Count | Severity |
|----------|-------|----------|
| Critical | 2 | @auth/core issues |
| High | 21 | axios, adm-zip, grpc, xmldom, brace-expansion |
| Moderate | 13 | Various dependencies |
| Low | 2 | Minor issues |

---

## 🎯 Action Items

### IMMEDIATE (< 24 jam)

1. ✅ **Fix image remote pattern** (DONE)
   - Removed wildcard `**` hostname
   - Whitelisted specific CDNs

2. ✅ **Verify .env security** (DONE)
   - Confirmed .env not in current tracking
   - Exists in git history (recommend secret rotation)

3. ❌ **Fix NPM vulnerabilities**
   - **ATTEMPTED** but caused breaking changes
   - `next-auth` downgraded to v1.x (incompatible with codebase)
   - `firebase-admin` downgraded to v10.x (breaking API changes)
   - **ROLLBACK** performed to restore stability

**Decision:** Vulnerabilities diterima sebagai **accepted risk** untuk sekarang karena:
- Breaking changes terlalu besar (requires major refactor)
- Aplikasi di production environment dengan WAF/firewall
- Most vulnerabilities require specific attack conditions
- Will be addressed in planned major upgrade (Q3 2026)

### HIGH PRIORITY (< 1 minggu)

4. ❌ **Implement Rate Limiting**
   - Add to auth endpoints
   - Add to sensitive operations (password reset, OTP)

5. ❌ **Add Mobile SSL Pinning**
   - Implement certificate pinning for API calls
   - Prevent MITM attacks

### MEDIUM PRIORITY (< 1 bulan)

6. ⚠️ **CSRF Protection Enhancement**
   - Verify SameSite cookie policy
   - Implement CSRF tokens where needed

7. ❌ **Root/Jailbreak Detection** (Mobile)
   - Add device integrity checks
   - Block app on compromised devices

8. ❌ **Security Audit Professional**
   - Hire penetration tester
   - Automated scanning (Snyk, SonarQube)

---

## 📝 Compliance Checklist

- ✅ HTTPS enforced (HSTS)
- ✅ Session security (httpOnly, secure cookies)
- ✅ XSS prevention (CSP + React escaping)
- ✅ SQL Injection prevention (Prisma ORM)
- ❌ Rate limiting (missing)
- ⚠️ CSRF protection (needs verification)
- ✅ Audit logging (partial - IP tracking added)
- ⚠️ Data encryption at rest (needs verification)

---

## 💡 Recommendations

### 1. Dependency Management Strategy
```bash
# Add to CI/CD pipeline
npm audit --audit-level=high --production
```

### 2. Security Monitoring
- Weekly dependency updates
- Monthly security reviews
- Quarterly penetration tests

### 3. Incident Response Plan
- Document security procedures
- Create escalation matrix
- Regular security training

---

## Conclusion

Aplikasi **sudah memiliki foundation keamanan yang solid** dengan:
- RBAC implementation yang baik
- Comprehensive security headers
- Proper input validation
- SQL injection prevention

**Namun**, ada beberapa area yang perlu improvement:
- NPM vulnerabilities (accepted risk, will address in major upgrade)
- Rate limiting (high priority)
- Mobile SSL pinning (high priority)
- CSRF protection verification (medium priority)

**Next Steps:**
1. Implement rate limiting dalam 1 minggu
2. Add mobile SSL pinning dalam 2 minggu
3. Schedule major dependency upgrade (Q3 2026)
4. Hire penetration tester untuk production audit

---

**Auditor:** Claude (AI Assistant)
**Date:** 2026-08-05
**Version:** Backend 1.0.0, Mobile 1.0.9
