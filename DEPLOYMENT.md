# 🚀 Panduan Deployment NetManager

Panduan lengkap untuk bootstrap awal, deployment rutin via Jenkins + Kubernetes, dan recovery manual NetManager di VPS Ubuntu 22.04.

---

## 📋 Persyaratan Server

| Komponen | Minimum | Rekomendasi |
|----------|---------|-------------|
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **RAM** | 2 GB | 4 GB |
| **CPU** | 1 Core | 2 Core |
| **Storage** | 20 GB SSD | 40 GB SSD |
| **Bandwidth** | Unmetered | Unmetered |

---

## 🔧 Langkah 1: Setup Server (Pertama Kali)

### A. Akses Server via SSH

```bash
ssh root@IP_SERVER_ANDA
```

### B. Download & Jalankan Setup Script

```bash
# Download script
curl -O https://raw.githubusercontent.com/YOUR_REPO/main/server-setup.sh

# Atau copy manual dari komputer lokal:
scp server-setup.sh root@IP_SERVER:/tmp/

# Jalankan script
chmod +x /tmp/server-setup.sh
sudo /tmp/server-setup.sh
```

Script ini akan:
- ✅ Update sistem
- ✅ Install Docker & Docker Compose
- ✅ Konfigurasi firewall (UFW)
- ✅ Setup swap memory
- ✅ Buat user deploy
- ✅ Buat direktori `/opt/netmanager`

---

## 🌐 Langkah 2: Konfigurasi DNS

Tambahkan DNS records di domain provider (Cloudflare, dll):

| Type | Name | Value | Keterangan |
|------|------|-------|------------|
| A | @ | `IP_SERVER` | Domain utama |
| A | www | `IP_SERVER` | www redirect |
| A | admin | `IP_SERVER` | Portal Admin |
| A | karyawan | `IP_SERVER` | Portal Karyawan |

> ⚠️ **Jika menggunakan Cloudflare**: Sementara disable proxy (grey cloud) sampai SSL Let's Encrypt aktif.

---

## 🚀 Langkah 3: Deploy Aplikasi

### Jalur Utama: Jenkins + Kubernetes ✅

Untuk **staging** dan **production**, gunakan pipeline **Jenkins** sebagai jalur utama. Pipeline ini menangani:
- build image immutable (`APP_IMAGE_REF`, `CRON_IMAGE_REF`, `RADIUS_IMAGE_REF`)
- migration job di Kubernetes
- render manifest Kubernetes dengan image ref immutable
- verifikasi rollout sebelum dianggap sukses

Alur umumnya:
1. Trigger pipeline Jenkins untuk environment yang dituju
2. Pipeline membangun image dan menyimpan immutable image ref
3. Migration job dijalankan di Kubernetes dengan guard pipeline
4. Deployment merender manifest lalu apply ke Kubernetes
5. Pipeline memverifikasi rollout selesai sebelum menutup job

> **Catatan**: Jalur ini adalah source of truth untuk update rutin staging/production. Jangan gunakan update manual sebagai default.

> **Registry private**: jika workload memakai registry privat, secret pull auth cluster (`imagePullSecrets` / registry secret) **harus sudah dibootstrap di namespace target sebelum rollout rutin dianggap siap**. Template/placeholder untuk secret registry ada di `k8s/staging/registry-secret.yaml` dan `k8s/production/registry-secret.yaml`; isi nilainya lewat mekanisme aman, jangan commit secret live ke repo.
>
> **Penting**: pipeline Jenkins **sengaja tidak** meng-apply `registry-secret.yaml` placeholder. Jika secret belum ada, pipeline akan fail-fast sebelum migration atau rollout.
>
> **Contoh bootstrap production secret**:
> ```bash
> kubectl create secret docker-registry netmanager-production-registry \
>   --namespace=netmanager-production \
>   --docker-server=ghcr.io \
>   --docker-username='<registry-username>' \
>   --docker-password='<registry-token>'
> ```
>
> Jika secret perlu diperbarui, gunakan pola replace aman berikut:
> ```bash
> kubectl delete secret netmanager-production-registry \
>   --namespace=netmanager-production \
>   --ignore-not-found
>
> kubectl create secret docker-registry netmanager-production-registry \
>   --namespace=netmanager-production \
>   --docker-server=ghcr.io \
>   --docker-username='<registry-username>' \
>   --docker-password='<registry-token>'
> ```
>
> Verifikasi sebelum rerun pipeline:
> ```bash
> kubectl get secret netmanager-production-registry --namespace=netmanager-production
> ```

### Jalur Manual: Bootstrap / Legacy / Emergency Only ⚠️

Jalur manual di bawah ini hanya dipertahankan untuk:
- bootstrap awal server saat Jenkins/Kubernetes belum siap
- recovery darurat jika pipeline gagal total
- workflow legacy yang sedang dimigrasikan

Jangan gunakan langkah manual ini untuk update rutin staging/production.

## ⚙️ Langkah 4: Konfigurasi Environment

### A. Buat File .env

```bash
# Di server untuk bootstrap awal / recovery manual
cd /opt/netmanager
cp .env.production.example .env
nano .env
```

### B. Generate Credentials

```bash
./deploy.sh secrets
```

Copy output dan paste ke file `.env`.

### C. Contoh .env yang Sudah Dikonfigurasi

```env
DOMAIN=radpro.id
ACME_EMAIL=admin@radpro.id

POSTGRES_PASSWORD=AbCdEfGhIjKlMnOpQrSt
REDIS_PASSWORD=XyZaBcDeFgHiJkLmNo

AUTH_SECRET=your-generated-auth-secret
NEXTAUTH_SECRET=your-generated-nextauth-secret
OAUTH_ENCRYPTION_KEY=your-generated-oauth-key

AUTH_URL=https://radpro.id
NEXTAUTH_URL=https://radpro.id
COOKIE_DOMAIN=radpro.id
```

---

## 🎯 Langkah 5: Jalankan Deployment

### Rutin Staging/Production

> Untuk deployment rutin staging/production, gunakan Jenkins + Kubernetes. Langkah manual di bawah ini **bukan** jalur normal update.

### Bootstrap Awal / Recovery Manual

```bash
# Deploy dengan SSL (Let's Encrypt) — bootstrap awal atau emergency recovery
./deploy.sh deploy ssl

# Atau tanpa SSL (jika di belakang Cloudflare) — bootstrap awal atau emergency recovery
./deploy.sh deploy nginx

# Atau direct port 3000 (development lokal / smoke test)
./deploy.sh deploy
```

---

## ✅ Langkah 6: Verifikasi

```bash
# Cek status services
./deploy.sh status

# Lihat logs
./deploy.sh logs app

# Test akses
curl -I https://radpro.id
```

---

## 🔄 Update Aplikasi

### Update Kode, Schema, dan Rollout

Untuk staging dan production, update aplikasi, migrasi schema, dan verifikasi rollout harus dilakukan melalui **Jenkins + Kubernetes**. Jangan menjalankan rebuild container atau `docker exec` migration sebagai jalur normal, karena itu melewati backup/migration guard pipeline.

Jika ada perubahan schema atau seed, pipeline akan menjalankan migration job terkontrol sebelum rollout image baru.

### Bootstrap / Legacy / Emergency Recovery Path

> ⚠️ **Warning**: Jalur di bawah ini hanya untuk bootstrap awal, recovery darurat, atau legacy workflow yang belum dimigrasikan. Ini **bypass** guard pipeline Jenkins/Kubernetes, jadi jangan dipakai untuk update rutin staging/production. Untuk seed manual, gunakan hanya saat recovery data atau bootstrap awal.

```bash
# Hanya jika pipeline tidak bisa dipakai dan perlu recovery manual
cd ~/netmanager
git pull

# Recovery lama berbasis Compose
docker compose -f docker-compose.production.yml --profile ssl up -d --force-recreate --build app

# Recovery schema manual (legacy)
docker exec -it netmanager-app npx prisma migrate deploy

# Recovery seed manual (legacy)
docker exec -it netmanager-app npx tsx prisma/seed.ts
```

### Reset Database (Development Only!)

> ⚠️ **Warning**: Ini akan menghapus semua data! Jalur ini hanya untuk development lokal dan tidak untuk staging/production.

```bash
# Reset database ke schema terbaru
docker exec -it netmanager-app npx prisma db push --force-reset

# Seed data awal
docker exec -it netmanager-app npx tsx prisma/seed.ts

# Restart app
docker restart netmanager-app
```

---

## 📊 Perintah Berguna

### Observability / Read-Only

Gunakan perintah ini untuk memantau kondisi sistem atau membantu diagnosis tanpa mengubah state aplikasi.

| Perintah | Fungsi |
|----------|--------|
| `./deploy.sh status` | Lihat status semua services |
| `./deploy.sh logs app` | Lihat logs aplikasi |
| `./deploy.sh logs db` | Lihat logs database |

### Maintenance / Backup / Recovery Manual

Perintah berikut boleh mengubah data atau state, jadi pisahkan dari observability read-only.

| Perintah | Fungsi |
|----------|--------|
| `./deploy.sh backup` | Backup database |
| `./deploy.sh restart` | Restart semua services — hanya saat bootstrap/recovery manual |
| `./deploy.sh stop` | Stop semua services — hanya saat bootstrap/recovery manual |
| `./deploy.sh seed` | Seed database (data awal) — hanya bootstrap awal / recovery data |

> ⚠️ **Catatan**: Semua perintah di atas hanya untuk bootstrap awal, recovery darurat, atau workflow legacy yang belum dimigrasikan. Jangan dipakai sebagai operasi rutin staging/production. Untuk staging/production tetap gunakan Jenkins + Kubernetes.

---

## 🔥 Troubleshooting

> ⚠️ **Catatan**: Bagian ini untuk recovery/legacy/manual handling, bukan jalur operasi rutin staging/production. Untuk update normal tetap gunakan Jenkins + Kubernetes.

### SSL Certificate Error

```bash
# Hapus certificate lama
docker compose -f docker-compose.production.yml --profile ssl down
docker volume rm netmanager_letsencrypt_data

# Deploy ulang
./deploy.sh deploy ssl
```

### Database Connection Error

```bash
# Cek logs database
./deploy.sh logs db

# Restart database
docker compose -f docker-compose.production.yml restart db
```

### Out of Memory

```bash
# Tambah swap (jika belum)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Port Already in Use

```bash
# Cek port yang digunakan
sudo lsof -i :80
sudo lsof -i :443

# Kill proses jika ada
sudo systemctl stop nginx
sudo systemctl stop apache2
```

### Upload Permission Denied

Jika upload gagal dengan error `EACCES: permission denied, mkdir '/app/public/uploads/...'`, artinya container tidak punya izin tulis ke folder uploads di host.

Solusi:
```bash
# Ubah pemilik folder uploads ke user 1001 (User Next.js dalam container)
sudo chown -R 1001:1001 uploads
```

---

## 🏗️ Arsitektur Bootstrap / Manual / Legacy / Recovery

> Diagram berikut menggambarkan topologi bootstrap/recovery manual atau legacy yang masih dipertahankan. Untuk update rutin staging/production, jalur resmi tetap Jenkins + Kubernetes.

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Traefik (Port 80/443)                     │
│                  SSL/TLS + Reverse Proxy                      │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   radpro.id          admin.radpro.id       karyawan.radpro.id
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   NetManager App (Port 3000)                  │
│                      Next.js + Custom Server                  │
└─────────────────────────────────────────────────────────────┘
                    │                   │
                    ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐
        │   PostgreSQL      │ │      Redis        │
        │   (Database)      │ │     (Cache)       │
        └───────────────────┘ └───────────────────┘
                    │
                    ▼
        ┌───────────────────┐
        │   FreeRADIUS      │
        │  (Port 1812/1813) │
        └───────────────────┘
```

---

## 📞 Support

Jika mengalami kendala, hubungi:
- Email: admin@radpro.id
- WhatsApp: [Nomor Support]
