# QA Aplikasi Mobile — Matriks Role & Kasus Autentikasi

- **Tanggal**: 2026-10-06
- **Pelaksana**: agent
- **Lingkungan**: lokal — backend `netmanager` (dev server :3000, Postgres+Redis via Docker),
  mobile `mobile-netmanager` v1.0.9 (Build 1) di emulator Android Pixel_7 (Android 13),
  varian `development`, backend diakses lewat `http://10.0.2.2:3000`
- **Akun uji**: 5 akun seed, satu per role

---

## Ringkasan

| Kategori | Jumlah |
|---|---|
| Temuan keamanan | 2 (keduanya terbukti dieksploitasi) |
| Cacat fungsional | 3 |
| Benar secara desain (diverifikasi, bukan bug) | 3 |
| Keterbatasan emulator (bukan cacat produk) | 2 |

Dua temuan keamanan saling menguatkan dan sebaiknya ditangani bersama.

---

## A. Temuan keamanan

### A1. Rate limit login bisa dilewati lewat header `X-Forwarded-For`

**Tingkat**: Tinggi
**Berkas**: `lib/rate-limit.ts:42-59`, `app/api/mobile/auth/login/route.ts:41`

`getClientIP()` mengambil IP dari header `x-forwarded-for` yang **dikirim klien**, lalu
dipakai sebagai satu-satunya kunci rate limit. Klien bisa mengarang nilainya sehingga
setiap request mendapat jatah baru.

Bukti — setelah kuota habis (429), cukup variasikan header untuk lolos:

```
XFF=203.0.113.1   HTTP 403   (bukan 429)
XFF=203.0.113.2   HTTP 403
XFF=203.0.113.3   HTTP 403
```

Dampak: brute-force password tanpa batas efektif.

**Saran**: percayai `x-forwarded-for` hanya dari proxy tepercaya (ambil hop ke-N dari
kanan sesuai jumlah proxy di depan, bukan elemen pertama), dan tolak nilai dari sumber
tak dikenal.

### A2. Pesan login membocorkan keberadaan akun (user enumeration)

**Tingkat**: Sedang
**Berkas**: `app/api/mobile/auth/login/route.ts`

Pesan error membedakan akun yang ada dan tidak:

```
akun ada   : {"error":"Password salah","code":"UNAUTHORIZED"}
akun tiada : {"error":"Email/ID tidak ditemukan","code":"UNAUTHORIZED"}
```

Penyerang bisa memetakan email/ID pelanggan yang valid. Digabung dengan A1, rantainya
menjadi: enumerasi akun tanpa batas → brute-force tanpa batas.

**Saran**: satukan menjadi satu pesan netral (mis. "Email/ID atau password salah") dan
samakan waktu respons.

---

## B. Cacat fungsional

### B1. Seed menggandakan role setiap kali dijalankan

**Tingkat**: Tinggi
**Berkas**: `prisma/seed.ts` (upsert role ADMIN, TEKNISI, SALES, FINANCE)

`where` memakai `{ name, tenantId: MAIN_TENANT_ID }`, tetapi blok `create` tidak menyetel
`tenantId` sehingga baris hasil ber-`tenantId = NULL`. Pencarian berikutnya tak pernah
cocok → baris baru dibuat lagi. `SUPER_ADMIN` selamat karena `create`-nya menyetel
`tenantId`.

Bukti: 5 role → **13 role** setelah dua kali seed (ADMIN/FINANCE/SALES/TEKNISI masing-masing
+2, SUPER_ADMIN +0). Duplikat sudah dibersihkan kembali ke 5.

**Catatan penting sebelum memperbaiki**: `Role` termasuk `GLOBAL_REFERENCE_MODELS`
(`lib/prisma-extension.ts:52`) dan dibaca dengan `OR: [{tenantId}, {tenantId: null}]` —
artinya `tenantId NULL` **disengaja** sebagai role global lintas tenant. Jadi perbaikannya
bergantung pada niat:

- Role dasar dimaksudkan **global** → perbaiki `where` agar menyasar `tenantId: null`
- Role dasar dimaksudkan milik **MAIN_TENANT** → tambahkan `tenantId` ke `create`
  (mengikuti pola SUPER_ADMIN), **dan** siapkan migration backfill untuk baris lama

Perbaikan belum diterapkan karena menentukan arah ini adalah keputusan arsitektur.

### B2. Seed gagal di database yang punya baris warisan (`ProfilePPP`)

**Tingkat**: Sedang
**Berkas**: `prisma/seed.ts:1159`, `prisma/schema.prisma` (model `ProfilePPP`)

```
Unique constraint failed on the constraint: `ProfilePPP_name_key`
```

`ProfilePPP` punya dua constraint unik yang bertabrakan:

```prisma
name String @unique                 // global, lintas tenant
@@unique([name, tenantId], ...)     // per tenant
```

Seed meng-upsert lewat `name_tenantId`; bila baris lama ber-`tenantId NULL`, pencarian
meleset lalu jalur `create` menabrak unique global `name`.

Konsekuensi lebih luas: unique global pada `name` membuat constraint komposit mubazir dan
**memblokir dua tenant memakai nama profil yang sama** — bertentangan dengan isolasi
multi-tenant.

**Saran**: hapus `@unique` pada `name` (lewat migration) sehingga keunikan ditegakkan
per tenant saja.

### B3. Izin `m_canvasing` tidak bisa dijangkau sama sekali oleh persona STAFF

**Tingkat**: Sedang
**Berkas**: `src/utils/tabKaryawanStaff.ts:10`,
`src/components/screens/KaryawanStaffDashboardScreen.tsx:23`
**Bukti**: user `sales@example.com` (role SALES)

API mengirim izinnya dengan benar — `features: ['m_canvasing', 'm_dashboard']`. Gerbang UI
pun memang berbasis izin (`punyaFitur` membaca `user.features`), bukan persona. Masalahnya
ada di dua daftar rute yang di-hardcode untuk persona STAFF, dan `canvasing` tidak ada di
keduanya:

```ts
// src/utils/tabKaryawanStaff.ts:10
RUTE_TAB_KARYAWAN_STAFF = ['dashboard', 'absensi', 'chat/index', 'profile']

// src/components/screens/KaryawanStaffDashboardScreen.tsx:23
MENU_CEPAT_STAFF = ['pengesahan', 'izin', 'lembur', 'holidays', 'chat']
```

Akibatnya pada user dengan `features = ['m_canvasing', 'm_dashboard']`:

| Elemen | Aturan | Hasil |
|---|---|---|
| Tab dashboard | butuh `m_dashboard` | tampil |
| Tab absensi | butuh `m_absensi` | disembunyikan |
| Tab chat | butuh `m_chat` | disembunyikan |
| Tab profile | selalu | tampil |
| 5 menu cepat staff | semua butuh izin yang tidak dimiliki, `isSembunyikanTerkunci` aktif | kosong semua |

Layar akhir: **2 tab (Beranda, Profil)** dan badan beranda kosong selain kartu tanggal —
sesuai tangkapan layar. Satu-satunya fitur yang benar-benar dimiliki user ini,
`m_canvasing`, tidak punya jalan masuk mana pun.

Perlu dicatat: `app/(app)/_layout.tsx:238` sebenarnya sudah menyiapkan
`href: bolehCanvasing(user) ? "/marketing/canvasing" : null`, tetapi tab bar kustom
per-persona (`TAB_BAR_PER_PERSONA`) menggantikan penentuan rute itu sepenuhnya, sehingga
href tersebut tidak pernah berlaku untuk persona STAFF.

**Saran**: masukkan `canvasing` ke whitelist tab staff atau ke `MENU_CEPAT_STAFF`, dan
tambahkan penjaga agar setiap `AppFeature` yang mungkin diberikan ke sebuah persona
dipastikan punya minimal satu jalur masuk.

## C. Inversi persona TEKNISI ↔ SALES (perlu keputusan)

Bukan cacat kode, tetapi akibat aturan backfill bertemu data seed. Hasilnya kontra-intuitif
dan terlihat langsung oleh pengguna.

Migration `20261001214142_add_persona_to_roles` menetapkan persona dari izin:
`m_presurvei` → SALES, `m_work_order` → TEKNISI. Pada data seed:

| Role | `m_presurvei` | `m_work_order` | Persona hasil | `isSales` |
|---|---|---|---|---|
| TEKNISI | 17 | 0 | **SALES** | true |
| SALES | 0 | 0 | **STAFF** | false |

Terbukti sampai UI:

- **TEKNISI** (Budi Santoso) → tab **Beranda, Presurvei, Canvasing, Absensi, Profil**;
  beranda menampilkan metrik sales ("Aktivitas (kunjungan & prospek)", "Konversi",
  "Realisasi rencana"). **Tidak ada tab Work Order.**
- **SALES** (Ani Wijaya) → hanya **Beranda, Profil**.

Teknisi mendapat aplikasi sales; sales mendapat aplikasi nyaris kosong.

Perlu dicatat: TEKNISI tidak memegang `m_work_order` adalah **keputusan sengaja** yang
terdokumentasi di `prisma/seed.ts:84-86` (izin itu default dimatikan, dibuka lewat Matrix
izin). Jadi yang perlu ditinjau adalah apakah data seed demo mencerminkan konfigurasi
operasional yang diinginkan — bukan logika migration-nya.

---

## D. Benar secara desain (diverifikasi)

| Kasus | Hasil | Keterangan |
|---|---|---|
| Login ADMIN & FINANCE di mobile | 403 `"Akun tidak memiliki akses mobile app"` | Role admin-panel, bukan employee panel |
| TEKNISI akses `/api/mobile/work-orders` | 403 | Sengaja, lihat `prisma/seed.ts:84-86` |
| Token staf ke `/api/mobile/investor/*` | 401 | Realm autentikasi investor terpisah |

## E. Kasus negatif autentikasi — semua benar

| Kasus | Hasil |
|---|---|
| Password salah | 401 |
| Email tidak terdaftar | 401 |
| Body kosong | 400 |
| Tanpa token | 401 |
| Token sampah | 401 |
| Token dipotong (tanda tangan rusak) | 401 |
| Logout → pakai token lama | 200 lalu **401** (token benar-benar dicabut) |

## F. Matriks otorisasi endpoint

| Endpoint | SUPER_ADMIN | TEKNISI | SALES |
|---|---|---|---|
| `/api/mobile/auth/me` | 200 | 200 | 200 |
| `/api/mobile/dashboard` | 200 | 200 | 200 |
| `/api/mobile/departments` | 200 | 200 | 200 |
| `/api/mobile/geofence` | 200 | 200 | 200 |
| `/api/mobile/notifications` | 200 | 200 | 200 |
| `/api/mobile/announcements` | 200 | 200 | 200 |
| `/api/mobile/attendance/status` | 200 | 200 | 403 |
| `/api/mobile/attendance/history` | 200 | 200 | 403 |
| `/api/mobile/holidays` | 200 | 200 | 403 |
| `/api/mobile/keluhan` | 200 | 200 | 403 |
| `/api/mobile/chat/conversations` | 200 | 200 | 403 |
| `/api/mobile/presurvei/ringkasan` | 200 | 200 | 403 |
| `/api/mobile/work-orders` | 200 | 403 | 403 |
| `/api/mobile/work-orders/available` | 200 | 403 | 403 |
| `/api/mobile/inventory/barang` | 400 | 400 | 403 |

`400` pada `inventory/barang` muncul untuk role yang berwenang — kemungkinan parameter
query wajib yang belum dikirim. Belum ditelusuri lebih jauh.

---

## G. Keterbatasan emulator (bukan cacat produk)

| Pesan | Sebab |
|---|---|
| `[FCM] FIS_AUTH_ERROR` | AVD tanpa Google Play Services penuh; tidak terjadi di perangkat asli |
| `[CredentialStorage] ExpoSecureStore.setValueWithKeyAsync has been rejected` | Keystore emulator tanpa kunci layar; menggagalkan simpan kredensial |

---

## Tindak lanjut yang disarankan

Urut prioritas:

1. **A1 + A2** — tangani bersama; keduanya membentuk satu rantai serangan
2. **B1** — tetapkan dulu arah role global vs per-tenant, baru perbaiki seed (+ migration bila perlu)
3. **B2** — hapus `@unique` pada `ProfilePPP.name` lewat migration
4. **B3** — beri `m_canvasing` jalur masuk untuk persona STAFF; tambahkan penjaga agar tiap izin punya minimal satu jalur
5. **C** — tinjau apakah data seed demo mencerminkan konfigurasi operasional
6. `400` pada `inventory/barang` — konfirmasi kontraknya
