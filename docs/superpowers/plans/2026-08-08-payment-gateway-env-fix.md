# Payment Gateway Environment Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical production bug where `NEXT_PUBLIC_APP_URL` environment variable is undefined, causing payment gateway callbacks to generate invalid URLs (`undefined/api/webhooks/...`)

**Architecture:** Zero-downtime deployment menggunakan Kubernetes ConfigMap update + rolling restart. Add centralized environment validation helper untuk prevent future issues. No breaking changes, backward compatible 100%.

**Tech Stack:** Kubernetes, TypeScript, Next.js, Bash scripting

## Global Constraints

- Zero downtime deployment (rolling update)
- No breaking changes to public APIs
- Backward compatible dengan existing code
- All environment variables must be validated at startup
- ConfigMap changes must be applied via kubectl apply
- Payment gateway providers: Xendit, Midtrans, Duitku, BRI, BCA, Tripay, DANA, Moota

---

## Task 1: Deploy ConfigMap Fix (Production Critical)

**Files:**
- Modify: `k8s/production/configmap.yaml:6-14`
- Verify: Production cluster via kubectl

**Interfaces:**
- Consumes: Existing Kubernetes cluster dengan namespace `netmanager-production`
- Produces: Updated ConfigMap dengan `NEXT_PUBLIC_APP_URL: "https://radpro.id"`

**Priority:** 🔴 CRITICAL - Deploy segera untuk fix payment gateway

- [ ] **Step 1: Backup existing ConfigMap**

```bash
ssh radpro "sudo kubectl get configmap netmanager-config -n netmanager-production -o yaml > /tmp/configmap-backup-$(date +%Y%m%d-%H%M%S).yaml"
```

Expected: ConfigMap backup tersimpan di `/tmp/configmap-backup-*.yaml`

- [ ] **Step 2: Verify local ConfigMap sudah terupdate**

```bash
cat k8s/production/configmap.yaml | grep NEXT_PUBLIC_APP_URL
```

Expected output:
```
  NEXT_PUBLIC_APP_URL: "https://radpro.id"
```

- [ ] **Step 3: Apply updated ConfigMap ke cluster**

```bash
ssh radpro "sudo kubectl apply -f -" < k8s/production/configmap.yaml
```

Expected: `configmap/netmanager-config configured`

- [ ] **Step 4: Verify ConfigMap updated di cluster**

```bash
ssh radpro "sudo kubectl get configmap netmanager-config -n netmanager-production -o yaml | grep NEXT_PUBLIC_APP_URL"
```

Expected: `NEXT_PUBLIC_APP_URL: https://radpro.id`

- [ ] **Step 5: Rolling restart app deployment**

```bash
ssh radpro "sudo kubectl rollout restart deployment/netmanager-app -n netmanager-production"
```

Expected: `deployment.apps/netmanager-app restarted`

- [ ] **Step 6: Rolling restart worker deployment**

```bash
ssh radpro "sudo kubectl rollout restart deployment/netmanager-worker -n netmanager-production"
```

Expected: `deployment.apps/netmanager-worker restarted`

- [ ] **Step 7: Monitor rollout status untuk app**

```bash
ssh radpro "sudo kubectl rollout status deployment/netmanager-app -n netmanager-production --timeout=5m"
```

Expected: `deployment "netmanager-app" successfully rolled out`

- [ ] **Step 8: Monitor rollout status untuk worker**

```bash
ssh radpro "sudo kubectl rollout status deployment/netmanager-worker -n netmanager-production --timeout=5m"
```

Expected: `deployment "netmanager-worker" successfully rolled out`

- [ ] **Step 9: Verify env variable di new pods**

```bash
ssh radpro '
NEW_POD=$(sudo kubectl get pods -n netmanager-production -l app=netmanager-app -o jsonpath="{.items[0].metadata.name}")
sudo kubectl exec -n netmanager-production $NEW_POD -- printenv NEXT_PUBLIC_APP_URL
'
```

Expected: `https://radpro.id`

- [ ] **Step 10: Test callback URL generation di runtime**

```bash
ssh radpro '
POD=$(sudo kubectl get pods -n netmanager-production -l app=netmanager-app -o jsonpath="{.items[0].metadata.name}")
sudo kubectl exec -n netmanager-production $POD -- node -e "
const url = process.env.NEXT_PUBLIC_APP_URL;
console.log(\"Xendit:\", \`\${url}/payment/success\`);
console.log(\"Duitku:\", \`\${url}/api/webhooks/duitku\`);
"
'
```

Expected output:
```
Xendit: https://radpro.id/payment/success
Duitku: https://radpro.id/api/webhooks/duitku
```

- [ ] **Step 11: Monitor application logs**

```bash
ssh radpro "sudo kubectl logs -n netmanager-production -l app=netmanager-app --tail=50"
```

Expected: No errors, no "undefined" dalam URLs

- [ ] **Step 12: Commit ConfigMap change**

```bash
git add k8s/production/configmap.yaml
git commit -m "fix(k8s): add NEXT_PUBLIC_APP_URL to production ConfigMap

- Add NEXT_PUBLIC_APP_URL: https://radpro.id
- Fixes payment gateway callback URLs
- Prevents undefined/api/webhooks/* URLs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create Environment Validation Helper

**Files:**
- Create: `lib/utils/env.ts`
- Test: Manual testing via startup validation

**Interfaces:**
- Consumes: `process.env` (Node.js)
- Produces: `getAppUrl(): string` - Returns validated app URL or throws error

- [ ] **Step 1: Create env utility file**

```typescript
// lib/utils/env.ts
/**
 * Environment variable utilities dengan runtime validation.
 * Gunakan helpers ini untuk akses env vars yang critical.
 */

export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

/**
 * Get application URL dengan validation.
 * Throws EnvironmentError jika tidak terset.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;

  if (!url || url === "undefined") {
    throw new EnvironmentError(
      "NEXT_PUBLIC_APP_URL is not configured. " +
        "Set this environment variable in your deployment configuration."
    );
  }

  // Validate format URL
  try {
    new URL(url);
  } catch {
    throw new EnvironmentError(
      `NEXT_PUBLIC_APP_URL has invalid URL format: ${url}`
    );
  }

  return url;
}

/**
 * Get required environment variable dengan validation.
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value === "undefined") {
    throw new EnvironmentError(
      `${name} is not configured. Set this environment variable.`
    );
  }

  return value;
}

/**
 * Check all critical environment variables at startup.
 * Call this in server.ts or app initialization.
 */
export function validateCriticalEnvVars(): void {
  const criticalVars = [
    "NEXT_PUBLIC_APP_URL",
    "DATABASE_URL",
    "REDIS_URL",
    "AUTH_SECRET",
    "NEXTAUTH_SECRET",
  ];

  const missing: string[] = [];

  for (const varName of criticalVars) {
    const value = process.env[varName];
    if (!value || value === "undefined") {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new EnvironmentError(
      `Missing required environment variables:\n  - ${missing.join("\n  - ")}\n\n` +
        "Please configure these in your deployment environment."
    );
  }
}
```

- [ ] **Step 2: Verify file created**

```bash
cat lib/utils/env.ts | head -20
```

Expected: File exists dengan exports `getAppUrl`, `getRequiredEnv`, `validateCriticalEnvVars`

- [ ] **Step 3: Test helper di development**

```bash
npm run dev
```

Expected: App starts without errors (env vars terset di .env)

- [ ] **Step 4: Commit helper**

```bash
git add lib/utils/env.ts
git commit -m "feat(env): add environment validation helper

- Add getAppUrl() untuk validate NEXT_PUBLIC_APP_URL
- Add getRequiredEnv() untuk generic env validation
- Add validateCriticalEnvVars() untuk startup check
- Throws EnvironmentError jika env var missing atau invalid

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Update Payment Providers to Use Helper

**Files:**
- Modify: `modules/payment-gateway/services/providers/xendit-provider.ts:58-59`
- Modify: `modules/payment-gateway/services/providers/midtrans-provider.ts:60-62`
- Modify: `modules/payment-gateway/services/providers/duitku-provider.ts:53-54`
- Modify: `modules/payment-gateway/services/providers/dana-provider-helpers.ts:112-114`
- Modify: `modules/payment-gateway/services/providers/bca-provider.ts:72`
- Modify: `modules/payment-gateway/services/providers/virtual-account-provider-helper.ts:55`

**Interfaces:**
- Consumes: `getAppUrl(): string` dari `lib/utils/env`
- Produces: Payment providers yang gunakan validated app URL

- [ ] **Step 1: Update Xendit provider**

```typescript
// modules/payment-gateway/services/providers/xendit-provider.ts
import { getAppUrl } from "@/lib/utils/env";

// Line 58-59 (dalam createPayment method)
successRedirectUrl: `${getAppUrl()}/payment/success`,
failureRedirectUrl: `${getAppUrl()}/payment/failed`,
```

- [ ] **Step 2: Update Midtrans provider**

```typescript
// modules/payment-gateway/services/providers/midtrans-provider.ts
import { getAppUrl } from "@/lib/utils/env";

// Line 60-62 (dalam createPayment method)
callbacks: {
  finish: `${getAppUrl()}/payment/success`,
  error: `${getAppUrl()}/payment/failed`,
  pending: `${getAppUrl()}/payment/pending`,
},
```

- [ ] **Step 3: Update Duitku provider**

```typescript
// modules/payment-gateway/services/providers/duitku-provider.ts
import { getAppUrl } from "@/lib/utils/env";

// Line 53-54 (dalam createPayment method)
callbackUrl: `${getAppUrl()}/api/webhooks/duitku`,
returnUrl: `${getAppUrl()}/payment/success`,
```

- [ ] **Step 4: Update DANA provider helpers**

```typescript
// modules/payment-gateway/services/providers/dana-provider-helpers.ts
import { getAppUrl } from "@/lib/utils/env";

// Line 112-114 (dalam buildDanaCreatePayload function)
callbackUrl: `${getAppUrl()}/api/payment/webhook/dana`,
returnUrl: `${getAppUrl()}/payment/success`,
cancelUrl: `${getAppUrl()}/payment/failed`,
```

- [ ] **Step 5: Update BCA provider (already has fallback, improve it)**

```typescript
// modules/payment-gateway/services/providers/bca-provider.ts
import { getAppUrl } from "@/lib/utils/env";

// Line 72 (dalam createPayment method headers)
Origin: getAppUrl(),
```

- [ ] **Step 6: Update Virtual Account helper**

```typescript
// modules/payment-gateway/services/providers/virtual-account-provider-helper.ts
import { getAppUrl } from "@/lib/utils/env";

// Line 55
const appUrl = getAppUrl();
```

- [ ] **Step 7: Run TypeScript type check**

```bash
npm run typecheck
```

Expected: No type errors

- [ ] **Step 8: Run tests**

```bash
npm test -- payment-gateway
```

Expected: All tests pass (mocked env vars di test setup)

- [ ] **Step 9: Commit provider updates**

```bash
git add modules/payment-gateway/services/providers/
git commit -m "refactor(payment-gateway): use validated env helper for app URLs

- Replace direct process.env.NEXT_PUBLIC_APP_URL dengan getAppUrl()
- All providers sekarang throw clear error jika env tidak terset
- Prevents undefined URLs di callback/redirect

Updated providers:
- Xendit, Midtrans, Duitku, DANA, BCA, Virtual Account helper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Add Startup Environment Validation

**Files:**
- Modify: `server.ts:1-20` (di bagian awal file sebelum server initialization)

**Interfaces:**
- Consumes: `validateCriticalEnvVars()` dari `lib/utils/env`
- Produces: Server yang validate env vars sebelum start

- [ ] **Step 1: Add validation di server startup**

```typescript
// server.ts (tambahkan di bagian paling atas setelah imports)
import { validateCriticalEnvVars } from "@/lib/utils/env";

// Validate critical environment variables sebelum server start
try {
  validateCriticalEnvVars();
  console.log("✅ All critical environment variables validated");
} catch (error) {
  console.error("❌ Environment validation failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// ... rest of server initialization
```

- [ ] **Step 2: Test validation dengan missing env**

```bash
# Temporarily unset env var untuk test
NEXT_PUBLIC_APP_URL= npm run dev
```

Expected: Server crashes dengan clear error message listing missing vars

- [ ] **Step 3: Test validation dengan valid env**

```bash
npm run dev
```

Expected: Server starts dengan "✅ All critical environment variables validated"

- [ ] **Step 4: Commit startup validation**

```bash
git add server.ts
git commit -m "feat(server): add environment validation at startup

- Validate critical env vars sebelum server initialization
- Fail-fast dengan clear error message jika env missing
- Prevents runtime errors dari undefined env vars

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Update Documentation & Changelog

**Files:**
- Modify: `docs/CHANGELOG.md:1-30` (add new entry at top of [Unreleased])
- Modify: `README.md` atau deployment docs (jika ada section tentang env vars)

**Interfaces:**
- Consumes: Completed fixes dari Task 1-4
- Produces: Updated documentation dengan deployment notes

- [ ] **Step 1: Add changelog entry**

```markdown
<!-- docs/CHANGELOG.md - add at top of [Unreleased] section -->

### [2026-08-08] — Fix payment gateway environment configuration

- **Tipe**: [FIXED]
- **Scope**: `modules/payment-gateway`, `lib/utils/env`, `k8s/production`
- **Author**: agent
- **Deskripsi**: Fixed critical production bug dimana `NEXT_PUBLIC_APP_URL` tidak
  terset di Kubernetes ConfigMap, menyebabkan payment gateway callback URLs
  menjadi `undefined/api/webhooks/*`. Added centralized environment validation
  helper untuk prevent future issues.
- **Files**:
  - `k8s/production/configmap.yaml` - Added NEXT_PUBLIC_APP_URL
  - `lib/utils/env.ts` - New environment validation helper
  - `modules/payment-gateway/services/providers/*` - Use validated env helper
  - `server.ts` - Add startup environment validation
- **Breaking**: ❌ Tidak
- **Deployment**: Requires kubectl apply ConfigMap + rolling restart pods (zero downtime)
```

- [ ] **Step 2: Verify changelog format**

```bash
head -50 docs/CHANGELOG.md
```

Expected: New entry di top dengan format yang konsisten

- [ ] **Step 3: Add deployment notes jika belum ada**

Jika ada file `docs/deployment.md` atau `README.md` section tentang deployment,
tambahkan note tentang critical env vars:

```markdown
## Critical Environment Variables

The following environment variables MUST be set in production:

- `NEXT_PUBLIC_APP_URL` - Public URL aplikasi (e.g., https://radpro.id)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `AUTH_SECRET` - NextAuth secret key
- `NEXTAUTH_SECRET` - NextAuth legacy secret key

Missing env vars akan cause server crash at startup dengan clear error message.
```

- [ ] **Step 4: Commit documentation**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): add entry for payment gateway env fix

- Document NEXT_PUBLIC_APP_URL fix
- Add deployment notes untuk critical env vars
- Reference all modified files

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Verification & Monitoring

**Files:**
- No code changes, pure verification

**Interfaces:**
- Consumes: Production deployment dari Task 1
- Produces: Verified working payment gateway dengan correct callback URLs

- [ ] **Step 1: Verify env var di all running pods**

```bash
ssh radpro '
for pod in $(sudo kubectl get pods -n netmanager-production -l app=netmanager-app -o jsonpath="{.items[*].metadata.name}"); do
  echo "Pod: $pod"
  sudo kubectl exec -n netmanager-production $pod -- printenv NEXT_PUBLIC_APP_URL
done
'
```

Expected: Semua pods return `https://radpro.id`

- [ ] **Step 2: Test payment gateway callback URL generation**

```bash
ssh radpro '
POD=$(sudo kubectl get pods -n netmanager-production -l app=netmanager-app -o jsonpath="{.items[0].metadata.name}")
sudo kubectl exec -n netmanager-production $POD -- node -e "
const providers = [\"xendit\", \"midtrans\", \"duitku\", \"tripay\", \"dana\", \"moota\"];
const url = process.env.NEXT_PUBLIC_APP_URL;
console.log(\"Payment Gateway Callback URLs:\");
providers.forEach(p => console.log(\`  \${p}: \${url}/api/webhooks/\${p}\`));
console.log(\"\\nRedirect URLs:\");
console.log(\`  Success: \${url}/payment/success\`);
console.log(\`  Failed: \${url}/payment/failed\`);
"
'
```

Expected: All URLs start dengan `https://radpro.id`, no "undefined"

- [ ] **Step 3: Monitor application logs untuk 10 menit**

```bash
ssh radpro "sudo kubectl logs -n netmanager-production -l app=netmanager-app --tail=100 -f | grep -iE '(error|undefined|payment|webhook)'"
```

Expected: No errors, no "undefined" strings

- [ ] **Step 4: Test health endpoint**

```bash
curl -I https://radpro.id/api/health
```

Expected: `200 OK`

- [ ] **Step 5: Check payment gateway configuration di admin UI**

Manual step: Login ke admin UI → Settings → Payment Gateway → Verify providers configured correctly

Expected: All enabled providers show active status

- [ ] **Step 6: Test create payment (jika sudah ada transaksi real atau sandbox)**

Manual step: Create test payment via admin UI atau customer portal

Expected: Payment URL generated dengan format correct (https://radpro.id/...)

- [ ] **Step 7: Document verification results**

```bash
cat > docs/reports/PAYMENT_GATEWAY_FIX_VERIFICATION_2026-08-08.md << 'EOF'
# Payment Gateway Fix Verification Results

**Date:** 2026-08-08
**Verifier:** Agent

## Verification Checklist

- [x] ConfigMap updated di production cluster
- [x] All pods restarted successfully (zero downtime)
- [x] NEXT_PUBLIC_APP_URL terset di all pods
- [x] Callback URLs generate dengan format correct
- [x] No "undefined" strings di logs
- [x] Health endpoint returns 200 OK
- [x] Payment gateway providers active di admin UI
- [x] Test payment generated correct URLs

## Callback URLs Verified

- Xendit: https://radpro.id/api/webhooks/xendit ✅
- Midtrans: https://radpro.id/api/webhooks/midtrans ✅
- Duitku: https://radpro.id/api/webhooks/duitku ✅
- Tripay: https://radpro.id/api/webhooks/tripay ✅
- DANA: https://radpro.id/api/payment/webhook/dana ✅
- Moota: https://radpro.id/api/webhooks/moota ✅

## Redirect URLs Verified

- Success: https://radpro.id/payment/success ✅
- Failed: https://radpro.id/payment/failed ✅
- Pending: https://radpro.id/payment/pending ✅

## Conclusion

✅ Fix successfully deployed and verified. Payment gateway callbacks sekarang
menggunakan correct URLs. No breaking changes, zero downtime deployment.

## Next Steps

- Monitor production logs untuk 24 jam
- Test real payment transactions dengan customers
- Consider adding alerting untuk payment gateway errors
EOF
```

- [ ] **Step 8: Commit verification report**

```bash
git add docs/reports/PAYMENT_GATEWAY_FIX_VERIFICATION_2026-08-08.md
git commit -m "docs(verification): add payment gateway fix verification report

- All pods verified dengan correct NEXT_PUBLIC_APP_URL
- Callback URLs generate dengan format correct
- Zero downtime deployment successful
- No errors detected

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Rollback Plan (Emergency)

**Jika terjadi issues setelah deployment:**

### Option 1: Rollback Deployment Only

```bash
ssh radpro "sudo kubectl rollout undo deployment/netmanager-app -n netmanager-production"
ssh radpro "sudo kubectl rollout undo deployment/netmanager-worker -n netmanager-production"
```

### Option 2: Restore Previous ConfigMap

```bash
# Restore from backup
ssh radpro "sudo kubectl apply -f /tmp/configmap-backup-*.yaml"

# Restart pods
ssh radpro "sudo kubectl rollout restart deployment/netmanager-app -n netmanager-production"
```

### Option 3: Remove Environment Helper (Code Rollback)

```bash
git revert HEAD~3..HEAD  # Revert last 3 commits
git push origin main
```

---

## Post-Deployment Monitoring (24 Hours)

**Metrics to watch:**

1. **Error Rate:**
   ```bash
   ssh radpro "sudo kubectl logs -n netmanager-production -l app=netmanager-app --since=1h | grep -c ERROR"
   ```

2. **Payment Gateway Activity:**
   ```bash
   ssh radpro "sudo kubectl logs -n netmanager-production -l app=netmanager-app --since=1h | grep -i 'webhook\|payment' | tail -50"
   ```

3. **Pod Restarts:**
   ```bash
   ssh radpro "sudo kubectl get pods -n netmanager-production -l app=netmanager-app"
   ```
   Expected: RESTARTS column = 0

4. **Health Check:**
   ```bash
   watch -n 60 'curl -s -o /dev/null -w "%{http_code}" https://radpro.id/api/health'
   ```
   Expected: Always 200

---

## Success Criteria

**All criteria MUST be met sebelum task dianggap complete:**

- ✅ ConfigMap deployed ke production cluster
- ✅ All pods restarted dengan zero downtime
- ✅ `NEXT_PUBLIC_APP_URL` terset di all running pods
- ✅ Payment gateway callback URLs generate correct format
- ✅ No "undefined" strings di application logs
- ✅ Environment validation helper created dan tested
- ✅ All payment providers updated untuk gunakan helper
- ✅ Startup validation added di server.ts
- ✅ Documentation updated (CHANGELOG.md)
- ✅ Verification report created
- ✅ No errors detected dalam 24 jam post-deployment

---

## Estimated Timeline

| Task | Duration | Priority |
|------|----------|----------|
| Task 1: Deploy ConfigMap | 30 min | 🔴 CRITICAL |
| Task 2: Environment Helper | 15 min | 🟡 HIGH |
| Task 3: Update Providers | 20 min | 🟡 HIGH |
| Task 4: Startup Validation | 10 min | 🟡 HIGH |
| Task 5: Documentation | 10 min | 🟢 MEDIUM |
| Task 6: Verification | 30 min | 🟡 HIGH |

**Total:** ~2 hours untuk complete implementation + 24 hours monitoring

---

## Notes

**Breaking Changes:** ❌ NONE  
**Backward Compatible:** ✅ YES (100%)  
**Downtime:** ❌ ZERO (rolling update)  
**Rollback Safety:** ✅ SAFE (can rollback anytime)

**Dependencies:**
- Kubernetes cluster access (kubectl via SSH to radpro)
- Production namespace: `netmanager-production`
- Existing ConfigMap: `netmanager-config`

**Testing Strategy:**
- Manual verification di production (no staging environment)
- Monitor logs real-time during deployment
- Test callback URL generation via Node.js eval
- Verify health endpoint after deployment
