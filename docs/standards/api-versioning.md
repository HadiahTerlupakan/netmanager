# API Versioning Strategy — Mobile Endpoints

**Status:** Saat ini semua endpoint mobile di `/api/mobile/*` tanpa versioning prefix. Saat schema/contract berubah breaking, satu-satunya mekanisme adalah min-version-code yang force-update — tidak ada migrasi bertahap.

## Policy

### 1. Additive changes (default)

Semua perubahan di `/api/mobile/*` HARUS additive (tambah field optional, response field baru tidak break old client):
- ✅ Tambah field optional di response → old client abaikan
- ✅ Tambah endpoint baru `/api/mobile/foo` → old client tidak panggil
- ✅ Tambah header optional → old client tidak kirim, default behavior tetap
- ❌ Hapus field di response → break old client
- ❌ Ganti tipe field (`string` → `number`) → break old client
- ❌ Ganti makna enum (`status: "ACTIVE"` → `status: "ENABLED"`) → break old client
- ❌ Tambah field required di request → break old client

### 2. Breaking changes — strategi v2

Bila breaking change wajib (mis. refactor data model), buat versi baru paralel:

```
/api/mobile/work-orders        → v1, freeze, deprecate
/api/mobile/v2/work-orders     → v2, struktur baru
```

**Server compat window:** v1 minimum 6 bulan setelah v2 release atau sampai 95% user upgrade.

**Mobile sisi:** detect via `X-App-Version-Code` header — server route ke v1 atau v2 berdasarkan version. Atau lebih sederhana, mobile yang panggil v2 endpoint kalau version lebih baru dari threshold.

### 3. Force-update fallback

Untuk perubahan yang **tidak bisa** di-versioning (mis. security patch wajib), set `MOBILE_MIN_NATIVE_VERSION_CODE` di backend. Mobile yang versionCode di bawah threshold dapat 426 → force update modal.

Catatan: ini mahal dari sisi UX — user harus update sebelum bisa pakai app. Hindari kecuali truly mandatory.

## Naming convention

- Path: `/api/mobile/v{N}/{resource}` untuk versioned endpoint
- Header `X-App-Version-Code`: dipakai backend untuk routing, bukan untuk gating (server selalu trust signed JWT claim, lihat Sprint 2 H17)
- Response header `X-API-Deprecated: <date>` untuk endpoint yang akan retire

## Saat menambah endpoint baru

1. **Default**: tambah ke `/api/mobile/<resource>` tanpa versioning prefix
2. **Bila breaking**: bikin `/api/mobile/v2/<resource>`, freeze yang lama
3. Update `docs/api/mobile.md` (kalau ada) — atau tetap pakai inline doc di route

## Saat retire endpoint

1. Tambah header `X-API-Deprecated: 2027-01-01` selama 3 bulan
2. Tambah log warn di handler bila ada caller
3. Setelah deadline, return 410 Gone dengan link ke v2

## Ketika tidak butuh v2

- Bug fix → fix in-place
- Optimasi performance → in-place
- Tambah field response → in-place
- Tambah field request optional → in-place
- Tambah validation lebih strict → tetap in-place tapi log warn dulu sebelum tegakkan

## Estimasi cost

V2 path = double maintenance window. Hindari bikin v2 untuk perubahan minor. Kalau memang harus, gunakan helper untuk share business logic antar versi (controller per-version, service shared).
