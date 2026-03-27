# FreeRADIUS Integration Guide

Dokumentasi ini menjelaskan cara mengintegrasikan router MikroTik atau NAS lainnya dengan FreeRADIUS yang berjalan di Kubernetes.

## 🚀 Koneksi ke RADIUS Server

Gunakan IP Server dan Port berikut untuk konfigurasi di MikroTik:

| Environment | Server IP | Auth Port (UDP) | Acct Port (UDP) |
|---|---|---|---|
| **Staging** | `141.11.160.150` | `31812` | `31813` |
| **Production** | `141.11.160.150` | `30812` | `30813` |

## 🔑 Manajemen Secret

Terdapat dua jenis Secret di sistem ini:

### 1. Per-NAS Secret (Direkomendasikan)
FreeRADIUS dikonfigurasi secara dinamis untuk membaca data NAS dari database. 
- **Cara Set:** Buka menu **Admin > Network > MikroTik** di aplikasi web NetManager.
- **Input:** Masukkan IP MikroTik dan **Secret** pilihan Anda.
- **Hasil:** FreeRADIUS akan otomatis mengenali router tersebut tanpa perlu restart. Gunakan Secret yang sama di pengaturan MikroTik Anda.

### 2. Global RADIUS Secret
Digunakan untuk komunikasi internal cluster dan health checks.
- **Staging:** `REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY`
- **Production:** `ef623feb122dc7a31328ab99`

## 🛠️ Konfigurasi di MikroTik

1. Buka Winbox > **RADIUS**.
2. Klik **+** (Add New).
3. Centang service yang dibutuhkan (misal: `ppp`, `login`).
4. Masukkan **Address** (IP Server).
5. Masukkan **Secret** (Sesuai yang diinput di Web Admin).
6. Sesuaikan **Authentication Port** dan **Accounting Port** sesuai tabel di atas.
7. Set **Timeout** ke `3000ms` (disarankan untuk koneksi via internet/VPN).

---
*Catatan: Pastikan firewall di server mengizinkan traffic UDP pada range port 30000-32767.*
