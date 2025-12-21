# 🚀 Panduan Deployment NetManager

Panduan lengkap untuk deploy NetManager ke VPS Ubuntu 22.04.

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

### Opsi A: Menggunakan Git (Rekomendasi) ✅

```bash
# 1. SSH ke server sebagai user deploy
ssh deploy@IP_SERVER
cd /opt/netmanager

# 2. Clone repository (pertama kali)
git clone https://github.com/YOUR_USERNAME/netmanager.git .

# 3. Setup environment
cp .env.production.example .env
./deploy.sh secrets      # Generate credentials
nano .env                 # Edit dan paste credentials

# 4. Deploy
./deploy.sh deploy ssl
```

**Update dengan Git:**
```bash
cd /opt/netmanager
git pull
./deploy.sh update
```

---

### Opsi B: Deploy dari Komputer Lokal (tanpa Git)

```bash
# Dari folder proyek di komputer lokal
./quick-deploy.sh deploy@IP_SERVER
```

## ⚙️ Langkah 4: Konfigurasi Environment

### A. Buat File .env

```bash
# Di server
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

```bash
# Deploy dengan SSL (Let's Encrypt)
./deploy.sh deploy ssl

# Atau tanpa SSL (jika di belakang Cloudflare)
./deploy.sh deploy nginx

# Atau direct port 3000 (development)
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

```bash
# Dari komputer lokal
./quick-deploy.sh deploy@IP_SERVER update

# Atau di server
cd /opt/netmanager
git pull
./deploy.sh update
```

---

## 📊 Perintah Berguna

| Perintah | Fungsi |
|----------|--------|
| `./deploy.sh status` | Lihat status semua services |
| `./deploy.sh logs app` | Lihat logs aplikasi |
| `./deploy.sh logs db` | Lihat logs database |
| `./deploy.sh backup` | Backup database |
| `./deploy.sh restart` | Restart semua services |
| `./deploy.sh stop` | Stop semua services |
| `./deploy.sh seed` | Seed database (data awal) |

---

## 🔥 Troubleshooting

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

---

## 🏗️ Arsitektur Deployment

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
