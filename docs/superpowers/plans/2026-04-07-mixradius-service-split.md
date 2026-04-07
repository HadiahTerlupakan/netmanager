# MixRadius Service Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce god-service pressure in `MixRadiusService` by splitting internal responsibilities into focused helper modules while preserving the current public API used by existing routes.

**Architecture:** Keep `modules/integrations/services/MixRadiusService.ts` as the stable facade exported from the integrations module. Extract responsibility-specific helpers for session/auth, invoice HTML parsing/counting, and topology/coordinate parsing into sibling internal files, then update the facade to delegate to them. This keeps route imports stable while shrinking the service’s reasons to change.

**Tech Stack:** TypeScript, Next.js App Router, Axios, tough-cookie, Prisma Billing

---

## File map

### MixRadius auth/session split
- Create: `modules/integrations/services/mixradius-auth-client.ts`
- Modify: `modules/integrations/services/MixRadiusService.ts`
- Test: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-auth-client.ts`

### MixRadius invoice parsing split
- Create: `modules/integrations/services/mixradius-invoice-utils.ts`
- Modify: `modules/integrations/services/MixRadiusService.ts`
- Test: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-invoice-utils.ts`

### MixRadius topology parsing split
- Create: `modules/integrations/services/mixradius-topology-utils.ts`
- Modify: `modules/integrations/services/MixRadiusService.ts`
- Test: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-topology-utils.ts`

### Verification
- Modify only if needed: `modules/integrations/index.ts`
- Test: `npm run typecheck`

## Task 1: Extract MixRadius auth/session helpers

**Files:**
- Create: `modules/integrations/services/mixradius-auth-client.ts`
- Modify: `modules/integrations/services/MixRadiusService.ts:1-420`
- Test: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-auth-client.ts`

- [ ] **Step 1: Write the failing lint/type boundary by creating the auth helper module with the session state contract**

```ts
// modules/integrations/services/mixradius-auth-client.ts
import type { AxiosInstance } from 'axios'
import { mixRadiusConfigRepo } from '@/modules/integrations/repositories/MixRadiusConfigRepository'
import type { MixRadiusCredentials } from './MixRadiusService'

export type MixRadiusSessionState = {
  isLoggedIn: boolean
  loginExpiresAt: number
  loggedInCredentials: { username: string; baseUrl: string } | null
}

export async function loadMixRadiusCredentials(): Promise<MixRadiusCredentials> {
  const activeConfig = await mixRadiusConfigRepo.getActiveConfig()

  if (activeConfig) {
    return {
      username: activeConfig.username,
      password: activeConfig.password,
      baseUrl: activeConfig.apiUrl.replace(/\/$/, ''),
    }
  }

  return {
    username: process.env.MIXRADIUS_USERNAME || '',
    password: process.env.MIXRADIUS_PASSWORD || '',
    baseUrl: (process.env.MIXRADIUS_URL || '').replace(/\/$/, ''),
  }
}

export async function loginMixRadius(params: {
  client: AxiosInstance
  credentials: MixRadiusCredentials
  session: MixRadiusSessionState
  randomDelay: (min?: number, max?: number) => Promise<void>
}) {
  // move existing login flow here unchanged
}
```

- [ ] **Step 2: Run lint to verify the helper file shape is valid**

Run: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-auth-client.ts`
Expected: PASS

- [ ] **Step 3: Replace inline credential/session logic in `MixRadiusService` with helper delegation**

```ts
// modules/integrations/services/MixRadiusService.ts
import {
  loadMixRadiusCredentials,
  loginMixRadius,
} from './mixradius-auth-client'

private async loadCredentials() {
  this.credentials = await loadMixRadiusCredentials()
}

async login(): Promise<void> {
  await this.loadCredentials()

  const nextSession = await loginMixRadius({
    client: this.client,
    credentials: this.credentials,
    session: {
      isLoggedIn: this.isLoggedIn,
      loginExpiresAt: this.loginExpiresAt,
      loggedInCredentials: this.loggedInCredentials,
    },
    randomDelay: this.randomDelay.bind(this),
  })

  this.isLoggedIn = nextSession.isLoggedIn
  this.loginExpiresAt = nextSession.loginExpiresAt
  this.loggedInCredentials = nextSession.loggedInCredentials
}
```

- [ ] **Step 4: Run lint again after delegation**

Run: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-auth-client.ts`
Expected: PASS

- [ ] **Step 5: Commit the auth/session split**

```bash
git add modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-auth-client.ts
git commit -m "refactor: extract mixradius auth helpers"
```

## Task 2: Extract invoice parsing and count helpers

**Files:**
- Create: `modules/integrations/services/mixradius-invoice-utils.ts`
- Modify: `modules/integrations/services/MixRadiusService.ts:1627-1770`
- Test: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-invoice-utils.ts`

- [ ] **Step 1: Write the helper module for invoice HTML parsing and count mapping**

```ts
// modules/integrations/services/mixradius-invoice-utils.ts
import type { MixRadiusInvoice } from './MixRadiusService'

export function parseMixRadiusInvoicesFromHtml(html: string): MixRadiusInvoice[] {
  // move current parseInvoicesFromHtml logic here unchanged
}

export function buildInvoiceCountCacheKey(customerId: string, renewedOn: string) {
  return `${customerId}:${renewedOn}`
}
```

- [ ] **Step 2: Run lint to verify the helper file**

Run: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-invoice-utils.ts`
Expected: PASS

- [ ] **Step 3: Replace inline invoice parsing usage in `MixRadiusService`**

```ts
// modules/integrations/services/MixRadiusService.ts
import {
  buildInvoiceCountCacheKey,
  parseMixRadiusInvoicesFromHtml,
} from './mixradius-invoice-utils'

const cacheKey = buildInvoiceCountCacheKey(customer.id, customer.renewed_on)
const invoices = parseMixRadiusInvoicesFromHtml(html)
```

- [ ] **Step 4: Run lint after invoice helper delegation**

Run: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-invoice-utils.ts`
Expected: PASS

- [ ] **Step 5: Commit the invoice helper split**

```bash
git add modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-invoice-utils.ts
git commit -m "refactor: extract mixradius invoice utilities"
```

## Task 3: Extract topology and coordinate parsing helpers

**Files:**
- Create: `modules/integrations/services/mixradius-topology-utils.ts`
- Modify: `modules/integrations/services/MixRadiusService.ts:2042-2427`
- Test: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-topology-utils.ts`

- [ ] **Step 1: Write the helper module for coordinate parsing and topology normalization**

```ts
// modules/integrations/services/mixradius-topology-utils.ts
export function parseDMSToDecimal(dms: string): number | null {
  // move current parseDMSToDecimal logic here unchanged
}

export function parseGoogleMapsCoords(url: string): { lat: number; lng: number } | null {
  // move current parseGoogleMapsCoords logic here unchanged
}
```

- [ ] **Step 2: Run lint to verify the helper file**

Run: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-topology-utils.ts`
Expected: PASS

- [ ] **Step 3: Replace inline topology helper methods in `MixRadiusService` with imports**

```ts
// modules/integrations/services/MixRadiusService.ts
import {
  parseDMSToDecimal,
  parseGoogleMapsCoords,
} from './mixradius-topology-utils'

const latitude = parseDMSToDecimal(rawLatitude)
const coords = parseGoogleMapsCoords(googleMapsUrl)
```

- [ ] **Step 4: Run lint after topology helper delegation**

Run: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-topology-utils.ts`
Expected: PASS

- [ ] **Step 5: Commit the topology helper split**

```bash
git add modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-topology-utils.ts
git commit -m "refactor: extract mixradius topology utilities"
```

## Task 4: Full verification for the MixRadius split

**Files:**
- Modify any touched files required by lint/type follow-up

- [ ] **Step 1: Run focused lint for the full MixRadius slice**

Run: `npx eslint modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-auth-client.ts modules/integrations/services/mixradius-invoice-utils.ts modules/integrations/services/mixradius-topology-utils.ts modules/integrations/index.ts`
Expected: PASS

- [ ] **Step 2: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Inspect the facade export surface**

```ts
// modules/integrations/index.ts
export * from './services/MixRadiusService'
```

Expected: unchanged public export surface for existing route imports.

- [ ] **Step 4: Commit the verified split batch**

```bash
git add modules/integrations/services/MixRadiusService.ts modules/integrations/services/mixradius-auth-client.ts modules/integrations/services/mixradius-invoice-utils.ts modules/integrations/services/mixradius-topology-utils.ts modules/integrations/index.ts
git commit -m "refactor: split internal mixradius helpers"
```

## Self-review
- Spec coverage check: the plan covers the three safest internal extraction seams in `MixRadiusService` without changing route imports or module exports.
- Placeholder scan: every task references exact paths, concrete helper names, and exact verification commands.
- Type consistency check: helper names used in later tasks match the files and imported symbols defined in earlier tasks.
