# Dual Update Channel: OTA + APK Notification

**Tanggal**: 2026-05-17
**Author**: agent
**Status**: Draft → User Review

## Konteks

Project ini punya dua repo:
- `netmanager` (backend Next.js)
- `mobile-netmanager` (React Native + Expo)

Saat ini mobile pakai `runtimeVersion.policy = "appVersion"`. Akibatnya setiap bump `version` di `app.json` (misal 1.0.7 → 1.0.8) akan **mismatch dengan APK lama** sehingga OTA bundle tidak terkirim. User di APK 1.0.7 tidak akan menerima fix apapun yang di-publish via OTA 1.0.8.

User juga belum punya mekanisme notifikasi APK update — saat ada APK baru, user tidak tahu dan tetap pakai versi lama tanpa awareness.

## Tujuan

1. **OTA tetap jalan** untuk perubahan JS/TS-only (bug fix UI, copy text, validasi, logic).
2. **Notifikasi APK update** saat ada perubahan native yang butuh APK baru — user diberitahu via modal in-app dengan opsi:
   - Download APK langsung dari URL
   - Hubungi admin via WhatsApp/email
3. **Force update support** — admin bisa set per-rilis: critical (block app) vs soft (skippable modal).
4. **Otomatis** — developer tidak perlu inget aturan manual; Expo fingerprint policy yang putuskan OTA delivery.

## Non-Tujuan

- Tidak handle Play Store / App Store In-App Update SDK (rencana future, design dibuat agar mudah di-extend).
- Tidak auto-install APK (di Android perlu permission khusus, di iOS tidak mungkin tanpa App Store).
- Tidak handle iOS dulu (project ini Android-first; struktur DB sudah support multi-platform).

## Arsitektur Tinggi

Dua channel update terpisah:

```
┌────────────────────────┐         ┌──────────────────────────────┐
│   Mobile App (Client)  │         │  Backend (netmanager)        │
│                        │         │                              │
│ useApkVersionCheck ────┼────────►│ /api/mobile/app-version/check│
│   (APK release)        │         │ → modules/app-version        │
│                        │         │                              │
│ useOtaUpdate ──────────┼────────►│ /api/mobile/app-update/      │
│   (Expo OTA bundle)    │         │   manifest                   │
│                        │         │ → modules/app-update         │
└────────────────────────┘         └──────────────────────────────┘
```

- **`app-update` (existing)**: serve Expo OTA manifest. Tidak diubah.
- **`app-version` (baru)**: track APK release metadata, expose endpoint check, admin UI untuk manage.

## runtimeVersion Strategy: Fingerprint Policy

Ganti `app.json`:

```json
"runtimeVersion": { "policy": "fingerprint" }
```

Expo CLI generate hash dari native files (`package.json` deps native, `app.json`, `app.config.ts`, `plugins/`, `android/`, `ios/`). Hash ini ter-embed di APK saat build dan jadi runtime identifier.

**Konsekuensi:**
- Edit JS/TS saja → fingerprint sama → OTA terkirim ke APK lama
- Edit native (plugin, native dep, app.config.ts native fields) → fingerprint berbeda → OTA tidak terkirim ke APK lama (otomatis dilindungi dari mismatch crash)

**Verifikasi sebelum keputusan OTA-vs-APK:**

```bash
npx expo-fingerprint diff <last-apk-commit> HEAD
```

Diff empty → OTA cukup. Diff non-empty → APK rebuild wajib.

## Backend: Module `app-version`

### Database Schema

Migration baru `add_app_releases`:

```prisma
model AppRelease {
  id                  String   @id @default(cuid())
  platform            String   // "android" | "ios"
  version             String   // "1.0.8" (semver)
  versionCode         Int      // 8 (Android) / buildNumber (iOS)
  isForceUpdate       Boolean  @default(false)
  minSupportedVersion String?  // semver, di bawah ini = force
  downloadUrl         String   // URL APK / Play Store / TestFlight
  releaseNotes        String?  @db.Text
  isActive            Boolean  @default(true)
  releasedAt          DateTime @default(now())

  // Future-proofing untuk multi-arch & device targeting
  architecture        String?  // "arm64-v8a" | "armeabi-v7a" | "universal" | null
  minOsVersion        String?  // misal "8.0" untuk Android 8+, "13.0" untuk iOS 13+
  rolloutPercentage   Int      @default(100) // 0-100 untuk phased rollout (future)
  apkSizeBytes        Int?     // info ukuran APK untuk UI

  tenantId            String?
  createdBy           String?  // user id admin yang upload
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([platform, isActive, releasedAt])
  @@index([platform, architecture, isActive])
  @@index([tenantId])
}
```

`contactAdminUrl` **TIDAK** disimpan di `AppRelease` — dipindah ke tenant settings (lihat section di bawah).

### Tenant Settings: Contact Admin

Tambah field di module `settings` (existing) atau tenant config:

```prisma
model TenantSettings {
  // ... existing fields
  appUpdateContactUrl     String?  // contoh: "https://wa.me/628123456789" atau "mailto:admin@radpro.id"
  appUpdateContactLabel   String?  // contoh: "Hubungi Admin via WhatsApp"
}
```

Reasoning:
- Per-tenant value memungkinkan tiap tenant punya kontak admin sendiri
- Tidak duplikasi data per release
- Admin set sekali di settings, semua release pakai value sama
- Kalau null → tombol "Hubungi Admin" hidden di mobile

Endpoint mobile `/api/mobile/app-version/check` response juga sertakan `contactAdminUrl` dari tenant settings user yang login.

### Module Structure

```
modules/app-version/
├── domain/
│   ├── entities/AppReleaseEntity.ts
│   └── ports/IAppReleaseRepository.ts
├── dto/
│   └── AppReleaseDto.ts
├── repositories/
│   └── AppReleaseRepository.ts
├── services/
│   ├── AppReleaseQueryService.ts        // get latest, list
│   ├── AppReleaseMutationService.ts     // create, update, deactivate
│   └── AppVersionCheckService.ts        // logic check update available + force
├── validators/
│   └── app-release.ts                   // zod schema
└── index.ts
```

### Endpoint Mobile

`GET /api/mobile/app-version/check?platform=android&currentVersion=1.0.7&currentVersionCode=7`

Authentication: mobile JWT (sama seperti endpoint mobile lain).

**Logic `AppVersionCheckService.check`:**

1. Query latest active `AppRelease` untuk platform + tenantId user.
2. Compare `currentVersion` vs `latestVersion` pakai semver.
3. Tentukan `isForceUpdate`:
   - `true` jika `currentVersion < latestRelease.minSupportedVersion`
   - `true` jika `latestRelease.isForceUpdate === true` dan `currentVersion < latestRelease.version`
   - `false` jika `currentVersion >= latestRelease.version` (no update needed)
4. Response:

```ts
{
  updateAvailable: boolean,
  isForceUpdate: boolean,
  currentVersion: "1.0.7",
  latestVersion: {
    version: "1.0.9",
    versionCode: 9,
    releaseNotes: "...",
    downloadUrl: "https://...",
    apkSizeBytes: 45234567,
    releasedAt: "2026-05-17T..."
  } | null,
  contactAdmin: {
    url: "https://wa.me/628123456789",
    label: "Hubungi Admin via WhatsApp"
  } | null  // dari tenant settings
}
```

### Endpoint Admin

- `GET /api/admin/app-releases` — list semua release per platform, paginated
- `POST /api/admin/app-releases` — create release baru
- `GET /api/admin/app-releases/[id]` — detail
- `PATCH /api/admin/app-releases/[id]` — update (toggle isActive, edit metadata)
- `DELETE /api/admin/app-releases/[id]` — soft delete (set isActive=false)

RBAC: permission `app-release:manage` untuk admin yang boleh kelola release.

### Admin UI

`app/admin/app-releases/`:
- `page.tsx` — list table dengan filter platform, sort by releasedAt
- `[id]/page.tsx` — detail + edit form
- Form fields: platform, version, versionCode, downloadUrl, contactAdminUrl, releaseNotes, isForceUpdate, minSupportedVersion, isActive

## Mobile: Hooks dan UI

### Hook Baru: `useApkVersionCheck`

`src/hooks/useApkVersionCheck.ts`:

```ts
export interface ApkUpdateState {
  isChecking: boolean
  apkUpdateAvailable: boolean
  isForceUpdate: boolean
  latestRelease: AppReleaseInfo | null
  error: string | null
  checkApkVersion: () => Promise<void>
  ignoreApkUpdate: () => void
}

export interface AppReleaseInfo {
  version: string
  versionCode: number
  releaseNotes: string | null
  downloadUrl: string
  contactAdminUrl: string | null
  releasedAt: string
}

export function useApkVersionCheck(): ApkUpdateState {
  // 1. Read currentVersion dari Application.nativeApplicationVersion
  // 2. Read currentVersionCode dari Application.nativeBuildVersion
  // 3. Call /api/mobile/app-version/check
  // 4. Return state
  // 5. Auto-recheck saat AppState 'active'
}
```

### Service Wrapper

`src/services/apkVersionService.ts`:

```ts
export async function checkApkVersion(params: {
  platform: 'android' | 'ios'
  currentVersion: string
  currentVersionCode: number
}): Promise<ApkVersionCheckResponse> {
  const response = await api.get('/api/mobile/app-version/check', {
    params,
    skipErrorToast: true, // graceful degradation
  })
  return response.data
}
```

### Orchestrator: `useVersionCheck`

Refactor `src/hooks/useVersionCheck.ts` untuk koordinasi keduanya:

```ts
export function useVersionCheck(user, token) {
  const apkCheck = useApkVersionCheck()
  const otaCheck = useAppVersion()

  // Priority: APK update force > OTA > APK update soft
  // - Kalau APK force update: tampilkan UpdateRequiredScreen (block app)
  // - Kalau tidak force tapi APK update available: tampilkan UpdateAvailableModal (skippable),
  //   tetap jalankan OTA di background sebagai bonus
  // - Kalau no APK update: jalankan OTA flow normal

  return {
    // APK fields
    apkUpdateAvailable: apkCheck.apkUpdateAvailable,
    isApkForceUpdate: apkCheck.isForceUpdate,
    latestApkRelease: apkCheck.latestRelease,
    onIgnoreApk: apkCheck.ignoreApkUpdate,

    // OTA fields (existing)
    otaUpdateAvailable: otaCheck.updateAvailable,
    isOtaForceUpdate: otaCheck.isForceUpdate,
    latestOtaVersion: otaCheck.latestVersion,
    otaDownloadStatus: otaCheck.downloadStatus,
    onStartOtaUpdate: otaCheck.startUpdate,
    // ...
  }
}
```

### UI: Extend Komponen Existing

**`UpdateAvailableModal.tsx`** (soft modal):
- Tampilkan version, releaseNotes
- Tombol primary: "Download APK Sekarang" → `Linking.openURL(downloadUrl)`
- Tombol secondary: "Hubungi Admin" → `Linking.openURL(contactAdminUrl)` (hidden kalau null)
- Tombol tertiary: "Nanti" → close modal, set ignoreApkUpdate=true (re-trigger di app start berikutnya)

**`UpdateRequiredScreen.tsx`** (force, full screen):
- Sama seperti modal tapi tanpa tombol "Nanti"
- Background overlay block semua interaksi app
- Reload check button untuk verify install setelah user balik dari browser/Play Store

### Behavior

- Auto-check saat app start dan saat AppState 'active' (resume)
- Cache hasil check selama 5 menit di memory (mengurangi API call saat user buka-tutup app dalam interval pendek). Cache di-invalidate saat user logout atau force re-check
- Graceful degradation: kalau API check gagal (offline, server down), tidak block app — anggap no update available. Kalau cache masih ada, pakai cache
- Idempotency: tracking `ignoreApkUpdate` per-version di AsyncStorage, supaya saat ada release baru muncul lagi tapi user tidak di-spam dengan version yang sudah pernah di-skip
- **Force update lock**: saat `isForceUpdate=true`, app dalam mode "lock screen" — TIDAK BISA logout, TIDAK BISA navigate ke screen lain, hanya bisa:
  - Klik "Download APK" → buka browser/Play Store
  - Klik "Hubungi Admin" → buka WhatsApp/email
  - Klik "Cek Ulang" → re-trigger check (untuk verify install setelah balik dari browser; kalau sudah update, screen auto-dismiss)

## Migration Plan

Single PR yang cover semua phase (atomic deploy):

1. **Backend infrastructure**:
   - Schema migration `add_app_releases` + extend `TenantSettings`
   - Module `app-version` lengkap (domain, repository, service, validators, index)
   - Endpoint mobile + admin
   - Admin UI

2. **Mobile dual-check**:
   - `useApkVersionCheck` hook
   - `apkVersionService` API wrapper
   - Orchestrator `useVersionCheck` update
   - Extend `UpdateAvailableModal` & `UpdateRequiredScreen` dengan tombol Hubungi Admin
   - Switch `runtimeVersion` ke fingerprint policy
   - Bump APK build untuk include perubahan ini

3. **Documentation**:
   - `docs/standards/mobile-update-strategy.md` — guide internal
   - Update `CLAUDE.md` dengan aturan OTA-vs-APK
   - `docs/CHANGELOG.md` entries

**Deploy order:**
1. Deploy backend dulu (endpoint sudah ready, return null/empty kalau belum ada release record)
2. Build & distribute APK baru dengan mobile dual-check
3. Admin create AppRelease record pertama untuk trigger notifikasi ke user existing
4. Verifikasi flow end-to-end

## Testing Strategy

**Backend:**
- Unit test `AppVersionCheckService.check` cover scenarios:
  - currentVersion === latestVersion → no update
  - currentVersion < latestVersion (soft) → updateAvailable=true, isForceUpdate=false
  - currentVersion < minSupportedVersion → isForceUpdate=true
  - currentVersion < latestVersion + latestRelease.isForceUpdate=true → isForceUpdate=true
  - latestVersion null (no active release) → no update
- Integration test endpoint dengan real DB

**Mobile:**
- Unit test `useApkVersionCheck` reducer logic
- Mock `apkVersionService` untuk test orchestrator priority

## Acceptance Criteria

1. APK 1.0.7 yang sekarang ada di field bisa terima notifikasi APK 1.0.8 (saat admin create AppRelease record).
2. User klik "Download" → browser buka URL APK / Play Store.
3. User klik "Hubungi Admin" → WhatsApp/email aplikasi terbuka.
4. Force update memblok app sampai user install APK baru (return ke app + version match → unblock).
5. OTA tetap jalan untuk JS-only changes pada APK dengan fingerprint sama.
6. Saat ada perubahan native, OTA tidak ter-deliver ke APK lama (dilindungi otomatis oleh fingerprint policy).

## Future Extensions

- **Play Store In-App Update SDK** — tambahkan ke flow saat app sudah listing di Play Store. Backend response bisa include flag `useInAppUpdate=true` untuk trigger native flow alih-alih buka URL.
- **iOS support** — schema sudah multi-platform, tinggal tambah build pipeline iOS.
- **Telemetry** — track berapa user yang skip soft update, untuk analytics adoption rate.
- **Phased rollout** — admin bisa set `rolloutPercentage` 0-100 untuk gradual delivery.

## Files yang Disentuh

**Backend (netmanager):**
- `prisma/schema.prisma` (model `AppRelease` + extend `TenantSettings` 2 field)
- `prisma/migrations/<timestamp>_add_app_releases/migration.sql`
- `modules/app-version/` (module baru lengkap)
- `modules/settings/` (extend untuk field contactAdmin — service + validator)
- `app/api/mobile/app-version/check/route.ts`
- `app/api/admin/app-releases/route.ts`
- `app/api/admin/app-releases/[id]/route.ts`
- `app/admin/app-releases/page.tsx`
- `app/admin/app-releases/[id]/page.tsx`
- (Optional) `app/admin/settings/` — tambah UI untuk set contactAdminUrl di tenant settings page existing

**Mobile (mobile-netmanager):**
- `app.json` (runtimeVersion → fingerprint)
- `src/hooks/useApkVersionCheck.ts` (baru)
- `src/hooks/useVersionCheck.ts` (orchestrator)
- `src/services/apkVersionService.ts` (baru)
- `src/components/molecules/UpdateAvailableModal.tsx`
- `src/components/templates/UpdateRequiredScreen.tsx`

**Docs:**
- `docs/standards/mobile-update-strategy.md` (baru)
- `docs/CHANGELOG.md`
- `CLAUDE.md` (root, optional note)
