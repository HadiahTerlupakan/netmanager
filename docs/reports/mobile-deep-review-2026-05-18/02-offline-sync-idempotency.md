# Deep Review — Offline Sync Mechanism (mobile-netmanager + netmanager backend)

Reviewer: agent
Date: 2026-05-18
Scope: SQLite queue, idempotency, photo lifecycle, SyncService, reconciliation, useApiMutation, backend dedup.

Repos reviewed:
- Mobile: `/Users/rohadimraja/Documents/radpro/mobile-netmanager`
- Backend: `/Users/rohadimraja/Documents/radpro/netmanager`

---

## TL;DR — Headline Risks

| # | Issue | Severity |
|---|-------|----------|
| 1 | "SQLite queue" is actually an in-memory array persisted to AsyncStorage on every mutation; no durability between writes, full-rewrite cost grows with queue size | High |
| 2 | `cleanupOfflinePhoto` is exported but **never called** anywhere — disk leak in `documentDirectory/offline-photos/` | High |
| 3 | Photo re-upload on retry: `processQueueItem` re-uploads all photos on every retry attempt (network hiccups → orphan server objects, wasted bandwidth, duplicate photoUrls if upload succeeds but JSON request fails) | High |
| 4 | Idempotency is **inconsistent**: only `/api/mobile/attendance/check-in` & `/check-out` enforce it server-side. Work-order, inventory, leave, FCM endpoints accept `Idempotency-Key` header but ignore it → duplicate records on offline replay | Critical |
| 5 | `requestId` collision risk: `att-${Date.now()}-${6 chars base36}` (~36 bits randomness + ms timestamp). Two devices submitting at same ms have a real but small collision risk. More importantly: timestamp is taken from device clock — time-skewed device may produce `requestId` already used after a clock reset | Medium |
| 6 | Two parallel "online check" paths (useApiMutation + SyncService) — race window where mutation reports success online, network drops mid-request, SyncService later replays with the same payload but a new `requestId` (because attendance flow sometimes does NOT preserve requestId — see §2.2) | High |
| 7 | TTL drops attendance items >24h silently with `presentErrorMessage` only on payload corruption, not on TTL expiry → user data silently discarded after a day offline | High |
| 8 | Queue mutex (`withMutex`) covers writes but NOT reads (`getPendingQueue`) — concurrent processQueue + addToQueue can yield processing an item that was just removed | Medium |
| 9 | `markAsRetry` increments retryCount but `processQueueItem` MAX_RETRIES check only counts in-attempt retries (the `attempt` local) — global retry budget is unbounded, item can stay forever | Medium |
| 10 | `generateId()` uses `Date.now() * 1000 + counter`. Counter wraps at 1000 within same millisecond — collision possible under burst, and survives across app restarts (`idCounter` resets to 0) | Low |
| 11 | FCM token sync: backend ignores `Idempotency-Key` header sent by client. Replays on retry create needless DB writes, but no real duplicates because upsert pattern. Misleading client telemetry | Low |
| 12 | `clearSessionData` wipes pending queue at logout — pending offline data is silently lost when token expires & user re-logs | High |

Critical & High issues need fixing before next release.

---

## 1. Queue Storage (NOT SQLite)

### 1.1 Actual Implementation

`src/services/DatabaseService.ts:1-256` — despite the name, there is **no SQLite**. The queue is:
- An in-memory `memoryQueue: SyncQueueItem[]` array (line 23).
- Persisted to AsyncStorage under key `NETMANAGER_SYNC_QUEUE` via `JSON.stringify(this.memoryQueue)` on every write (line 90).

```ts
// DatabaseService.ts:88-94
private async persistQueue(): Promise<void> {
  try {
    await Storage.setItem(QUEUE_KEY, JSON.stringify(this.memoryQueue));
  } catch (error) {
    logger.error("Failed to persist queue:", error);
  }
}
```

`Storage.setItem` (utils/storage.ts:37-43) **swallows errors silently**:
```ts
setItem: async (key, value) => {
  try { await Storage.setItemStrict(key, value); }
  catch (error) { logger.debug('...swallowed error...', key, error); }
}
```

### 1.2 Risks

- **Crash durability**: any uncommitted mutation between push to memory and persist call (line 144 push → line 145 persist) is fine on the happy path, but if the JS thread crashes before persist completes, the in-flight item is lost AND the rewritten file may be corrupt (AsyncStorage on Android uses SQLite under the hood, so the write is atomic at the row level — but the entire JSON blob is one row).
- **Storage write amplification**: every `removeFromQueue`, `markAsRetry`, `markAsFailed`, `addToQueue` rewrites the entire serialized queue. With 50+ pending items each containing photoMap and base64-ish payloads, this becomes a multi-KB write on every status change.
- **Silent persist failure**: because `Storage.setItem` swallows errors, an item appearing to be queued may not actually be on disk if quota errors or AsyncStorage corruption hits.
- **No real FIFO atomicity** — see §1.3.
- **`isReady` returns true even on init failure** (DatabaseService.ts:62) — empty queue masquerades as "ready" if the on-disk JSON is corrupt.

### 1.3 Mutex Holes

`withMutex` covers `addToQueue`, `removeFromQueue`, `markAsRetry`, `markAsFailed`, `clearSessionData` (lines 132, 163, 172, 186, 224). But:

- `getPendingQueue` (line 150) does **not** use the mutex. If a sort runs concurrently with a remove, the JS engine guarantees array snapshot, but the next `processQueueItem` may operate on an item that is concurrently being removed by another path.
- `processQueueItem` reads from queue, calls `removeFromQueue` after success — between those two, the item still exists in memory and could be picked up by another `processQueue` call. `isProcessing` flag (SyncService.ts:88) is per-instance & guards top-level only; if it ever races (e.g. event listener fires twice), parallel runs would re-fire requests already in-flight.

### 1.4 Recommendation

- Migrate to `expo-sqlite` for true row-level durability and atomic updates. Even a single-table `sync_queue` would solve the rewrite-amplification + crash-durability problems.
- If staying on AsyncStorage: never swallow `setItem` errors for queue persistence; surface them so caller can retry.
- Wrap `getPendingQueue` in mutex; or add a per-item `claimedAt`/`claimedBy` field so consumers can claim before processing.

---

## 2. Idempotency Systems — Critical Inconsistency

### 2.1 Mobile Side — Three Parallel Sources

| Source | Endpoint | Header | Body | Notes |
|--------|----------|--------|------|-------|
| `attendanceIdempotency.ts` | check-in / check-out | `Idempotency-Key: att-{ts}-{6char}` | `requestId` field | Dual: header + body |
| `FirebaseMessagingService.ts:86,134` | `/api/mobile/fcm-token` | `Idempotency-Key: fcm-{action}-{token}` | (none) | Backend ignores |
| `SyncService.processQueueItem` | replays | reuses `requestId` from queue meta/body | yes | Only attendance |

`SyncService.ts:346-349`:
```ts
const idempotencyHeaders = buildAttendanceIdempotencyHeaders(requestId);
if (idempotencyHeaders) {
  headers['Idempotency-Key'] = idempotencyHeaders['Idempotency-Key'];
}
```
This conditionally sets the header **only** when `requestId` exists, which `ensureAttendanceRequestId` only generates for attendance endpoints. Work-order replays send NO `Idempotency-Key`.

### 2.2 RequestId Generation Risk

`utils/attendanceIdempotency.ts:6-9`:
```ts
export function createAttendanceRequestId(now: number = Date.now()): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `att-${now}-${randomPart}`;
}
```

- 6 chars of base36 ≈ 30 bits randomness; per-ms collision rate is low (~1/10⁹) but `Math.random()` is not cryptographically secure — bias may exist on JS engines.
- Device clock is the only source of `now`. If device clock rolls back (manual change, NTP sync), a previously-used `requestId` could be regenerated. Idempotency cache would then return the old response → silent data loss.
- `useApiMutation` line 207-211: only attendance endpoints get auto-generated `requestId`. Non-attendance offline mutations have **no idempotency key at all**.

### 2.3 Backend Side — Only Attendance Enforces

Confirmed via grep `Idempotency-Key|idempotency-key|IdempotencyKey` across `app/api/mobile/`:
- Hits only inside `modules/attendance/services/`.
- Work-order, inventory, leave, FCM, profile, push-token endpoints have **zero** server-side idempotency handling.

Backend service:
- `modules/attendance/services/AttendanceIdempotencyService.ts` — Redis-backed `SETNX`, 24h TTL, `IN_PROGRESS` → `COMPLETED` state machine, payload-hash mismatch protection.
- Solid implementation. Replay key: `attendance:idempotency:{userId}:{action}:{requestId}`.
- If Redis is `unavailable`, returns 503 — client SyncService re-queues (correct).
- TTL = 24h: mobile keeps stale items up to 24h too — aligned. But a network hiccup at 23h59m → server forgets, client re-sends → duplicate.

### 2.4 useApiMutation vs SyncService Race

`useApiMutation` flow when network is flaky:
1. `SyncService.isOnline()` returns true (NetInfo cache or transient connection).
2. `api.request` starts; network drops mid-stream.
3. axios returns "Network Error" → caught at 273-277 → queued (line 305) with the same `requestId`.
4. Backend may have **already received and processed** the request before the connection died — server returns 200 the client never sees.
5. SyncService later replays. Backend finds completed state → returns replay (line 67-72 of `MobileAttendanceCheckInIdempotencyService`) with `X-Idempotent-Replay: true`. ✅ Correct for attendance.
6. **For non-attendance endpoints**: no `requestId`, no replay → duplicate work order / inventory / leave is created.

### 2.5 Recommendation

- Apply idempotency at a global middleware level (`lib/api/withIdempotency.ts`) or via a shared decorator — at minimum cover all POST/PUT to mobile endpoints.
- Move `createAttendanceRequestId` to a generic `createRequestId` and have `useApiMutation` always inject one for any mutation, queued or not.
- Use `crypto.randomUUID()` (available via `expo-crypto`) instead of `Math.random()` to avoid clock-rollback collisions and entropy bias.
- Treat absence of `Idempotency-Key` as a request that should be rejected for replay-prone endpoints (work-order create, inventory transactions, payments).

---

## 3. Photo Lifecycle — Disk Leak & Re-upload

### 3.1 Capture → Persist Flow

Files involved:
- `src/utils/persistPhoto.ts` (offline copy to documentDirectory)
- `src/services/UploadService.ts` (server upload)
- `src/hooks/queries/useApiMutation.ts:293-302` (only place persisting photoMap)

Online happy path:
- `useApiMutation:224-238` uploads photoMap **without** calling `persistPhotoForOffline` first → if user goes offline mid-upload, the temp camera URI may already be GC'd by OS.
- After successful online upload, the original temp file is left untouched (OS will reap it).

Offline path:
- `useApiMutation:293-302` copies each `photoMap` URI to `documentDirectory/offline-photos/` before queueing.
- **Note**: `meta.photos` (array form, used by attendance — see useAttendanceSubmission.ts:114-119) is **not** persisted by useApiMutation. It is queued as-is. Look at `SyncService.ts:284-311` — it tries to upload from the original `processedUri` later. If processedUri was a temp file, OS may have cleaned it.

### 3.2 Disk Leak Confirmed

`grep -rn cleanupOfflinePhoto src/ app/` returns only the export site — **no caller**.

Result:
- Every offline submission with photos leaves files in `documentDirectory/offline-photos/`.
- Files persist forever even after successful sync.
- High-frequency users (e.g. field engineers on patchy networks) accumulate hundreds of MB.

Severity: High (UX-degrading on cheap devices with 16-32 GB storage).

### 3.3 Re-upload on Retry

`SyncService.processQueueItem:272-336` runs the photo upload block inside the retry loop:
- On 5xx/timeout, it retries the **entire** block: photos re-uploaded → backend gets duplicate file objects → original `photoUrl` overwritten → orphan file on server (only the latest URL is referenced, the others are orphans on S3/local storage).
- After a successful photo upload on attempt 1 but failed JSON request, attempt 2 uploads photos AGAIN.

Worse: between 286-336, `body[meta.targetField]` and `body[result.field]` are mutated each retry. The local `body` is the cloned base body, so each attempt re-uploads. The client never tracks "photo already uploaded" state across retries.

### 3.4 useAttendanceSubmission Edge Case

`useAttendanceSubmission.ts:165-196` (online path):
- Uploads photo → `photoUrl`.
- Calls mutation with `photoUrl`. If mutation throws, calls `uploadService.deleteUploadedFile(photoUrl)` to clean up.
- BUT if mutation queues (offline mid-call), `data` is `OfflineQueuedMutationResult` — no exception → the uploaded URL persists, and the queued payload contains the **server URL** (`photoUrl`), not the local URI. So the queued item later sends a server URL string to backend. Server stores it. This is correct, **but** the meta.photos array (line 114-119) still references the local URI for re-upload — both paths exist.
- Reading SyncService.ts:284 — it checks `photoUri.startsWith('file://')`. If processedUri was already uploaded, it starts with https, so SyncService skips upload. ✅ OK.

### 3.5 Permission / OS Cleanup

`persistPhoto.ts:32` calls `FileSystem.copyAsync` to documentDirectory. This survives app restarts but **does not** survive app uninstall or "Clear data". If the user clears app data, all queued offline photos die before sync.

### 3.6 Recommendation

- Call `cleanupOfflinePhoto` in SyncService after `removeFromQueue` (success path, line 363) for each persisted photo URI in meta.
- On TTL expiry (line 255-256) also clean up any persisted photos.
- Cache the returned `photoUrl` after a successful upload **inside the queue item** so retries skip re-upload. Add a `uploadedPhotos: Record<string, string>` field to `SyncQueueMeta` and persist after each successful upload via `markAsRetry` style write.
- Add a startup sweep: list `offline-photos/`, drop any file not referenced by any queue item.
- Persist `meta.photos` URIs through `persistPhotoForOffline` in `useAttendanceSubmission` before queueing.

---

## 4. SyncService — Detailed Issues

### 4.1 Concurrency Limit Reasonable

`pLimit(getOptimalConcurrency(queueSize))` returns 2-4. Reasonable.

### 4.2 Backoff & Retry

`SyncService.ts:469-473`:
```ts
if (attempt < MAX_RETRIES) {
  const delay = Math.pow(2, attempt) * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));
}
```
- 1s, 2s, 4s — fine for local in-attempt retries.
- After 3 attempts, `markAsRetry` sets status to RETRY and increments `retryCount`. The next `processQueue` round picks it up again with **another** 3 in-attempt retries.
- No circuit breaker — a 422-prone item with photoMap re-uploads photos every cycle.
- `MAX_RETRIES` is local to the function; the persisted `retryCount` is incremented but never checked for a global cap (except attendance reconciliation cap of 3 — line 24).
- Non-attendance items can loop forever consuming bandwidth.

### 4.3 Permanent Failure Heuristic

`PERMANENT_SYNC_FAILURE_STATUSES = new Set([400, 404, 409, 422])` (line 16) is reasonable, but:
- 401 is **not** here — auth token expiry on a queued item triggers a permanent failure path? Actually no — 401 is treated as transient, so the item retries with the same expired token. SyncService doesn't refresh the token between retries.
- Token is fetched once at line 170. If the token expires during a long batch, every remaining item fails 401 → marked for RETRY → next batch fetches the same expired token (SecureStore is the source) → infinite loop until refresh service or user re-login.

### 4.4 NetInfo Debounce

`startMonitoring` (line 96-117) — debounces sync 2s after net comes back. Acceptable. But:
- If `processQueue` is in progress when net flaps off→on→off→on, the listener clears the timeout and reschedules; the in-progress run finishes with its already-fetched token even on second flap → no real harm but logs may double-report.
- `isMonitoring` re-entry guard on line 97 is correct.
- `eventManager.removeAllListeners('sync')` in stopMonitoring clears the unsubscribe. Looks clean.

### 4.5 TTL Silent Discard

`processQueueItem:251-257`:
```ts
if (itemAge > maxAge) {
  logger.warn(`[SyncService] Item ${item.id} expired ...`);
  await DatabaseService.removeFromQueue(item.id);
  return;
}
```
No user notification on TTL expiry. A field worker offline 25h loses their attendance silently. **High severity for HR/payroll integrity.**

### 4.6 Token Skip on Empty Session

`SyncService.ts:170-174`:
```ts
const token = await SecureStore.getItemAsync('session_token');
if (!token) {
  logger.warn('[SyncService] Skipping queue processing because there is no active session token.');
  return;
}
```
- After logout, queue still contains items, but they cannot sync. Combined with `clearSessionData` being called on logout (see §6) — actually logout clears the queue, so this branch only matters during transient session loss.

### 4.7 Auth Refresh Hook Missing

Inside the request loop, `skipGlobalAuthHandler: true` is set. Means the global axios interceptor that refreshes token won't run. Queue items hit 401 → retried with stale token → loop. Should call refresh-token explicitly when a 401 occurs.

---

## 5. Reconciliation After Sync

### 5.1 Mobile Side

`useApiMutation.ts:333-359`:
- On success online → invalidates `invalidateKeys`.
- On offline-queued result → does NOT invalidate (line 336 check). Reasonable: there's no server data yet.
- After SyncService eventually syncs → there is **no cache invalidation hook**. The user sees stale data until manual refetch.

`SyncService.processQueueItem` does not interact with the React Query cache at all. The TanStack `queryClient` is decoupled from the singleton `SyncService`.

### 5.2 Risk

- User submits attendance offline → check-in saved locally and shows "queued" state. Connection comes back → SyncService syncs successfully → backend has check-in record but mobile UI still shows "not checked in" until something triggers `attendance/status` refetch. Most users will see the wrong state for hours unless the app gets focus.
- For attendance, the existing flow (line 70 `invalidateKeys: [attendanceStatusQueryKey]`) only fires on the original mutation success path — the SyncService replay does NOT trigger that invalidation.

### 5.3 Recommendation

- After `removeFromQueue` in SyncService, emit an event (via `eventManager`) keyed by the original endpoint. Have hooks subscribe and invalidate the relevant keys.
- Or: include `invalidateKeys` in queue meta (serializable form) and let SyncService dispatch via a registered global queryClient.

---

## 6. clearSessionData Wipes Pending Queue

`DatabaseService.ts:221-237`:
```ts
public async clearSessionData(): Promise<void> {
  ...
  this.memoryQueue = [];
  await Storage.removeItem(QUEUE_KEY);
  ...
}
```

Called on logout. If a user has pending offline items and gets force-logged-out (token revoked, 401 cascade), their offline data is silently destroyed — including attendance check-ins, work-order updates, etc.

**Severity**: High. For attendance / payroll flows this is data integrity loss.

### Recommendation

- On logout, do NOT clear the queue. Queue items are tied to userId/tenantId — leave them for next login (after verifying user identity matches).
- OR persist a "pending offline data" warning to the user before logout: "You have N unsynced items. Continue anyway?".

---

## 7. Backend Dedup — Audit Summary

### 7.1 Attendance — Robust

- `AttendanceIdempotencyService` uses Redis SET NX EX 86400 with payload hashing.
- `IN_PROGRESS` → `COMPLETED` state machine with response cached for replay.
- Hash-mismatch returns 409 with explicit message (line 137-140 of `MobileAttendanceCheckInIdempotencyService`).
- Release on failure (line 107-110) — correct.

### 7.2 Other Mobile Endpoints — Unprotected

`grep -rn 'Idempotency-Key\|idempotency-key\|IdempotencyKey' app/api/mobile/` returns nothing. Endpoints affected:
- `/api/mobile/work-orders/*` — POST/PATCH have no dedup. Replay → duplicate WO.
- `/api/mobile/inventory/*` (barang-masuk, barang-keluar) — replay → duplicate stock movements (high severity for accounting).
- `/api/mobile/leaves` — replay → duplicate leave request.
- `/api/mobile/fcm-token` — replay benign (upsert).
- `/api/mobile/profile/*` — replay benign (idempotent by nature, PUT semantics).

### 7.3 Recommendation

Implement a generic `withIdempotency` decorator that:
1. Reads `Idempotency-Key` header; if absent, allow request through (legacy compat) but log a warning.
2. Hashes payload and uses Redis with `{tenantId}:{userId}:{endpoint}:{key}` namespace.
3. Stores response and replays on duplicate.

Apply to: work-orders create/update, inventory transactions, leave requests, salary mutations.

---

## 8. Edge Cases Found

| Edge Case | Behavior | Risk |
|-----------|----------|------|
| App killed mid-upload (online path) | UploadService aborts, mutation throws, axios reports network error → queued | OK |
| App killed mid-queue write (after push, before persist) | Item lost from memory, not on disk | Low (sub-ms window) |
| Photo file deleted by user | `FileSystem.copyAsync` succeeded earlier in offline path → file safe; in online path no persist → OS may clean before retry | Medium (online path) |
| Queue JSON corrupted on disk | `initDatabase` catches, sets queue empty, marks ready (line 60-63) | Critical: silent data loss |
| Idempotency key collision via clock rollback | Cache returns response from another submission | Medium |
| Time-skew: device clock 1 day ahead | `createdAt` future → TTL check still works (negative age treated as fresh) | Low |
| Time-skew: device clock 1 day behind | Item created at "yesterday" → TTL check sees age 0 → fine. But if clock catches up later and was 25h ago at submit time → TTL expires immediately on first sync | Medium |
| Two concurrent SyncService.processQueue calls | `isProcessing` flag prevents — but flag is plain boolean on a singleton object, not protected by the mutex | Low |
| Logout while sync in flight | Token still in SecureStore until logout finishes; queue cleared; in-flight items may complete on backend but client lost state | High |
| Same userId on two devices | Idempotency keys are namespaced by userId, so two devices using the same userId can collide if requestIds collide | Low (rare scenario) |

---

## 9. Concrete Fix Plan (Prioritized)

### Priority 0 (Block release)
1. **Remove `clearSessionData` queue wipe on logout** — preserve pending items.
2. **Make `cleanupOfflinePhoto` actually run** after `removeFromQueue` and on TTL expiry.
3. **Add server-side idempotency** for work-order create, inventory transactions, leave requests (Redis-backed, mirror attendance pattern).

### Priority 1 (Next sprint)
4. **Cache uploaded photo URLs in queue item** to avoid re-upload on retry.
5. **Notify user on TTL expiry** (toast: "N pending items expired, please re-submit").
6. **Migrate to expo-sqlite** — at minimum gain row-level atomic updates and avoid full-file rewrites.
7. **Auto-generate `Idempotency-Key` for all queued mutations**, not just attendance.
8. **Wire SyncService → queryClient invalidation** via eventManager so UI refreshes on background sync.

### Priority 2 (Nice to have)
9. Switch `createAttendanceRequestId` to `expo-crypto` UUID.
10. Add startup sweep for orphan files in `offline-photos/`.
11. Refresh access token inside SyncService on 401, instead of looping.
12. Wrap `getPendingQueue` in mutex; or add claim-based concurrency.

---

## 10. Key File Index (absolute paths)

Mobile:
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/SyncService.ts`
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/DatabaseService.ts`
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/utils/persistPhoto.ts`
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/utils/attendanceIdempotency.ts`
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/utils/storage.ts`
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/queries/useApiMutation.ts`
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/useAttendanceSubmission.ts`
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/FirebaseMessagingService.ts`
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/UploadService.ts`

Backend:
- `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceIdempotencyService.ts`
- `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/MobileAttendanceCheckInIdempotencyService.ts`
- `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/MobileAttendanceCheckoutRouteService.ts`
- `/Users/rohadimraja/Documents/radpro/netmanager/app/api/mobile/attendance/check-in/route.ts`
- `/Users/rohadimraja/Documents/radpro/netmanager/app/api/mobile/fcm-token/route.ts`
