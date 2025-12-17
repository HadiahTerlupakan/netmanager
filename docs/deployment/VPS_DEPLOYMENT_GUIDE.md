# 🚀 Panduan Deploy NetManager ke VPS

Panduan ini akan membantu Anda deploy NetManager ke VPS dengan Docker.

## 📋 Prasyarat

### Di VPS Anda:
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **RAM**: Minimal 2GB (Rekomendasi: 4GB)
- **Storage**: Minimal 20GB SSD
- **CPU**: 2 vCPU+
- **Docker**: v24+
- **Docker Compose**: v2+

### Domain:
- Domain yang sudah mengarah ke IP VPS
- Subdomain yang dibutuhkan:
  - `yourdomain.com` - Landing page
  - `admin.yourdomain.com` - Admin portal
  - `employee.yourdomain.com` - Employee portal
  - `helpdesk.yourdomain.com` - Helpdesk portal
  - `pelanggan.yourdomain.com` - Customer portal

## 🔧 Langkah 1: Persiapan VPS

### Install Docker
```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Tambahkan user ke group docker
sudo usermod -aG docker $USER

# Logout dan login kembali, lalu verifikasi
docker --version
docker compose version
```

### Setup Firewall
```bash
# Buka port yang diperlukan
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 1812/udp  # RADIUS Auth
sudo ufw allow 1813/udp  # RADIUS Accounting

sudo ufw enable
```

## 📁 Langkah 2: Upload Project

### Opsi A: Clone dari Git
```bash
git clone https://github.com/username/netmanager.git
cd netmanager
```

### Opsi B: Upload dengan rsync
```bash
# Dari komputer lokal
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.git' \
  ./ user@your-vps-ip:/home/user/netmanager/
```

### Opsi C: Upload dengan SCP
```bash
# Compress dulu
tar -czvf netmanager.tar.gz --exclude='node_modules' --exclude='.next' --exclude='.git' .

# Upload
scp netmanager.tar.gz user@your-vps-ip:/home/user/

# Di VPS
cd /home/user
tar -xzvf netmanager.tar.gz -C netmanager
```

## ⚙️ Langkah 3: Konfigurasi

### Buat file .env
```bash
cd netmanager

# Jalankan setup
./deploy.sh setup

# Generate credentials
./deploy.sh secrets
```

### Edit file .env
```bash
nano .env
```

Isi nilai-nilai berikut:

```env
# Domain Anda
DOMAIN=netmanager.example.com
ACME_EMAIL=admin@example.com

# Paste credentials dari output ./deploy.sh secrets
AUTH_SECRET=xxxxx
NEXTAUTH_SECRET=xxxxx
POSTGRES_PASSWORD=xxxxx
REDIS_PASSWORD=xxxxx
RADIUS_SECRET=xxxxx
OAUTH_ENCRYPTION_KEY=xxxxx
```

## 🚀 Langkah 4: Deploy

### Opsi A: Deploy dengan SSL (Rekomendasi)
```bash
./deploy.sh deploy ssl
```

Ini akan:
- Build aplikasi
- Start semua services
- Mengaktifkan Traefik dengan Let's Encrypt SSL
- Menjalankan database migration

### Opsi B: Deploy dengan Nginx (untuk Cloudflare)
```bash
./deploy.sh deploy nginx
```

Gunakan ini jika Anda menggunakan Cloudflare atau CDN lain yang sudah menyediakan SSL.

### Opsi C: Deploy tanpa reverse proxy
```bash
./deploy.sh deploy
```

Aplikasi akan berjalan di port 3000. Anda perlu setup reverse proxy sendiri.

## 🌱 Langkah 5: Seed Database (Opsional)

Jika ini deployment pertama kali:
```bash
./deploy.sh seed
```

Ini akan membuat:
- Admin user default
- Role dan permission dasar
- Data contoh lainnya

## ✅ Langkah 6: Verifikasi

### Cek status services
```bash
./deploy.sh status
```

Output yang diharapkan:
```
NAME                    STATUS       PORTS
netmanager-db           running      5432/tcp
netmanager-redis        running      6379/tcp
netmanager-app          running      3000/tcp
netmanager-traefik      running      80/tcp, 443/tcp
```

### Cek logs
```bash
# Logs aplikasi
./deploy.sh logs app

# Logs database
./deploy.sh logs db

# Logs traefik
./deploy.sh logs traefik
```

### Test akses
Buka browser dan akses:
- https://yourdomain.com - Landing page
- https://admin.yourdomain.com/login - Admin login

Default admin credentials:
- Email: `admin@netmanager.local`
- Password: `Admin123!`

> ⚠️ **PENTING**: Segera ganti password admin setelah login!

## 🔄 Update Aplikasi

Untuk update ke versi terbaru:
```bash
./deploy.sh update
```

Script ini akan:
1. Backup database
2. Pull kode terbaru (jika pakai git)
3. Rebuild Docker image
4. Jalankan migration
5. Restart aplikasi

## 💾 Backup Database

### Manual backup
```bash
./deploy.sh backup
```

File backup tersimpan di `./backups/`

### Scheduled backup (Cron)
```bash
# Edit crontab
crontab -e

# Tambahkan line ini untuk backup setiap hari jam 2 pagi
0 2 * * * cd /home/user/netmanager && ./deploy.sh backup
```

## 🛠️ Maintenance

### Restart services
```bash
./deploy.sh restart
```

### Stop semua services
```bash
./deploy.sh stop
```

### Lihat logs real-time
```bash
./deploy.sh logs app
```

### Masuk ke container
```bash
# Database
docker exec -it netmanager-db psql -U netmgr -d netmanager

# Redis
docker exec -it netmanager-redis redis-cli -a YOUR_REDIS_PASSWORD

# App
docker exec -it netmanager-app sh
```

## 🔒 Security Checklist

- [ ] Ganti password admin default
- [ ] Pastikan firewall aktif
- [ ] Backup database secara berkala
- [ ] Update Docker images secara berkala
- [ ] Monitor logs untuk aktivitas mencurigakan
- [ ] Gunakan SSH key, bukan password
- [ ] Disable root login SSH

## ❓ Troubleshooting

### Aplikasi tidak bisa diakses
```bash
# Cek status container
./deploy.sh status

# Cek logs
./deploy.sh logs app
```

### Database connection error
```bash
# Cek apakah database running
docker exec -it netmanager-db pg_isready -U netmgr

# Cek logs database
./deploy.sh logs db
```

### SSL tidak bekerja
```bash
# Cek logs Traefik
./deploy.sh logs traefik

# Pastikan port 80 dan 443 terbuka
sudo ufw status
```

### Memory issues
```bash
# Cek penggunaan memory
docker stats

# Jika perlu, tambah swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📞 Support

Jika mengalami masalah:
1. Cek logs: `./deploy.sh logs app`
2. Periksa dokumentasi di folder `docs/`
3. Buka issue di GitHub repository
