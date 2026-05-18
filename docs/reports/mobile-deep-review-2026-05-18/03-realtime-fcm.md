# Deep Review — Real-time Integration (Firestore + FCM)

Scope: mobile-netmanager (Expo / React Native) ↔ netmanager backend (Next.js 14 + Firebase Admin).
Date: 2026-05-18.

Repo paths used in this report:
- Mobile: `/Users/rohadimraja/Documents/radpro/mobile-netmanager`
- Backend: `/Users/rohadimraja/Documents/radpro/netmanager`

Severity legend: **Critical** = silent data leak / outage / security; **High** = broken core flow on common path; **Medium** = degraded UX or recoverable bug; **Low** = code-smell / hardening.

---

## 1. Firestore custom-token auth

### 1.1 [Critical] Custom token never refreshed — Firestore listeners die silently after ~1h

**Files**
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/RealtimeService.ts:23-49` (`authenticateRealtimeClient`, `ensureRealtimeAuthenticated`)
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/RealtimeService.ts:107-197` (`subscribeToScope`)
- `/Users/rohadimraja/Documents/radpro/netmanager/app/api/mobile/auth/firebase-token/route.ts:28-39` (token mint, no `expiresIn` override → default 1h ID-token)

**Snippet**
```ts
async function authenticateRealtimeClient(): Promise<void> {
  const auth = getMobileFirebaseAuth()
  if (auth.currentUser) {        // <-- only checks identity, not expiry
    return
  }
  const customToken = await fetchRealtimeCustomToken()
  await signInWithCustomToken(auth, customToken)
}
```
Inside `subscribeToScope`, the snapshot error handler does plain exponential back-off
without ever calling `signInWithCustomToken` again or surfacing an `auth/...` error code:

```ts
(error) => {
  logger.warn('[Realtime] Firestore subscription failed', { ... });
  if (cancelled) return;
  if (retryCount < maxRetries) { /* setTimeout(subscribe, …) */ }
}
```

**Root cause**
Firebase JS SDK refreshes the **ID token** silently as long as the custom token sign-in
left a valid refresh-token in Auth. `signInWithCustomToken` does not produce a refresh
token in all RN Auth setups (depends on persistence path), and even if it does, when
the underlying user disabling, custom-claim change, or 24h refresh-token cap hits, the
listener gets `permission-denied` / `unauthenticated`. The retry loop simply re-runs
`onSnapshot` against the same dead token → infinite warn loop, then gives up after 5
attempts (`maxRetries=5`, line 116). After that the user gets stale data until the
app is killed.

**Risk: Critical** — silent loss of all realtime events (profile refresh, work-order
update, chat message, typing indicator). UX symptom: data appears "frozen" with no
error to the user.

**Fix**
1. In `subscribeToScope`'s error callback, branch on `error.code`:
   ```ts
   if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
     resetRealtimeAuthentication()
     await ensureRealtimeAuthenticated()
   }
   ```
2. Refactor `authenticateRealtimeClient` to *also* check expiry:
   ```ts
   if (auth.currentUser) {
     try {
       await auth.currentUser.getIdToken(/* forceRefresh */ false)
       return
     } catch {
       await auth.signOut()
     }
   }
   ```
3. Wire `onIdTokenChanged` to log failures and re-mint via `/api/mobile/auth/firebase-token`.
4. Backend: pass `customToken` with explicit lifetime via custom claims version field
   so we can rotate when permissions change (today claims are pinned until the user
   signs out and signs back in).

---

### 1.2 [High] `connectPromise` cache is never reset on auth failure path

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/RealtimeService.ts:34-49`

```ts
let connectPromise: Promise<void> | null = null
function ensureRealtimeAuthenticated(): Promise<void> {
  if (!connectPromise) {
    connectPromise = authenticateRealtimeClient().catch((error) => {
      connectPromise = null
      throw error
    })
  }
  return connectPromise
}
```
The catch resets `connectPromise` only when `authenticateRealtimeClient` rejects. If
sign-in *succeeds* but the token later turns invalid (claim rotation, user disabled,
project moved), nothing in the codebase clears this promise — every future
`subscribeToScope` reuses the dead session.

**Root cause** — module-level singleton with no invalidation on listener errors.

**Risk: High** — couples directly with 1.1; fixing only 1.1 without invalidating
this cache leaves zombie state across navigations.

**Fix** — call `resetRealtimeAuthentication()` from the error handler in 1.1 *before*
re-running `ensureRealtimeAuthenticated`.

---

### 1.3 [Medium] Network drop: no resubscribe on `AppState` change

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/RealtimeService.ts:107-197`

There is no `AppState.addEventListener('change', ...)` listener inside the realtime
service. After app backgrounds for several minutes the Firestore websocket dies; on
resume Firestore SDK reconnects but if the device went offline > 30 minutes, snapshot
listeners fire `failed-precondition` once and the local 5-attempt back-off can be
exhausted while screen is paused.

**Risk: Medium** — chat / WO detail screens silently lose pushes after long backgrounds.

**Fix** — on `AppState === 'active'`, force a resubscribe (counter reset) for active
listeners. Plug this into `useNotificationSetup` parity (which already does it in
`useProfileSync.ts:82-96`).

---

## 2. Scope subscription / listener lifecycle

### 2.1 [High] Mobile uses `chat` scope kind that does not exist on backend

**Files**
- Mobile: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/RealtimeService.ts:51-87`
  ```ts
  export type RealtimeScopeKind = 'user' | 'department' | 'workorder' | 'ticket' | 'chat' | 'admin'
  case 'chat': return `chats/${scope.id}/events`
  ```
- Mobile usage: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/app/(app)/chat/[conversationId].tsx:230`
  ```ts
  realtimeService.subscribeToScope({ kind: 'chat', id: conversationId }, handleRealtimeEvent)
  ```
- Backend definition: `/Users/rohadimraja/Documents/radpro/netmanager/lib/realtime/contracts.ts:30-33`
  ```ts
  export interface RealtimeScope {
    kind: "user" | "department" | "admin" | "workorder" | "ticket";  // <-- no 'chat'
  }
  ```
- Backend channel-map: `/Users/rohadimraja/Documents/radpro/netmanager/lib/realtime/channel-map.ts:40-53` — switch lacks `chat`.
- Firestore rules: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/firestore-rules-update.txt:26-49` — no `match /chats/{...}/events/...` rule.

**Root cause** — mobile shipped chat realtime against a Firestore collection
(`chats/{id}/events`) that the backend never publishes to and Firestore rules don't
allow reading from. The mobile listener will receive **only** what the *mobile itself*
writes via `emitToRoom` (typing indicators in `chat/[conversationId].tsx:249-257`).
Real chat messages flow through REST (`api.post('/api/mobile/chat/conversations/...')`)
and rely on socket.io / polling, not Firestore.

**Risk: High** — chat realtime appears wired but is essentially dead end-to-end.
Worse, *typing* events will be **rejected by Firestore rules** in production
(`/chats/{}` has no `allow write` rule), so even self-emit will silently fail unless
rules are looser than the file we found. If rules *are* looser, then any signed-in
user can read+write any chat conversation — see 6.1.

**Fix**
1. Decide direction: either (a) add `chat` to `RealtimeScope`, `LEGACY_TO_REALTIME_EVENT`,
   `buildScopeChannel` on backend and *publish* `chat.message` from chat send service,
   *and* add Firestore rules limited to participants; or (b) remove the `chat` branch
   from mobile and use the existing socket.io chat path.
2. Whichever direction: add a contract test that mobile + backend `RealtimeScopeKind`
   unions match.

---

### 2.2 [High] `subscribeToScope` recreates `seenDocIds` Set on every retry → duplicate events after reconnect

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/RealtimeService.ts:118-184`

```ts
const subscribe = () => {
  const channelQuery = query(...)
  const seenDocIds = new Set<string>()
  let isHydrated = false
  unsubscribe = onSnapshot(channelQuery, (snapshot) => {
    if (!isHydrated) {
      snapshot.docs.forEach((doc) => seenDocIds.add(doc.id))
      isHydrated = true
      return
    }
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added' || seenDocIds.has(change.doc.id)) return
      seenDocIds.add(change.doc.id)
      ...
    })
  }, (error) => { /* schedules subscribe() again → fresh Set */ })
}
```

**Root cause** — on retry the closure's `seenDocIds` and `isHydrated` are reset.
The hydration step swallows the first 20 docs (intended dedup), but if the latest
event was 19 minutes ago and a new one lands during the gap, the freshly-hydrated
listener will treat it as part of the initial backlog and **drop** it, while the
*previous* listener already delivered it → race window where the same doc is either
delivered twice (if cross-listener) or lost (if hydration eats it).

Also: when the Firestore SDK transparently reconnects (no error fired), `isHydrated`
stays `true` and `seenDocIds` keeps growing forever — **memory leak** for long-lived
sessions on chat / WO detail screens.

**Risk: High** for duplicates; **Medium** for memory leak. Combined with 1.3 makes the
chat experience unstable.

**Fix**
- Keep `seenDocIds` outside the `subscribe` closure scoped to the *unsubscribe lifetime*.
- Cap set size (`if (seenDocIds.size > 500) seenDocIds.delete(seenDocIds.values().next().value)`).
- Use `query(... where('createdAt', '>', lastSeenAt))` instead of `limit(20)` to skip
  the hydration-swallow trick.

---

### 2.3 [Medium] Profile sync subscribes regardless of `enableBackgroundSync` *but* relies on it; double-subscribe risk

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/useProfileSync.ts:71-79`

```ts
useEffect(() => {
  if (!enableBackgroundSync || !user?.id) return;
  return realtimeService.subscribeToUserStream(user.id, (event) => {
    handleProfileRefresh(...)
  });
}, [enableBackgroundSync, handleProfileRefresh, user?.id]);
```
`useProfileSync` is called from `app/(app)/_layout.tsx`; if a child screen also calls
`useProfileSync({ enableBackgroundSync: true })` (sales / customer flows do), there
will be N parallel listeners on the same `users/{id}/events`. They all share the
same Firestore websocket frame, but each one will trigger `refetchProfile()` on every
`profile.refresh` event → N concurrent `/api/mobile/profile` requests.

**Risk: Medium** — bandwidth + race on `updateUser` (last-write wins).

**Fix** — make the listener a singleton owned by `RealtimeProvider` and emit through
a shared event bus (or React Query `setQueryData`).

---

### 2.4 [Medium] `RealtimeProvider.disconnect()` resets the auth promise but does NOT cancel active listeners owned by screens

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/RealtimeService.ts:95-98`, `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/context/RealtimeProvider.tsx:60-65`

```ts
disconnect(): void {
  resetRealtimeAuthentication()
  // Listener cleanup is owned by each subscription.
}
```
On logout the provider unmount fires; `realtimeService.disconnect()` resets the auth
cache but the screen-owned listeners (e.g. `useProfileSync`) keep running with the
old `auth.currentUser`. Combined with 1.1, after `auth.signOut()` is *not* called,
the next user that signs in will be subscribed under the previous UID until the app
is killed → **cross-account event leakage**.

**Risk: Medium → High** depending on how fast user switching happens during demo /
shared-device usage.

**Fix** — `disconnect()` must call `signOut(getMobileFirebaseAuth())` and surface a
`Subject`-like cancel signal so subscribers can dispose.

---

## 3. FCM token lifecycle

### 3.1 [High] No backend idempotency — duplicate FCM rows on app restart / token refresh storm

**Mobile**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/FirebaseMessagingService.ts:85-89, 132-137`
```ts
await api.post('/api/mobile/fcm-token', payload, {
  headers: { 'Idempotency-Key': `fcm-${action}-${token}` },
  ...
});
```
**Backend**: `/Users/rohadimraja/Documents/radpro/netmanager/app/api/mobile/fcm-token/route.ts:10-43`
— never reads `Idempotency-Key`, no rate limit, no deduplication store.

**Plus** `/Users/rohadimraja/Documents/radpro/netmanager/modules/notification/services/MobileFcmTokenService.ts:102-106`:
```ts
if (options.tokens.includes(options.fcmToken)) {
  return Promise.resolve();
}
return appendMobileFcmToken(options);
```
This dedupes *per call* via in-memory check → race condition: two concurrent
`POST /api/mobile/fcm-token` requests (e.g. login + token-refresh listener firing
simultaneously) both read `tokens=[]`, both push the same token → array gets the
same string twice. Postgres `String[]` column has no uniqueness, and dispatch
side will then send the same notification N times.

**Risk: High** — duplicate notifications for users who reinstall, users who
log out/in within a token refresh window, or any user whose FCM token rotates
(the listener in `AuthContext.tsx:54` re-fires `syncFcmToken` separately).

**Fix**
- Backend: switch from `push` to `set([...new Set([...current, fcmToken])])` inside
  a transaction.
- Implement Idempotency-Key middleware (check Redis, return cached response).
- Add a unique index on `(userId, fcmToken)` if a side-table is preferred.

---

### 3.2 [Critical] Cross-tenant FCM dispatch leak — `getAdminTokens()` ignores `tenantId`

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/lib/firebase/messaging.ts:9-29`
```ts
export async function getAdminTokens(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: { accessAdminPanel: true }, isActive: true },
  });
  // <-- no tenantId filter; pulls every admin from every tenant
  ...
}
```
Used by `notifyAdmins(...)` in
`/Users/rohadimraja/Documents/radpro/netmanager/modules/notification/services/NotificationService.delivery.ts:172`.

**Risk: Critical** — high-priority notifications from tenant A are pushed to admins
of tenant B (and every other tenant). This is a multi-tenant data-leak vector
(notification body / metadata can carry customer names, work-order IDs).

**Fix** — accept `tenantId` and add to `where`. Caller `notifyAdmins` already
receives `data.siteId` — extend with `data.tenantId` and propagate.

---

### 3.3 [High] `messaging` admin SDK is nullable but `sendFCMNotification` does not null-check

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/lib/firebase/messaging.ts:49-87`
```ts
const response = await messaging.sendEachForMulticast({...});
```
Compare with the **safer** version in
`/Users/rohadimraja/Documents/radpro/netmanager/lib/realtime/firebase-realtime-service.ts:212`:
```ts
if (!input.tokens.length || !messaging) { return null; }
```

Service-account env vars optional (see `lib/firebase/admin.ts:9-15`) → in environments
where `FIREBASE_PRIVATE_KEY` is missing (e.g. CI, local dev without secrets), every
`sendFCMNotification` call throws `TypeError: Cannot read properties of null
(reading 'sendEachForMulticast')`. The caller *does* swallow the rejection
(`.catch(error => logger.error(...))`) but only because notifications are fire-and-forget.

**Risk: High** in dev / staging because every notification create logs a noisy stack
trace and may hide real issues.

**Fix** — mirror the null-check pattern from `firebase-realtime-service.ts`.

---

### 3.4 [High] FCM token not deleted from device on logout

**Files**:
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/context/AuthContext.tsx:136-150` (signOut)
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/FirebaseMessagingService.ts:45-109` (no `deleteToken`)

`signOut` calls `syncFcmToken('remove')` (server-side cleanup) but never calls
`messaging().deleteToken()`. On the next login the *same* FCM token is re-registered
to user B. If user A logs back in within the rotation window (24-48h on Android
without Play Services token rotation), notifications targeted at user B are
delivered to user A's device when they happen to be using the app under A's session
→ **multi-account leak** on shared devices.

**Risk: High** for shared-device customers; **Medium** for single-user.

**Fix** — `await deleteToken(messaging)` on logout, then call `getToken()` only after
the next `signIn`. Clear `lastSyncedToken` cache on logout.

---

### 3.5 [Medium] Stale tokens never reaped from `fcmTokens[]` on FCM error

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/lib/firebase/messaging.ts:49-87`
```ts
const response = await messaging.sendEachForMulticast({...});
logger.info(`[FCM] Multicast sent: ${response.successCount} success, ${response.failureCount} failed.`);
```
`response.responses[i].error.code === 'messaging/registration-token-not-registered'`
is never inspected. Uninstalled devices accumulate forever in user/mitra `fcmTokens[]`.
Per FCM rate limits, sending to ~100 dead tokens per multicast still counts toward
quota and slows delivery.

**Risk: Medium** — quota burn + slower fan-out.

**Fix**
```ts
const stale = response.responses
  .map((r, i) => (!r.success && r.error?.code === 'messaging/registration-token-not-registered' ? tokens[i] : null))
  .filter(Boolean) as string[];
if (stale.length) await pushTokenRepository.clearPushTokens(stale);
```
The repository already exposes `clearPushTokens` and `findUsersByPushTokens`
(`PushTokenRepository.ts:91-134`) — wire them.

---

### 3.6 [Medium] `lastSyncedToken` cache stays across logout

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/FirebaseMessagingService.ts:16-94`

After logout the singleton `fcmService.lastSyncedToken` and `lastSyncedAction='remove'`
linger. On the **next login** the same physical token is sent with `action='add'`,
which goes through (different action). But if the user logs in *again* after a
silent app restart (where the listener in `AuthContext.tsx:202` re-runs `syncFcmToken('add')`),
the dedupe at line 72 skips the call → the new account never gets the token registered.

**Risk: Medium** — login-after-crash flow → no notifications until token rotates.

**Fix** — reset `lastSyncedToken=null; lastSyncedAction=null` from `clearLocalSession`.

---

## 4. Push notification handler (foreground / background / killed)

### 4.1 [Medium] `presentForegroundNotification` only renders on Android — iOS foreground silent

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/ForegroundNotificationService.ts:14-17, 28-31`
```ts
export async function presentForegroundNotification(...) {
  if (Platform.OS !== 'android') { return; }
  ...
}
```
Combined with `useNotificationSetup.ts:99-104` — iOS receives the FCM payload via
`onMessage`, but neither `notifee` nor an iOS heads-up alert is fired, only
`presentInfoMessage()` (toast). Most users will miss it because react-native-toast
auto-dismisses after 4s.

**Risk: Medium** — high-priority alerts (work order assigned, payment due) miss iOS
foreground users. Spec / product decision: do we want iOS to *also* show OS-level
heads-up while in foreground? FCM's default is to suppress foreground notifications
on iOS, so an explicit `notifee.displayNotification` *with iOS channel config* is
required.

**Fix** — extend `presentForegroundNotification` to call notifee on iOS with
`ios.foregroundPresentationOptions: ['alert','sound']`.

---

### 4.2 [Medium] Killed-state deep-link race — 500ms `setTimeout` is fragile

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/useNotificationSetup.ts:81-92`
```ts
const initialNotificationData = await getInitialNotificationData();
if (initialNotificationData) {
  notificationNavigationTimer = setTimeout(
    () => handleNotificationNavigation(initialNotificationData), 500
  );
}
```
Why 500ms? Because expo-router's segments aren't ready yet on cold start. On slow
devices (Android Go, low-end POCO) the navigator can take >800ms to mount; the
`router.push(url)` then no-ops or errors → user lands on dashboard instead of the
intended deep link.

**Risk: Medium** — flaky deep-link UX from killed state.

**Fix** — replace timer with explicit "router-ready" gate:
```ts
const segments = useSegments(); // already used in _layout
useEffect(() => {
  if (segments.length > 0 && pendingDeepLink) handleNotificationNavigation(pendingDeepLink)
}, [segments, pendingDeepLink])
```

---

### 4.3 [Medium] Background message handler is a console.log only — no query invalidation, no notifee display

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/index.js:14-16`
```ts
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('FCM Message handled in the background!', remoteMessage);
});
```
For *data-only* FCM messages (no `notification` field) the OS will **not** display
anything. The user receives nothing. For background data sync (e.g. silent push to
refresh notifications), the handler should also `notifee.displayNotification` for
data-only payloads or invalidate AsyncStorage caches.

**Risk: Medium** — depends on whether backend ever sends data-only pushes. Today
`sendFCMNotification` always sets `notification.title/body`, so OS will display.
But the handler is **dead code** — refactor or remove.

**Fix** — either delete and rely on system tray, or implement the proper data-only
flow with a notifee fallback.

---

### 4.4 [Low] Permission gating happens *inside* the FCM sync, not before

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/FirebaseMessagingService.ts:46-53`

`requestUserPermission` is called inside `syncFCMTokenToBackend('add')`, which means
the permission dialog pops on first sign-in instead of in a contextual onboarding step.

**Risk: Low** — UX, not security.

**Fix** — move to a dedicated screen / pre-prompt rationale (Android 13+ best practice).

---

## 5. Real-time chat

### 5.1 [Critical] Chat realtime end-to-end mismatch (see 2.1) — chat appears live but isn't

The `chat/[conversationId].tsx` screen subscribes to `chats/{id}/events` for
`chat.message`, `chat:typing`, `chat:stop_typing` (`/Users/rohadimraja/Documents/radpro/mobile-netmanager/app/(app)/chat/[conversationId].tsx:200-231`).

- **Inbound `chat.message`**: backend never publishes to that path (channel-map.ts has
  no `chat` case). Messages only appear when the screen REST-fetches them on send or
  on focus.
- **Inbound `chat:typing` / `chat:stop_typing`**: only `emitToRoom` from the same
  device produces these events. So the user sees their own typing indicator (because
  Firestore round-trips), but the *peer* never sees it.
- Image upload progress (`uploadService.uploadCustom`) has no realtime fan-out either.

**Risk: Critical** — chat UX promises real-time but is fully REST-bound today.
Read receipts, message ordering, offline draft are not even attempted in the code
(no `read_at` field, no `Outbox` table on mobile, `getMessages` does cursor
pagination only).

**Fix** — full chat realtime spec required. Either:
- Migrate chat send to publish via `firebaseRealtimeService.publish({type:'chat.message', scope:{kind:'chat',id:convId}, ...})` after persisting to Postgres, OR
- Drop Firestore for chat, use the existing socket.io path.

Given the rest of the realtime stack is on Firestore, option 1 is more consistent.

---

### 5.2 [Medium] No offline outbox — messages composed offline are lost

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/ChatService.ts:90-101`
```ts
async sendMessage(conversationId, content?, imageUrl?): Promise<ChatMessage> {
  const response = await api.post(...);
  ...
}
```
No queue, no retry, no AsyncStorage persistence. If the user composes a message in a
tunnel and submits, axios rejects → caller throws → message is lost.

**Risk: Medium** — data loss for field engineers in remote sites (the actual user
base of this app).

**Fix** — queue via the existing offline-mutation infra (the codebase already has
TanStack-Query persisted queries; extend to mutations or use Async-style outbox).

---

## 6. Backend Firestore admin SDK + security rules

### 6.1 [Critical] `firestore-rules-update.txt` is ambiguous on writes — likely not deployed

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/firestore-rules-update.txt`

The committed rules file:
1. Has no closing `allow write` for `/users/{userId}/events/{eventId}`, `/admins/...`,
   `/workorders/...`, `/tickets/...`. By Firestore default (no rule = deny), backend
   admin SDK writes still work because Admin SDK bypasses rules.
2. `/presence/{userId}` allows write only to self (`request.auth.uid == userId`) but
   `allow read: if isSignedIn()` is duplicated below the more-specific rule and is
   broader — Firestore short-circuits on first match, so this is safe but confusing.
3. **No `match /chats/{...}/events/{...}`**, so even if mobile starts writing typing
   indicators (see 2.1), they will be **rejected** with `PERMISSION_DENIED`. The
   silent retry loop (1.1) would then spin forever.
4. **No `match /departments/{...}/events/{...}`** even though backend writes there
   (`buildScopeChannel` line 45 of channel-map.ts) and mobile reads from it via
   `subscribeToScope({kind:'department',...})`. **Mobile can never read department
   events** — mobile listener will get `permission-denied`.
5. The file is named `firestore-rules-update.txt` (not `firestore.rules` / `*.rules`)
   and there is no `firebase.json` rules pointer. The `firebase.json` exists at root
   of mobile but does not deploy rules. Suggests the rules **were never applied** or
   are managed manually in Firebase Console — high risk of drift.

**Risk: Critical** — rule drift means we cannot reason about what's actually deployed.
Combined with 6.2 below, the worst case is "rules are wide open in the console".

**Fix**
- Rename to `firestore.rules`, add deploy entry to `firebase.json` `firestore` block.
- Add explicit `allow write: if false;` to event collections so client writes can
  never happen by accident (admin SDK still writes via privileged path).
- Add `/departments/{dept}/events/{eid}` rule scoped to user's department claim:
  ```
  match /departments/{dept}/events/{eventId} {
    allow read: if isSignedIn() && request.auth.token.departmentId == dept;
  }
  ```
- Add chat rule (scoped to participants — needs participant list mirrored to a
  separate Firestore doc since rules can't query Postgres):
  ```
  match /chats/{convId}/events/{eventId} {
    allow read: if isSignedIn() && request.auth.uid in get(/databases/$(database)/documents/chats/$(convId)).data.participants;
  }
  ```

---

### 6.2 [High] Custom claims include `accessAdminPanel`/`isSuperAdmin` but stale until next mint

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/app/api/mobile/auth/firebase-token/route.ts:28-37`
```ts
const customToken = await firebaseAdminAuth.createCustomToken(session.id, {
  role: ..., tenantId: ..., siteId: ...,
  accessAdminPanel: Boolean(session.accessAdminPanel),
  isSuperAdmin,
});
```
Once a custom token is minted, the Firebase ID token derived from it is good for 1h
and refreshed using the (server-side) refresh token bound to the user. Custom claims
in the ID token are **only** updated when:
1. A new `signInWithCustomToken` is called, OR
2. Backend calls `auth.setCustomUserClaims(uid, ...)` AND client calls
   `getIdToken(true /* forceRefresh */)`.

Today the backend does **not** call `setCustomUserClaims` — it only embeds claims
in the *custom token* (which is one-time use). When a user is demoted from `MANAGER`
to `OPERATOR` in Postgres, their Firestore reads continue to pass `canAccessAdminPanel()`
until the user next signs in to mobile. Window: up to days/weeks.

**Risk: High** — privilege escalation via stale claims. A demoted admin keeps
listening to admin events until token expiry forces a re-sign-in.

**Fix**
- On role/permission change in `roles` module, call
  `firebaseAdminAuth.setCustomUserClaims(userId, ...)` AND notify the user via
  socket.io / Firestore to call `getIdToken(true)`.
- Add a "claims-version" field; rules check `request.auth.token.cv == get(.../claimsVersion)`.

---

### 6.3 [Medium] No rate-limit on `/api/mobile/auth/firebase-token`

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/app/api/mobile/auth/firebase-token/route.ts`

Anyone with a valid mobile session token can mint a Firebase custom token without
quota. `firebaseAdminAuth.createCustomToken` itself is rate-limited by Firebase
(0.5 QPS sustained per project), but a malicious client could trivially exhaust the
quota and DoS realtime for everyone.

**Risk: Medium** — single user can take down all-tenant realtime.

**Fix** — wrap with the project's rate-limit middleware (the codebase has one,
based on settings doc reference) — limit to e.g. 10 mints/min per user.

---

### 6.4 [Low] Custom token claims include sensitive `siteId`/`departmentId` that leak to client

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/app/api/mobile/auth/firebase-token/route.ts:29-37`

Firebase custom-token claims are plaintext-readable on the client (the JWT is signed,
not encrypted). Claims include `siteId`, `departmentId`, `primarySiteId`, `tenantId`.
Mobile client already has these via session, so no new info, but makes the token
forensics-friendly to attackers who steal a single JWT (e.g. via screen recording).

**Risk: Low** — defence-in-depth.

**Fix** — drop claims that are not used in Firestore rules. Only `tenantId`, `role`,
`isSuperAdmin`, `accessAdminPanel` are referenced in `firestore-rules-update.txt`.

---

## 7. Cross-cutting / contract risks

### 7.1 [High] Mobile + backend `RealtimeScopeKind` unions diverge — type drift

| union member | mobile (`RealtimeService.ts:51`) | backend (`contracts.ts:31`) |
|---|---|---|
| user        | yes | yes |
| department  | yes | yes |
| workorder   | yes | yes |
| ticket      | yes | yes |
| admin       | yes | yes |
| **chat**    | **yes** | **NO** |

Already covered in 2.1; flagging here as a process gap. There is no shared package
or contract test linking the two repositories.

**Fix** — extract a shared contracts package (`@netmanager/realtime-contracts`) or
add a pre-commit script that diffs the two unions.

---

### 7.2 [Medium] Listener cleanup uses `eventManager` keyed by string but hook re-runs

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/useNotificationSetup.ts:131-153`
```ts
eventManager.addListener('root_notifications', null, cleanup);
...
return () => {
  if (notificationNavigationTimer) clearTimeout(notificationNavigationTimer);
  eventManager.removeAllListeners('root_notifications');
};
```
`useNotificationSetup` is a top-level hook in `_layout.tsx`. If the layout remounts
(rare, but possible on theme change / locale change in Expo Router), the cleanup
removes ALL `root_notifications` listeners (including any that another module might
have added with the same key), then re-adds. Lower-risk, but the keyspace is shared
and untyped.

**Risk: Low → Medium** depending on what else uses that key.

**Fix** — namespace the key with a UUID per hook instance, or just store the cleanup
in a `useRef`.

---

# Priority order for remediation

1. **Critical**:
   - 3.2 cross-tenant FCM admin leak — fix in same PR; affects production data privacy.
   - 1.1 custom-token expiry / no refresh — silent realtime outage.
   - 5.1 chat realtime is dead — fix or roll back the feature flag.
   - 6.1 Firestore rules drift / unwritten rules for chat & departments.
2. **High**:
   - 2.1 / 7.1 chat scope contract mismatch.
   - 2.2 listener leak + dedupe race in `subscribeToScope`.
   - 3.1 idempotency ignored on backend.
   - 3.3 messaging admin null-deref.
   - 3.4 FCM token leakage on shared device.
   - 6.2 stale custom claims.
3. **Medium**: 1.2, 1.3, 2.3, 2.4, 3.5, 3.6, 4.1, 4.2, 4.3, 5.2, 6.3, 7.2.
4. **Low**: 4.4, 6.4.

Total: **2 Critical, 8 High, 11 Medium, 2 Low**. Recommend ticketing as a single
"Realtime/FCM hardening" epic and shipping the four Criticals together (they share
auth/claims/rules surface).
