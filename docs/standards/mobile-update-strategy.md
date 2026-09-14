# Mobile Update Strategy

Project ini punya dua channel update yang jalan bersamaan:

## OTA Channel (Expo Updates)

**Untuk:** Perubahan JS/TS-only — bug fix UI, copy text, validasi, logic.

**Cara kerja:** `runtimeVersion.policy = "fingerprint"` — Expo CLI generate hash dari native files setiap build. OTA bundle hanya ter-deliver ke APK dengan fingerprint sama.

**Trigger:**
- Edit kode JS/TS → `git push` → Jenkins jalankan `eas update --branch <env>`
- Mobile auto-detect saat AppState 'active', download silent, reload

## APK Channel (Native Release)

**Untuk:** Perubahan native — install package native, ubah plugin, update Expo SDK, ubah Android permission.

**Cara kerja:**
- Build APK baru dengan version + versionCode bump
- Admin upload APK ke storage, create record `AppRelease` di backend (`/admin/app-releases`)
- Mobile poll `/api/mobile/app-version/check` saat app start dan AppState 'active'
- Tampilkan modal update jika ada APK baru, dengan tombol Download dan Hubungi Admin

**Force update:**
- Set `isForceUpdate=true` di AppRelease → user di-block (lock screen) sampai install
- Atau set `minSupportedVersion` → semua user di bawah minimum di-force

## Aturan Praktis

**OTA aman:**
- Edit `app/`, `src/`, `components/`, `hooks/`, `utils/`, `services/` (file .ts/.tsx/.js)
- Bump `version` di `app.json` (tidak mempengaruhi fingerprint)
- Style/copy text changes

**APK wajib rebuild:**
- Install/update/hapus package native (yang punya `expo-modules-core` plugin)
- Edit `app.json` field native (plugins, android, ios sections)
- Edit `app.config.ts` field native
- Edit `plugins/*.js`
- Update Expo SDK
- Tambah Android permission

## Syarat Target API Google Play

Sejak **31 Agustus 2026**, setiap update aplikasi wajib target **Android 16
(API 36)**. Aplikasi yang sudah tayang cukup target >= 35 untuk tetap
ditemukan, jadi yang terblokir hanya unggahan baru.

Penolakannya terjadi saat **submit**, bukan saat build:

```
Google Api Error: Invalid request - Target SDK of artifact is too low
```

Artinya satu siklus build EAS (20-40 menit) terbuang sebelum kesalahannya
terlihat. Nilainya dipatok di `app.json` lewat `expo-build-properties` dan
dijaga oleh `__tests__/app/play-store-target-sdk.test.ts` — jalankan tes mobile
sebelum build kalau versi SDK baru saja disentuh.

`minSdkVersion` tidak ikut naik: menaikkannya memutus perangkat lama teknisi
dan Google tidak memintanya.

## Cara Verifikasi Sebelum Keputusan

`runtimeVersion.policy` bernilai `fingerprint`, jadi perangkat hanya menerima
OTA yang runtime-nya sama persis dengan APK terpasang.

```bash
cd mobile-netmanager
npx @expo/fingerprint fingerprint:generate > /tmp/fp-now.json
```

Perintah yang benar adalah `@expo/fingerprint` dengan subcommand
`fingerprint:generate` / `fingerprint:diff`. Paket `expo-fingerprint` tidak ada
di npm, dan `fingerprint:diff` menerima **dua berkas JSON**, bukan dua commit.

**Cara paling andal** bukan membandingkan dua hash, melainkan memeriksa apakah
berkas yang diubah termasuk bahan fingerprint:

```bash
npx @expo/fingerprint fingerprint:generate \
  | python3 -c "import json,sys; [print(s.get('type'), s.get('filePath') or s.get('id')) for s in json.load(sys.stdin)['sources']]"
```

- Berkas yang diubah **tidak** muncul di daftar → OTA cukup
- Muncul di daftar (mis. `app.json`/`expoConfig`, berkas di `plugins/`,
  dependensi native) → runtime berubah → **APK rebuild wajib**

> Menghitung fingerprint commit lama di direktori sementara menghasilkan diff
> palsu: jalur relatif `node_modules` ikut di-hash, sehingga ratusan sumber
> terlihat "berubah" padahal tidak. Bandingkan di direktori yang sama, atau
> pakai pemeriksaan daftar sumber di atas.

Aset native tidak pernah bisa lewat OTA. Berkas di `res/raw`, perubahan
`AndroidManifest.xml`, dan config plugin selalu menuntut build baru — bundle JS
tidak membawanya.

## Force Update Behavior

Saat `isForceUpdate=true`:
- App lock screen — tidak bisa logout, tidak bisa navigate
- 3 action: Download APK / Hubungi Admin / Cek Ulang
- "Cek Ulang" re-trigger version check; kalau version sudah match (user balik dari install), unblock

## Tenant Settings

`appUpdateContactUrl` + `appUpdateContactLabel` di tenant settings menentukan tombol "Hubungi Admin". Set `null` untuk hide tombol. Manage di `/admin/pengaturan/app-update` (atau path equivalent di admin).

## Admin Workflow

1. Build APK baru via Jenkins/EAS Build
2. Upload APK ke storage (S3/Cloudinary/dll)
3. Login admin → `/admin/app-releases` → klik "Tambah Release"
4. Isi form:
   - Platform: android (atau ios)
   - Version: semver baru (1.0.9)
   - VersionCode: integer increment (9)
   - Download URL: URL ke APK file
   - Release Notes: catatan untuk user
   - isForceUpdate: centang jika critical
   - Min Supported Version: optional, untuk force user di bawah versi tertentu
5. Save → user existing akan dapat notifikasi pada app start berikutnya

## Troubleshooting

**OTA tidak nyambung setelah edit kode JS:**
- Cek `runtimeVersion.policy` di `app.json` — harus `"fingerprint"`
- Cek hasil `npx expo-fingerprint diff <last-apk> HEAD` — kalau non-empty, ada perubahan native tersembunyi
- Cek `eas update` output — pastikan branch dan platform benar

**User tidak dapat notifikasi APK update:**
- Pastikan `AppRelease` record di-create dengan `isActive=true`
- Pastikan platform match (android user dapat android record)
- Pastikan `currentVersion < latestVersion` (semver comparison)
- Cek log API `/api/mobile/app-version/check` di backend

**Tombol Hubungi Admin tidak muncul:**
- Set `appUpdateContactUrl` di tenant settings (`/admin/pengaturan/app-update`)
- Restart app untuk re-fetch tenant settings
