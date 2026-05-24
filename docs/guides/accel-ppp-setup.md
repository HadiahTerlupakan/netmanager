# Accel-PPP Server Setup Guide

> **Status**: draft (2026-05-23) — sinkron dengan implementasi M1–M6.
> **Mode**: coexist dengan MikroTik existing, **bukan** menggantikan.

Modul accel-ppp ditambahkan agar netmanager dapat mengelola server PPPoE
berbasis Linux + accel-ppp, paralel dengan MikroTik. Auth & accounting
keduanya melalui FreeRADIUS yang sama.

---

## 1. Topologi target

```
                ┌────────────────┐
                │  netmanager    │
                │   (Next.js)    │
                └────────┬───────┘
                         │  RADIUS provisioning + CLI ops
              ┌──────────┴──────────┐
              ▼                     ▼
      ┌───────────────┐     ┌─────────────────┐
      │  MikroTik(s)  │     │  accel-ppp box  │
      │  (existing)   │     │  (Linux + ppp)  │
      └───────┬───────┘     └────────┬────────┘
              │ AAA UDP/1812         │ AAA UDP/1812
              └──────────┬───────────┘
                         ▼
                ┌──────────────────┐
                │   FreeRADIUS     │
                │  (DB: radcheck,  │
                │   radreply, nas) │
                └──────────────────┘
```

Pelanggan dial PPPoE ke salah satu NAS. RADIUS auth terjadi di FreeRADIUS;
shared secret per-NAS disimpan di tabel `nas`. Reply attribute spesifik
NAS di-inject lewat policy unlang per-NAS-routing (lihat `freeradius-config/`).

---

## 2. Prasyarat

- 1+ box Linux (Debian/Ubuntu) dengan akses ke jaringan RADIUS.
- FreeRADIUS 3.0.x sudah berjalan dan sudah dipakai untuk MikroTik.
- Akses admin ke netmanager dengan permission:
  - `accel_ppp:read`, `accel_ppp:create`, `accel_ppp:update`, `accel_ppp:delete`
  - `accel_ppp:session:kick` (untuk operasi kick)
- Toggle global `Full RADIUS Mode` ON di `Settings`.

> **Penting untuk environment yang sudah pernah di-seed sebelum modul accel-ppp**
>
> Permission `accel_ppp:*` baru ditambahkan saat modul ini di-deploy.
> Role-role yang sudah ada di DB **tidak otomatis** mendapat permission ini.
> Lakukan salah satu:
>
> - Re-run seed permissions: `npm run prisma:seed-permissions` lalu assign ulang
>   permission baru ke role admin via halaman `Pengaturan → Roles`.
> - Atau via SQL: insert row di tabel `_PermissionToRole` untuk role admin
>   dengan permission_id baru `accel_ppp:read`, `accel_ppp:create`,
>   `accel_ppp:update`, `accel_ppp:delete`, `accel_ppp:session:kick`.
>
> Verifikasi: login sebagai user dengan role admin → buka
> `/admin/network/accel-ppp` → tidak boleh redirect ke `/admin/forbidden`.

---

## 3. Install accel-ppp

```bash
# Debian/Ubuntu
sudo apt update
sudo apt install -y accel-ppp

# Atau build dari source jika butuh fitur baru.
# Lihat https://accel-ppp.org untuk panduan resmi.
```

Pastikan service jalan setelah konfigurasi:
```bash
sudo systemctl enable --now accel-ppp
sudo systemctl status accel-ppp
```

---

## 4. Konfigurasi accel-ppp

Edit `/etc/accel-ppp.conf` dengan minimal section berikut. Sesuaikan
IP/range dengan jaringan Anda.

```ini
[modules]
log_file
pppoe
auth_pap
auth_chap_md5
auth_mschap_v1
auth_mschap_v2
radius
ippool
shaper
cli

[ppp]
verbose=1
unit-cache=1000
mtu=1492
mru=1492
ccp=0

[pppoe]
interface=eth1                 # interface yg melayani PPPoE
called-sid=ifname
verbose=1

[radius]
nas-identifier=accel-ppp-edge1
gw-ip-address=10.10.0.1        # = NAS-IP-Address yang dikenal RADIUS
server=10.0.0.10,RAHASIA-SHARED-SECRET,auth-port=1812,acct-port=1813
acct-timeout=120
timeout=10
acct-on=1
verbose=1

[ip-pool]
gw-ip-address=10.10.0.1
10.20.0.0/16

[shaper]
attr=Filter-Id                 # baca rate-limit dari Filter-Id
verbose=1

[cli]
tcp=0.0.0.0:2001
password=cli-rahasia-anda      # samakan dengan field cliPassword di netmanager
```

> Penting: `gw-ip-address` di `[radius]` harus sama dengan `nasname` di
> tabel `nas` FreeRADIUS dan dengan field `ipAddress` server di netmanager.
> Itulah kunci yang dipakai FreeRADIUS untuk match shared secret.

---

## 5. Apply FreeRADIUS bundle

Lihat `freeradius-config/README.md`. Ringkasnya:

```bash
sudo cp freeradius-config/huntgroups            /etc/freeradius/3.0/
sudo cp freeradius-config/policy.d/per-nas-routing  /etc/freeradius/3.0/policy.d/
# tambahkan baris `per-nas-routing` di blok post-auth pada
# /etc/freeradius/3.0/sites-available/default
sudo freeradius -CX
sudo systemctl restart freeradius
```

---

## 6. Daftarkan server di netmanager

1. Buka `https://<netmanager>/admin/network/accel-ppp`.
2. Klik **+ Tambah Server**.
3. Isi field minimum:
   - Nama: `accel-ppp-edge1`
   - IP / Hostname: `10.10.0.1` (sama dgn `gw-ip-address`)
   - RADIUS Secret: `RAHASIA-SHARED-SECRET` (sama dgn `[radius] server=`)
   - CLI Host: `10.10.0.1`
   - CLI Port: `2001`
   - CLI Password: `cli-rahasia-anda` (sama dgn `[cli] password=`)
4. Save.

netmanager akan otomatis upsert baris `nas` di FreeRADIUS DB. Kalau gagal,
server tidak di-create di app (rollback) — pesan errornya jelas.

---

## 7. Verifikasi end-to-end

```bash
# Dari netmanager admin: klik tombol "Test" pada list server.
# Hasil expected: ok=true, raw response berisi versi accel-ppp.

# Dari box accel-ppp:
$ accel-cmd show stat
# expected: status normal, sessions: 0
```

Dari device pelanggan, dial PPPoE ke `accel-ppp-edge1`. Di FreeRADIUS
debug (`freeradius -X`) Anda harus melihat:
```
(0) Found Auth-Type = PAP
(0) auth: User authenticated successfully
(0) post-auth {
(0)   per-nas-routing {
(0)     update reply { Filter-Id := "5120/5120" }
(0)   }
(0) }
(0) Sent Access-Accept Id 1 ...
```

Sesi yang berhasil akan muncul di tab **Sessions Live** detail page server,
dan di tabel `radacct` dengan `nasipaddress = 10.10.0.1`.

---

## 8. Operasi rutin

- **Kick paksa**: Detail server → tab Sessions Live → tombol "Kick" pada
  baris user. Server akan ekseksusi `terminate username <u>` via CLI.
- **Cek status periodik**: cron internal netmanager menjalankan
  `AccelPppMonitor.checkAll()` setiap 60 detik. Kolom `pingStatus` &
  `userOnline` di list page mencerminkan hasil polling terakhir.
- **Hapus server**: kalau masih ada sesi aktif, default-nya ditolak (409).
  Dengan `force=true` bisa dipaksa—tapi pertimbangkan ekspektasi pelanggan
  yang sesinya akan terputus secara abrupt.

---

## 9. Troubleshooting cepat

| Gejala | Cek |
|---|---|
| Test connection gagal (timeout) | Firewall di box accel-ppp ke port 2001; CLI password match |
| Test connection gagal (auth failed) | `cliPassword` di app vs `[cli] password=` di accel-ppp.conf |
| Pelanggan accel-ppp dapat reply MikroTik-Rate-Limit | Policy `per-nas-routing` belum di-call di post-auth atau huntgroups belum match |
| Pelanggan ditolak di FreeRADIUS | `radiusSecret` app vs `[radius] server=` di accel-ppp.conf, & baris `nas` di RADIUS DB |
| Sessions Live kosong padahal ada user dial | NAS belum kirim Acct-Start; cek FreeRADIUS log |
| `lastStatusCheck` tidak update | cron `accelPppHealthCheck` di-disable atau hang; cek log netmanager |

---

## 10. Out of scope

- Migrasi MikroTik ke pure-RADIUS (drop `/ppp/secret`)
- Failover / load balance otomatis antar NAS
- Disconnect-Request via CoA (saat ini delete server tanpa force = block)
- Multi-instance accel-ppp di satu IP

Lihat spec `docs/superpowers/specs/2026-05-23-accel-ppp-server-coexist-design.md`
untuk konteks penuh.
