# Payment Gateway Environment Fix - 2026-08-08

## 🚨 CRITICAL ISSUE FOUND

**Status:** `NEXT_PUBLIC_APP_URL` undefined di production Kubernetes  
**Impact:** Payment gateway callbacks menggunakan invalid URLs (`undefined/api/webhooks/...`)  
**Severity:** 🔴 HIGH - Silent failure, webhooks tidak sampai, users tidak bisa redirect setelah pembayaran

---

## Root Cause

Environment variable `NEXT_PUBLIC_APP_URL` tidak didefinisikan di `k8s/production/configmap.yaml`:

**Before:**
```yaml
data:
  DOMAIN: "radpro.id"
  AUTH_URL: "https://radpro.id"
  NEXTAUTH_URL: "https://radpro.id"
  # ❌ NEXT_PUBLIC_APP_URL: MISSING
```

**Verification Command:**
```bash
ssh radpro "sudo kubectl exec -n netmanager-production <pod-name> -- printenv NEXT_PUBLIC_APP_URL"
# Output: undefined
```

**Impact di Payment Providers:**
```typescript
// xendit-provider.ts:58
successRedirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`
// Result: "undefined/payment/success" ❌

// duitku-provider.ts:53
callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/duitku`
// Result: "undefined/api/webhooks/duitku" ❌
```

---

## Fix Applied

### 1. Updated ConfigMap

**File:** `k8s/production/configmap.yaml`

```yaml
data:
  DOMAIN: "radpro.id"
  AUTH_URL: "https://radpro.id"
  NEXTAUTH_URL: "https://radpro.id"
  NEXT_PUBLIC_APP_URL: "https://radpro.id"  # ✅ ADDED
  TZ: "Asia/Jakarta"
  NODE_ENV: "production"
  ALLOWED_ORIGINS: "https://radpro.id,https://admin.radpro.id,https://karyawan.radpro.id,https://pelanggan.radpro.id,https://investor.radpro.id"
  K8S_NAMESPACE: "netmanager-production"
```

### 2. Scripts Created

**Check Script:** `scripts/check-production-env.sh`
- Verify current env vars di production
- Test payment gateway callback URLs
- Show recommendations

**Fix Script:** `scripts/fix-payment-gateway-env.sh`
- Apply updated ConfigMap
- Rolling restart pods
- Verify env vars di new pods

---

## Deployment Instructions

### Step 1: Verify Current State (Pre-Fix)

```bash
# From local machine
./scripts/check-production-env.sh
```

**Expected Output (Before Fix):**
```
❌ NEXT_PUBLIC_APP_URL: NOT SET (CRITICAL)
✅ AUTH_URL: https://radpro.id
✅ NEXTAUTH_URL: https://radpro.id
✅ DOMAIN: radpro.id

Current behavior:
Xendit callback: undefined/payment/success
Duitku webhook: undefined/api/webhooks/duitku
```

### Step 2: Apply Fix

```bash
# From local machine
./scripts/fix-payment-gateway-env.sh
```

**What it does:**
1. Apply updated ConfigMap (`kubectl apply -f k8s/production/configmap.yaml`)
2. Rolling restart app & worker deployments
3. Wait for rollout completion
4. Verify env vars di new pods

**Downtime:** Zero (rolling update)

### Step 3: Verify Fix Applied

```bash
# Check env var di new pods
ssh radpro "sudo kubectl get pods -n netmanager-production -l app=netmanager-app"

POD_NAME="<new-pod-name>"
ssh radpro "sudo kubectl exec -n netmanager-production $POD_NAME -- printenv NEXT_PUBLIC_APP_URL"
# Expected: https://radpro.id ✅
```

### Step 4: Test Payment Gateway

```bash
# Test callback URL generation
ssh radpro "sudo kubectl exec -n netmanager-production $POD_NAME -- node -e \"
const url = process.env.NEXT_PUBLIC_APP_URL;
console.log('Xendit callback:', \\\`\\\${url}/payment/success\\\`);
console.log('Duitku webhook:', \\\`\\\${url}/api/webhooks/duitku\\\`);
\""
```

**Expected Output:**
```
Xendit callback: https://radpro.id/payment/success ✅
Duitku webhook: https://radpro.id/api/webhooks/duitku ✅
```

---

## Rollback Plan

Jika terjadi masalah setelah deploy:

```bash
# Rollback to previous deployment
ssh radpro "sudo kubectl rollout undo deployment/netmanager-app -n netmanager-production"
ssh radpro "sudo kubectl rollout undo deployment/netmanager-worker -n netmanager-production"

# Or restore previous ConfigMap
git checkout HEAD~1 -- k8s/production/configmap.yaml
ssh radpro "sudo kubectl apply -f k8s/production/configmap.yaml"
ssh radpro "sudo kubectl rollout restart deployment/netmanager-app -n netmanager-production"
```

---

## Impact Analysis

### Before Fix (Current Production)
- ❌ Payment gateway callbacks: `undefined/api/webhooks/{provider}`
- ❌ Success redirect: `undefined/payment/success`
- ❌ Failure redirect: `undefined/payment/failed`
- ❌ Webhooks dari Xendit/Midtrans/Duitku/etc tidak sampai ke server
- ❌ Users tidak bisa redirect setelah pembayaran selesai
- ❌ Silent failure (tidak ada error di logs, tapi payment gateway reject URLs)

### After Fix
- ✅ Payment gateway callbacks: `https://radpro.id/api/webhooks/{provider}`
- ✅ Success redirect: `https://radpro.id/payment/success`
- ✅ Failure redirect: `https://radpro.id/payment/failed`
- ✅ Webhooks akan sampai ke server dengan benar
- ✅ Users bisa redirect ke halaman success/failed
- ✅ Payment gateway providers akan accept URLs

---

## Related Issues

**Audit Report:** `docs/reports/PAYMENT_GATEWAY_AUDIT_2026-08-08.md`
- Section: 🔴 Critical Issues #1
- Priority: HIGH
- Impact: Silent failure di production

**Next Steps:**
1. ✅ Fix environment variable (this document)
2. ⏳ Add centralized env helper dengan validation
3. ⏳ Add startup validation untuk critical env vars
4. ⏳ Add CI/CD check untuk missing env vars

---

## Verification Checklist

Setelah apply fix, verify:

- [ ] ConfigMap updated di cluster
- [ ] Pods restarted dengan rollout success
- [ ] `NEXT_PUBLIC_APP_URL` terset di new pods
- [ ] Callback URLs generate dengan benar (tidak ada "undefined")
- [ ] No errors di application logs
- [ ] Health check endpoint (`/api/health`) returns 200
- [ ] Test create payment via admin UI (jika sudah ada fitur)

---

**Created by:** Claude Code (Payment Gateway Audit)  
**Date:** 2026-08-08  
**Status:** Ready to deploy  
**Review:** Required before production deployment
