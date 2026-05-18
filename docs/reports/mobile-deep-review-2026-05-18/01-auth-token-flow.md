# Deep Review — Auth & Token Flow (mobile-netmanager + netmanager backend)

Tanggal: 2026-05-18
Scope: JWT login, refresh, secure storage, axios interceptor, version gating, logout, RBAC tenant isolation.

---

## Executive Summary

Total temuan: **17** (Critical: 2, High: 5, Medium: 6, Low: 4).

Auth flow secara umum sudah solid (single-flight refresh, secure storage native, RBAC di backend). Namun ada **dua isu critical**: (1) tidak ada server-side revocation untuk Employee/Mitra saat logout — refresh token tetap valid 30 hari setelah user logout, dan (2) kredensial password disimpan plaintext di SecureStore untuk biometric login (siapa pun yang dapat root device → dapat password). Selain itu ada beberapa race-condition kecil di interceptor dan konflik desain antara dua sistem JWT (jose vs jsonwebtoken) dengan klaim audience yang berbeda.

---

## 1. Critical Findings

### C-1. Logout TIDAK melakukan server-side revocation untuk Employee/Mitra

**File**:
- `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/context/AuthContext.tsx:136-150` (signOut)
- `/Users/rohadimraja/Documents/radpro/netmanager/lib/mobile-auth.ts:36-62` (getMobileTokenVersion)
- `/Users/rohadimraja/Documents/radpro/netmanager/modules/users/services/MobileEmployeeAuthService.ts:42-73` (tryLogin)

**Severity**: Critical

**Root cause**:
`signOut()` di mobile hanya menjalankan `clearLocalSession()` + best-effort FCM removal. Tidak ada panggilan ke endpoint `/api/mobile/auth/logout` (endpoint ini juga TIDAK ADA di backend — diverifikasi dengan `find app/api/mobile -name "logout*"` returns empty).

```typescript
// AuthContext.tsx:136-150
const signOut = useCallback(async (options?: { skipApi?: boolean }) => {
    try {
        if (token && !options?.skipApi) {
            stopFcmTokenRefreshListener();
            syncFcmToken('remove');
        }
    } catch (error) { /* ... */ }
    finally {
        await clearLocalSession();   // hanya menghapus token lokal
    }
}, [...]);
```

Untuk **Customer (pelanggan)**, login melakukan rotasi `tokenVersion` (`generatePelangganRefreshToken` di `lib/jwt.ts:89-126`). Tetapi **Employee dan Mitra** tidak — `signMobileToken` di `lib/mobile-auth.ts:79-88` hanya **membaca** `tokenVersion` dari DB, tidak meng-increment-nya. Akibatnya:

- Logout di device A → refresh token Employee TETAP valid selama 30 hari
- Jika token bocor (mis. backup file tidak terenkripsi, bug pencurian dari device lain) → attacker dapat mendapat access token baru selama 30 hari penuh tanpa cara untuk dicabut
- Tidak ada cara user atau admin untuk meng-invalidate session secara eksplisit

**Risk impact**: High — terutama untuk role admin/superadmin yang punya `permissions: ["*"]` di payload (lihat `lib/mobile-auth.ts:343-350`).

**Fix proposal**:

```typescript
// 1. Tambah endpoint backend
// app/api/mobile/auth/logout/route.ts
export async function POST(request: NextRequest) {
  const auth = await getMobileAuthPayload(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role === "CUSTOMER") {
    await invalidatePelangganRefreshTokens(auth.id as string);
  } else if (auth.role === "MITRA") {
    // Mitra tokenVersion = 0 (hardcoded) — perlu schema change atau revocation list
    await prismaMitraAuth.mitra.update({
      where: { id: auth.id as string },
      data: { tokenVersion: { increment: 1 } },
    });
  } else {
    await prismaAuth.user.update({
      where: { id: auth.id as string },
      data: { tokenVersion: { increment: 1 } },
    });
  }
  return apiSuccess({ message: "Logout berhasil" });
}

// 2. Mobile: panggil endpoint sebelum clearLocalSession
const signOut = useCallback(async (options?: { skipApi?: boolean }) => {
  try {
    if (token && !options?.skipApi) {
      // best-effort, jangan block logout jika gagal
      await api.post('/api/mobile/auth/logout', {}, { skipErrorToast: true, skipRetry: true })
        .catch(err => logger.warn('[Auth] Logout API failed', err));
      syncFcmToken('remove');
    }
  } finally {
    await clearLocalSession();
  }
}, [...]);
```

Catatan untuk Mitra: di `lib/mobile-auth.ts:41-43`, tokenVersion untuk MITRA di-hardcode ke `0`, sehingga tidak ada mekanisme cek version sama sekali. Skema Mitra harus ditambah kolom `tokenVersion` Int default 0 + migrasi.

---

### C-2. Password Plaintext disimpan di SecureStore untuk biometric login

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/CredentialStorageService.ts:8-17`

**Severity**: Critical

```typescript
async saveCredentials(email: string, password: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(STORED_EMAIL_KEY, email);
    await SecureStore.setItemAsync(STORED_PASSWORD_KEY, password);  // plaintext
    return true;
  } catch (error) { /* ... */ }
}
```

**Root cause**: Mobile menyimpan password plaintext untuk men-replay login setelah biometric success (lihat `app/(auth)/login.tsx:120-136`). Ini menjadikan biometric "thin layer" — biometric **bukan** sumber autentikasi, hanya gerbang untuk membuka brankas password.

**Implikasi keamanan**:
- expo-secure-store di Android → AES-GCM via Keystore, tapi tidak mandate `requireAuthentication: true`. Pada device rooted/jailbroken (dan Android < 6 jika ada legacy users) password bocor.
- iOS Keychain default access tier kemungkinan `kSecAttrAccessibleWhenUnlocked` (bukan `WhenUnlockedThisDeviceOnly`) — bisa terbawa ke device baru via iCloud Keychain backup.
- `expo-secure-store` di SDK Expo modern menyediakan opsi `requireAuthentication`, tapi tidak digunakan di sini.

**Fix proposal** (defense-in-depth pattern):

```typescript
// Option A (preferred): Server-side biometric session token
// Backend issue refresh token khusus dengan flag `biometric_paired:true` saat user enroll biometric.
// Mobile simpan token ini (BUKAN password) di SecureStore dengan requireAuthentication.

// Option B (minimum): Wrap SecureStore dengan biometric-protection
await SecureStore.setItemAsync(STORED_PASSWORD_KEY, password, {
  requireAuthentication: true,
  authenticationPrompt: 'Buka brankas kredensial',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

// Option C (if must keep password): encrypt with key derived from device-bound material,
// dan jangan sekali-kali expose password plaintext setelah unlock — gunakan langsung untuk login lalu hapus dari memory.
```

Selain itu, **password tidak pernah dihapus saat user disable biometric**. Lihat `BiometricService.disableBiometric()` (line 282-291) — hanya menghapus flag `BIOMETRIC_ENABLED_KEY`, tapi `STORED_PASSWORD_KEY` tetap ada di SecureStore.

---

## 2. High Severity Findings

### H-1. Refresh single-flight tidak menangani race kedua: requests yang antri DI INTERCEPTOR

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/api.ts:188-222`, `src/services/RefreshTokenService.ts:64-81`

**Severity**: High

**Root cause**: `RefreshTokenService.refreshAccessToken()` benar punya single-flight (modul-level `isRefreshing` flag + `refreshPromise`). Namun **interceptor 401 di api.ts** memanggil `refreshAccessToken` lalu langsung me-retry request original — semua dilakukan secara independen per-request:

```typescript
// api.ts:202-214
try {
  const newToken = await RefreshTokenService.refreshAccessToken();
  if (newToken) {
    config.headers.Authorization = `Bearer ${newToken}`;
    config._isRetryAfterRefresh = true;
    return api(config);   // retry
  }
} catch (refreshError) { /* ... */ }
```

Skenario race:
1. 5 request paralel kena 401 secara bersamaan (token expired)
2. Request #1 trigger `refreshAccessToken()` → `isRefreshing = true`
3. Request #2-5 juga panggil `refreshAccessToken()` → resolve ke `refreshPromise` yang sama → semua dapat token baru
4. **Tetapi**: kelima request meng-overwrite `config.headers.Authorization` dan retry. Jika `config` di-share (axios kadang me-mutate config asli), token bisa overlap. Lebih penting: kelima retry akan dijalankan **paralel** padahal jika token refresh gagal, **kelima**-nya akan emit `Events.AUTH_UNAUTHORIZED` → 5x logout signal.

Dampak: pada listener `AUTH_UNAUTHORIZED` (`AuthContext.tsx:238-241`), `signOut({ skipApi: true })` dipanggil 5x cepat berturut-turut → race antara `setIsLoading`, `setUser(null)`, `queryClient.clear()`, dan navigasi router. Pernah ada laporan UI flicker / blank screen di laporan QA?

**Fix proposal**: Antrekan request yang menunggu refresh, jangan emit unauthorized ganda.

```typescript
// api.ts — buat queue di module scope
const pendingRefreshQueue: Array<(t: string | null) => void> = [];
let unauthorizedEmittedAt = 0;

if (error.response?.status === 401 && !config._isRetryAfterRefresh) {
  // Jika sudah ada refresh in-flight, tunggu sebagai pasif
  const newToken = await RefreshTokenService.refreshAccessToken();

  if (!newToken) {
    // Throttle emit — hanya 1x per 1 detik
    const now = Date.now();
    if (now - unauthorizedEmittedAt > 1000) {
      unauthorizedEmittedAt = now;
      DeviceEventEmitter.emit(Events.AUTH_UNAUTHORIZED);
    }
    return Promise.reject(error);
  }
  /* retry */
}
```

Atau: tambahkan idempotency di handler `AUTH_UNAUTHORIZED` (debounce 500ms).

---

### H-2. Refresh token bug: setItemAsync dengan key 'session_token' (tanpa prefix)

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/RefreshTokenService.ts:116`

**Severity**: High

```typescript
// RefreshTokenService.ts:115-116
// Save new access token to secure storage
await SecureStore.setItemAsync('session_token', newAccessToken);
```

`signIn` dan `clearLocalSession` mengakses `session_token` via `SecureStorage.setItemStrict('session_token', ...)` (file `utils/storage.ts`). Pada native platform, `SecureStorage.setItemStrict` memanggil **`SecureStore.setItemAsync(key, value)`** tanpa prefix (`utils/storage.ts:118`). Namun key untuk SecureStore tidak diberi `SECURE_STORAGE_PREFIX` (kontras dengan `Storage` yang menambahkan `STORAGE_PREFIX`).

**Tapi pada web fallback** (`utils/storage.ts:113-117`), key DIBERI prefix `SECURE_STORAGE_PREFIX`. Sedangkan `RefreshTokenService` langsung pakai `SecureStore.setItemAsync` (raw, untuk native), padahal di web fallback storage.ts pakai key dengan prefix.

**Akibat**: Jika app dijalankan di web (Platform.OS === 'web'), token disimpan ke `localStorage['netmanager_secure_session_token']` saat login, tapi refresh menulis ke `SecureStore.setItemAsync('session_token', ...)` yang di web platform **tidak akan disetel sama sekali** karena RefreshTokenService tidak detect web. Pada native, key sama (tanpa prefix) — masih konsisten, tapi rapuh.

**Fix proposal**: gunakan `SecureStorage` wrapper konsisten:

```typescript
// RefreshTokenService.ts
import { SecureStorage } from '@/utils/storage';

// di doRefresh()
await SecureStorage.setItemStrict('session_token', newAccessToken);
```

---

### H-3. `skipGlobalAuthHandler` semantik berbeda dari yang dikira — tetap retry & skip refresh

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/api.ts:182-186`

**Severity**: High

```typescript
if (config.skipGlobalAuthHandler) {
  logger.warn(`[API] 401 from ${config.url} ignored due to skipGlobalAuthHandler`);
  return Promise.reject(error);
}
```

`login.tsx:71` set `skipGlobalAuthHandler: true` agar login attempt dengan kredensial salah tidak trigger logout. **Tetapi** flag ini ditempatkan di interceptor SETELAH retry-block (line 173-180). Konsekuensinya:
1. Login dengan kredensial salah → response 401 → `skipGlobalAuthHandler: true` membuat unauthorized handler skip ✅
2. Tapi jika login pernah kena 5xx → masuk ke `shouldRetry()` block → akan diretry **MAX_RETRIES (3) kali**! Login bukan idempotent (boleh ada side-effect rate-limiting di backend, atau dapat lock akun setelah X failed attempt).

Walau `isIdempotentRequest()` mengembalikan false untuk POST tanpa idempotency-key, tetapi LOGIN tidak punya `Idempotency-Key`, jadi 5xx login retry tidak dilakukan. **Aman** untuk POST. Namun ini sinyal desain rapuh: penambahan idempotency-key suatu hari akan menyebabkan login attempt diretry 3x ke server saat 5xx.

**Fix proposal**: Eksplisit set `skipRetry: true` di login call:

```typescript
// login.tsx:71
}, {
  skipGlobalAuthHandler: true,
  skipRetry: true,            // login tidak boleh diretry (mungkin trigger account lockout)
});
```

Dan refactor: `skipGlobalAuthHandler` sebaiknya juga implisitly set `skipRetry: true` untuk konsistensi:

```typescript
// api.ts request interceptor
if (config.skipGlobalAuthHandler) {
  config.skipRetry = config.skipRetry ?? true;  // safety default
}
```

---

### H-4. `verifyMobileToken` melakukan 2-3 DB queries per request — N+1 risk untuk endpoint padat

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/lib/mobile-auth.ts:228-368`

**Severity**: High

Untuk setiap request mobile, backend menjalankan:
1. `prismaAuth.user.findUnique({...})` (line 257-271) — termasuk JOIN ke `role.permission`
2. Jika user not found → `prismaAuth.pelanggan.findUnique(...)` (line 274-285)
3. Jika juga not found → `prismaMitraAuth.mitra.findUnique(...)` (line 308-318)

Dampak:
- Customer login: minimal 2 query (user miss + pelanggan hit) untuk **setiap** request
- Mitra: 3 query untuk setiap request
- Token version cek dilakukan via tabel — beban besar di endpoint padat (mis. attendance heartbeat, dashboard polling)

**Root cause**: tidak ada caching layer; tidak ada hint "role" di JWT yang dipercaya untuk routing query (role di payload bisa di-trust untuk routing tabel — tetap perlu DB cek tokenVersion, tapi cukup 1 query).

**Fix proposal**:
```typescript
// 1. Trust payload.role untuk routing
const role = payload.role as string | undefined;

if (role === "CUSTOMER") {
  const customer = await prismaAuth.pelanggan.findUnique({...});
  // ... only this query
} else if (role === "MITRA") {
  const mitra = await prismaMitraAuth.mitra.findUnique({...});
} else {
  const user = await prismaAuth.user.findUnique({...});
}

// 2. Cache tokenVersion + permissions di Redis (TTL 60s) — hit rate akan tinggi
const cacheKey = `mobile:auth:${role}:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) { /* validasi version */ }
```

---

### H-5. Mitra tidak punya `tokenVersion` mechanism — token tidak dapat di-revoke kecuali soft-delete

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/lib/mobile-auth.ts:41-43`

**Severity**: High

```typescript
async function getMobileTokenVersion(payload: Record<string, unknown>) {
  // ...
  if (role === "MITRA") {
    return 0;     // hardcoded — Mitra tidak punya kolom tokenVersion
  }
  // ...
}
```

Akibat: untuk akun MITRA_TEKNISI yang berhenti kerja, atau MITRA_SALES yang dimutasi, satu-satunya cara mencabut akses adalah set `mitra.isActive = false` (cek di line 320-322). Tidak ada mekanisme rotasi password atau revoke session selain itu.

Akan menjadi masalah saat **password reset** Mitra ditambahkan: token lama tetap valid hingga 30 hari kecuali ada tokenVersion check.

**Fix proposal**: tambah kolom `tokenVersion Int @default(0)` di tabel Mitra + migrasi + update `getMobileTokenVersion` untuk read dari Mitra.

---

## 3. Medium Severity Findings

### M-1. Login: `clearCredentials()` HANYA dipanggil saat status 401 — branch coverage lemah

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/app/(auth)/login.tsx:97-110`

```typescript
if (status === 401) {
  presentErrorMessage('Email atau password salah.', 'Login Gagal');
  if (saveCreds) {
    await credentialStorageService.clearCredentials();
    setHasStoredCredentials(false);
  }
}
```

Jika password user diubah di backend, biometric login yang melakukan `performLogin(credentials.email, credentials.password, false)` akan menerima 401 → tetapi `saveCreds=false` → `clearCredentials()` TIDAK dipanggil. Akibatnya: user terjebak di loop biometric → 401 → modal error → biometric → 401, tanpa cara clear stored credentials.

**Fix**:
```typescript
if (status === 401) {
  // Selalu clear credentials saat 401, untuk biometric path juga
  await credentialStorageService.clearCredentials();
  setHasStoredCredentials(false);
  presentErrorMessage('Kredensial sudah tidak valid. Silakan login manual.', 'Login Gagal');
}
```

---

### M-2. Access token Customer expiry 7d (bukan 15m sesuai komentar)

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/lib/jwt.ts:49`, `MobileCustomerAuthService.ts:108`

```typescript
// jwt.ts:49
const JWT_EXPIRES_IN = "15m"; // 15 menit untuk access token

// MobileCustomerAuthService.ts:108
generatePelangganAccessToken({...}, "7d"),
```

Komentar menyebut 15 menit, tapi pemanggilan eksplisit memberi `"7d"`. Default `JWT_EXPIRES_IN` tidak digunakan untuk login customer. Selain itu, **employee/mitra access token expiry 7d** (`mobile-auth.ts:87`: `setExpirationTime("7d")`).

Implikasi: window cury jika token bocor sangat lebar. Industry best practice: access token 5-15 menit, refresh token 7-30 hari.

**Fix proposal**: Turunkan access token expiry ke 15 menit (refresh akan handle UX) untuk semua role.

```typescript
// mobile-auth.ts
.setExpirationTime("15m")  // bukan 7d

// MobileCustomerAuthService.ts
generatePelangganAccessToken({...}, "15m"),  // bukan 7d
```

Catat: ini akan menambah load refresh — pastikan refresh single-flight kuat (lihat H-1).

---

### M-3. Dua sistem JWT paralel (jose vs jsonwebtoken) dengan audience yang berbeda — risiko kebocoran scope

**File**:
- `lib/jwt.ts` — uses `jsonwebtoken`, audience: `pelanggan-portal`, issuer: `netmanager`
- `lib/mobile-auth.ts` — uses `jose` (HS256, no audience/issuer set)

**Severity**: Medium

Customer login menggunakan `lib/jwt.ts` yang **memvalidasi audience** `pelanggan-portal` (line 137, 159). Tetapi `verifyMobileToken` di `mobile-auth.ts` menggunakan `jose` dan **TIDAK memvalidasi audience/issuer**:

```typescript
// mobile-auth.ts:212
const { payload } = await jwtVerify(token, getSecret());
// no `audience` / `issuer` option
```

Akibat:
- Token customer (audience `pelanggan-portal`) DAPAT di-verify oleh `verifyMobileToken` (employee path) selama `signature` valid karena keduanya pakai `NEXTAUTH_SECRET` yang sama
- Di line 273-306, kalau user lookup gagal → fallback ke pelanggan lookup → dianggap sah
- Tidak ada cross-domain leakage actual (karena fallback bener routing ke customer), tapi desain ini fragile. Jika di kemudian hari ada role baru yang share secret tapi audience berbeda (mis. internal-api), JWT bisa lintas-konteks.

**Fix proposal**: konsolidasi ke satu library + selalu validasi audience.

```typescript
// mobile-auth.ts
const { payload } = await jwtVerify(token, getSecret(), {
  issuer: "netmanager",
  audience: ["mobile-employee", "mobile-mitra", "pelanggan-portal"],
});
```

Saat sign:
```typescript
return await new SignJWT(jwtPayload)
  .setProtectedHeader({ alg: "HS256" })
  .setIssuer("netmanager")
  .setAudience(role === "CUSTOMER" ? "pelanggan-portal" : `mobile-${role.toLowerCase()}`)
  .setIssuedAt()
  .setExpirationTime("15m")
  .sign(getSecret());
```

---

### M-4. Plaintext password fallback pada `isCustomerPasswordValid` — silent compatibility hazard

**File**: `/Users/rohadimraja/Documents/radpro/netmanager/modules/users/services/MobileCustomerAuthService.ts:131-143`

```typescript
async function isCustomerPasswordValid(customer, password) {
  if (customer.passwordHash) {
    return compare(password, customer.passwordHash);
  }
  logger.warn(`[MobileAuth] WARNING: Customer ${customer.id} is using legacy plaintext password.`);
  return customer.password === password;  // plaintext comparison!
}
```

**Risk**: customer dengan `passwordHash IS NULL` tetap bisa login menggunakan password plaintext yang tersimpan di kolom `customer.password`. Jika DB bocor, password customer langsung exposed. Tidak ada deadline migrasi atau enforcement.

**Fix proposal**:
1. Migration script untuk hash semua password dengan bcrypt saat user login berhasil dengan plaintext
2. Tambah feature flag `LEGACY_PLAINTEXT_AUTH_ENABLED` (default false di production)
3. Log alert ke monitoring saat plaintext fallback dipakai

```typescript
async function isCustomerPasswordValid(customer, password) {
  if (customer.passwordHash) {
    return compare(password, customer.passwordHash);
  }

  if (process.env.LEGACY_PLAINTEXT_AUTH_ENABLED !== "true") {
    return false;  // refuse plaintext auth in production
  }

  if (customer.password === password) {
    // Auto-migrate: hash and persist
    const hash = await bcrypt.hash(password, 10);
    await prismaAuth.pelanggan.update({
      where: { id: customer.id },
      data: { passwordHash: hash, password: null },
    });
    return true;
  }
  return false;
}
```

---

### M-5. `network-aware` request rejection bocor saat NetInfo lambat update

**File**: `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/api.ts:82-86`

```typescript
if (!networkStateService.getIsConnected() && !config.url?.includes('localhost')) {
  return Promise.reject(new Error('No Internet connection'));
}
```

`networkStateService` cache state via `NetInfo.addEventListener`. Tetapi pada cold-start app, listener belum fire — `getIsConnected()` return default `false` (per NetInfoServiceImpl). Akibat: **request pertama setelah cold start sering ditolak dengan "No Internet connection"** padahal koneksi ada.

Selain itu, error yang dilempar bukan `AxiosError` — interceptor response tidak akan jalan, retry logic tidak akan jalan, dan error message tidak punya `config.url`.

**Fix proposal**:
```typescript
class NetworkStateServiceImpl {
  private isConnected: boolean | null = null;  // null = unknown

  getIsConnected(): boolean {
    return this.isConnected ?? true;  // optimistic default during boot
  }
}

// api.ts
if (networkStateService.getIsConnected() === false) {  // hanya reject jika EKSPLISIT false
  return Promise.reject(error);
}
```

---

### M-6. `setExpirationTime("7d")` dengan `setIssuedAt()` saja — tidak ada `nbf` claim

**File**: `lib/mobile-auth.ts:83-87`, `lib/jwt.ts:79-83`

Tidak ada `notBefore` claim. Bukan critical, tapi best practice untuk mitigasi clock skew dan replay window. Skip jika scope tidak demand.

---

## 4. Low Severity / Style Findings

### L-1. `signOut` tidak tunggu `syncFcmToken('remove')` selesai

`AuthContext.tsx:140`: `syncFcmToken('remove')` dipanggil tanpa `await`. Server-side bisa stale untuk beberapa detik. Acceptable trade-off (tidak boleh block logout), tapi bisa dilog kalau gagal.

### L-2. `RefreshTokenService.refreshAccessToken` swallow error pada non-401/403

`RefreshTokenService.ts:135-137`: error 5xx pada refresh endpoint hanya di-log "Token refresh failed", tetap return null → menyebabkan user di-logout padahal masalahnya server. Pertimbangkan retry untuk 5xx pada refresh.

### L-3. Akses token mengandung `accessAdminPanel: true` untuk superadmin — over-share di mobile

`mobile-auth.ts:362`: `accessAdminPanel: Boolean(dbUser.role?.accessAdminPanel)` di-include di token. Tidak diperlukan untuk mobile flow; jika token bocor, attacker tahu user adalah admin (bukan kebocoran credential, tapi info disclosure ringan).

### L-4. `STORED_PASSWORD_KEY` hardcoded di file modul, tidak pakai prefix tenant

`CredentialStorageService.ts:5`: jika app multi-tenant aktif suatu hari, satu device bisa bingung antara kredensial tenant A vs tenant B. Saat ini multi-tenant disabled (`TenantService.ts:5`), jadi tidak urgent.

---

## 5. Header `X-App-Version-Code` — Analisis Mendalam

### Apa fungsinya
- Mobile mengirim `X-App-Version-Code: <CURRENT_VERSION_CODE>` dan body field `versionCode` saat login
- Backend (`MobileAuthVersionService.buildUnsupportedVersionResponse`) cek vs `process.env.MOBILE_MIN_NATIVE_VERSION_CODE`
- Jika `versionCode < MIN` → response 426 dengan `code: APP_VERSION_UNSUPPORTED`
- Mobile interceptor (`api.ts:167-171`) emit `Events.APP_VERSION_UNSUPPORTED` → handle di app shell untuk show force update modal

### Issue #1: Trust source antara header vs payload tidak konsisten
- Login: parse dari **body** (`login/route.ts:13`)
- Authenticated request: parse dari **header** (`mobile-api-auth.ts:23`)
- Refresh: parse dari **header**, tapi juga dari `payload.appVersionCode` di JWT (`mobile-auth.ts:199-205`) — yang dapat di-spoof oleh client jika menyerahkan token dengan claim version palsu (signature valid karena dibuat oleh server pada login lama)

Implikasi: user yang login dengan v50, kemudian downgrade ke v50 setelah min naik ke v60, tetap bisa pakai access token sampai expire (header `X-App-Version-Code: 50` dipakai sebagai override jika diberikan client). Pada `mobile-api-auth.ts:51-54`, jika header diberikan, dipakai sebagai versionCodeOverride. Client jahat bisa **kirim header dengan versi palsu lebih tinggi** untuk bypass version gating.

**Fix proposal**: server jangan trust header version untuk version-gating; trust hanya `payload.appVersionCode` (yang di-sign saat login). Untuk customer, ada `lastVersionCode` di DB yang juga di-trust (`MobileCustomerAuthService.ts:223-243`). Pakai max(payload, lastVersionCode in DB).

```typescript
// mobile-api-auth.ts
export async function authenticateMobileRequest(request) {
  // ...
  // JANGAN trust header versionCode untuk gating
  const details = await getMobileTokenDetails(token);  // gunakan payload only
  // header version-code boleh dipakai untuk telemetry/UA, bukan gating
}
```

### Issue #2: 426 response triggers force-update modal HANYA via DeviceEventEmitter
`api.ts:167-171` emit `Events.APP_VERSION_UNSUPPORTED`. Tapi:
- Listener-nya hidup di mana? Cari `APP_VERSION_UNSUPPORTED` di mobile codebase

---

## 6. Verifikasi Tambahan

| Hal | Status |
|-----|--------|
| Logout endpoint `/api/mobile/auth/logout` | ❌ Tidak ada |
| FCM unregister saat logout | ⚠️ Best-effort, tidak tunggu |
| Refresh single-flight | ✅ Ada (RefreshTokenService) tapi lemah di interceptor |
| Token tersimpan di SecureStore native | ✅ |
| Password tersimpan plaintext untuk biometric | ❌ CRITICAL |
| Token version check di refresh | ✅ Customer; ❌ Employee/Mitra |
| Audience/issuer JWT validation | ✅ Customer; ❌ Employee/Mitra |
| RBAC tenant isolation | ✅ via `tenantId` di payload |
| Multi-tenant support active | ❌ Disabled (TenantService no-op) |

---

## 7. Prioritas Rekomendasi

### Sprint 1 (Wajib)
1. **C-1**: Tambah endpoint `/api/mobile/auth/logout` + increment tokenVersion
2. **C-2**: Refactor biometric storage — tidak simpan password plaintext
3. **H-1**: Throttle/debounce `AUTH_UNAUTHORIZED` emit
4. **H-2**: Konsisten gunakan `SecureStorage` wrapper
5. **H-3**: Set `skipRetry: true` di login call

### Sprint 2 (Penting)
6. **H-4**: Trust `payload.role` untuk routing query, hindari fallback chain
7. **H-5**: Tambah `tokenVersion` ke schema Mitra
8. **M-2**: Turunkan access token expiry ke 15 menit
9. **M-3**: Validasi audience JWT konsisten
10. **M-4**: Disable plaintext password fallback di production

### Sprint 3 (Nice-to-have)
11. **M-5**: Optimistic NetworkState default
12. **M-1**: Clear credentials di semua 401 path
13. Sisanya (L-*): cleanup style/defense-in-depth
