# Firebase Multi-Environment Setup — Recommendation

**Status:** Saat ini Firebase config (project ID, API key, dst) shared antar 3 environment di `eas.json`. Walaupun Firebase web API key publik secara desain (Bukan secret), shared single project antar env menyatukan blast-radius — abuse di staging RTDB akan kena prod database.

## Goal

Pisahkan Firebase project per env: `netmanager-dev`, `netmanager-staging`, `netmanager-prod`. Pindah config ke EAS secrets agar mudah rotate tanpa rebuild app.

## Steps

### 1. Buat 3 Firebase project

Console Firebase → Add Project → buat 3 project terpisah:
- `netmanager-dev` (untuk EAS dev build)
- `netmanager-staging` (untuk EAS preview build)
- `netmanager-prod` (untuk EAS production build)

Untuk setiap project:
- Enable Auth (Anonymous + Custom Token)
- Enable Firestore + deploy `firestore.rules`
- Enable Realtime DB
- Enable Cloud Messaging (FCM)
- Generate `google-services.json` (Android) + `GoogleService-Info.plist` (iOS)
- Generate Web app config untuk dapat API_KEY/AUTH_DOMAIN/dst

### 2. Pindah ke EAS secrets

```bash
# Untuk setiap env (development/preview/production), set Firebase config sebagai secret:
eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value AIza... --environment development
eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value netmanager-dev --environment development
# ... ulangi untuk semua key Firebase, semua env
```

Atau lewat Expo dashboard: https://expo.dev/accounts/<account>/projects/<project>/environment-variables

### 3. Update eas.json

Hapus block `env` yang berisi Firebase config — `eas build` otomatis pull dari env vars yang di-set di EAS dashboard untuk env tersebut.

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_APP_VARIANT": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_APP_VARIANT": "staging"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "gradleCommand": ":app:bundleRelease",
        "credentialsSource": "remote"
      },
      "env": {
        "EXPO_PUBLIC_APP_VARIANT": "production"
      }
    }
  }
}
```

### 4. Update GoogleService-Info.plist + google-services.json per build

Files ini pakai project ID — masing-masing env butuh file berbeda. Strategi:
- Commit file untuk `dev` ke repo (default).
- `eas-build-pre-install` hook download config staging/prod dari secret atau S3 bucket sebelum native build.
- Atau pakai `expo-build-properties` + multiple flavor (advanced).

### 5. Verifikasi blast radius

Setelah split:
- Staging RTDB abuse → prod tidak terganggu.
- Demosi role admin di prod (custom claims) tidak nyentuh dev/staging.
- FCM token user prod tidak shared dengan dev test build.

## Catatan Sentry

Sentry punya pattern serupa — DSN per env via `EXPO_PUBLIC_SENTRY_DSN` di EAS secrets, bukan committed di eas.json. Sudah disiapkan di Sprint 4 (`H9-sentry-setup-guide.md`).

## Risk skipping fix ini

- Low-Medium severity, tergantung volume tenant. Kalau staging Firestore tertulis sampah saat testing fitur, prod dashboard juga lihat.
- Tidak ada vector data leak baru — Firebase rules sudah enforce auth (lihat `firestore.rules` Sprint 1).
- Tetapi monitor blast-radius akan susah — mis. quota multicast FCM habis di staging → prod gagal kirim.

## Estimasi

Setup awal: 1-2 hari (3 Firebase project + EAS secrets + test build per env). Verifikasi: 0.5 hari.
