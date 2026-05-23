# FreeRADIUS Config Bundle untuk Coexist MikroTik + accel-ppp

Bundle ini menyediakan konfigurasi minimal yang dibutuhkan FreeRADIUS agar
satu instance shared dapat melayani **MikroTik** dan **accel-ppp** sekaligus
dengan attribute reply yang sesuai per-NAS.

> **Versi target**: FreeRADIUS 3.0.x (Debian/Ubuntu).
> **Lokasi default config**: `/etc/freeradius/3.0/`.

---

## 1. Apa yang ada di bundle

| File | Tujuan |
|---|---|
| `huntgroups` | Pemetaan NAS-IP → label group (`mikrotik` atau `accel_ppp`). |
| `policy.d/per-nas-routing` | Policy unlang yang inject reply attribute spesifik server. |
| `sites-available/default.snippet` | Cuplikan untuk `post-auth` block utama. |

---

## 2. Apply

```bash
# 1. Backup konfigurasi existing
sudo cp -a /etc/freeradius/3.0 /etc/freeradius/3.0.bak.$(date +%F)

# 2. Salin file dari bundle
sudo cp huntgroups /etc/freeradius/3.0/huntgroups
sudo cp policy.d/per-nas-routing /etc/freeradius/3.0/policy.d/per-nas-routing

# 3. Edit /etc/freeradius/3.0/sites-available/default
#    Tambahkan baris `per-nas-routing` di blok `post-auth { ... }` —
#    lihat sites-available/default.snippet sebagai referensi.

# 4. Validasi syntax
sudo freeradius -CX

# 5. Restart service
sudo systemctl restart freeradius
```

---

## 3. Update huntgroups saat ada NAS baru

`huntgroups` dipakai oleh module `preprocess` untuk men-tag request berdasarkan
NAS-IP. Setiap kali daftar router/server berubah, regenerasi file ini supaya
huntgroup tetap konsisten dengan tabel `nas` di FreeRADIUS DB.

Contoh manual:
```
mikrotik    NAS-IP-Address == 10.0.0.1
mikrotik    NAS-IP-Address == 10.0.0.2
accel_ppp   NAS-IP-Address == 10.10.0.1
```

> **Tip**: di lingkungan produksi, generate file ini otomatis dari hasil
> query `nas` table — sehingga tidak ada drift antara DB dan FreeRADIUS config.

---

## 4. Verifikasi

```bash
# Tail debug
sudo freeradius -X

# Trigger access-request manual (radclient)
echo 'User-Name=budi.santoso,User-Password="rahasia",NAS-IP-Address=10.10.0.1' \
  | radclient -x 127.0.0.1 auth testing-secret
```

Pastikan reply attribute yang muncul **berbeda** untuk request yang datang
dari MikroTik vs accel-ppp.

---

## 5. Troubleshooting

- **Reply attribute kosong**: cek apakah `huntgroups` matched (lihat output `freeradius -X`,
  cari log `pre-proc.. group = ...`). Kalau `nasipaddress` tidak ada di huntgroups,
  policy tidak akan jalan.
- **AccessReject untuk semua user accel-ppp**: pastikan baris `nas` di RADIUS DB
  punya secret yang sama persis dengan `radiusSecret` di app. Mismatch → reject silent.
- **Reply MikroTik-Rate-Limit muncul di accel-ppp**: buktikan `per-nas-routing`
  sudah dipanggil di `post-auth`, dan cek bahwa rule huntgroup-mu pakai key yang benar.
