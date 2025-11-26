# Setup Subdomain untuk NetManager

Dokumentasi ini menjelaskan cara setup subdomain untuk aplikasi NetManager, baik untuk development (localhost) maupun production.

## 📋 Overview

Aplikasi NetManager menggunakan routing berbasis subdomain:
- **Admin**: `admin.xxx.xx` - Untuk akses panel admin
- **Pelanggan**: `pelanggan.xxx.xx` - Untuk akses portal pelanggan

## 🛠️ Development Setup (Localhost)

### Opsi 1: Menggunakan `*.localhost` (Recommended)

Next.js mendukung `*.localhost` secara native tanpa perlu konfigurasi tambahan.

#### Cara Menggunakan:

1. **Jalankan aplikasi seperti biasa:**
   ```bash
   npm run dev
   ```

2. **Akses aplikasi melalui subdomain:**
   - Admin: `http://admin.localhost:3000`
   - Pelanggan: `http://pelanggan.localhost:3000`

#### Keuntungan:
- ✅ Tidak perlu konfigurasi tambahan
- ✅ Langsung bekerja dengan Next.js
- ✅ Tidak perlu edit hosts file

#### Catatan:
- Pastikan browser Anda mendukung `*.localhost` (Chrome, Firefox, Safari modern sudah mendukung)
- Jika tidak bekerja, coba gunakan Opsi 2

### Opsi 2: Menggunakan Custom Domain dengan Hosts File

Jika `*.localhost` tidak bekerja di browser Anda, gunakan custom domain dengan hosts file.

#### Setup untuk macOS/Linux:

1. **Edit hosts file:**
   ```bash
   sudo nano /etc/hosts
   ```

2. **Tambahkan baris berikut:**
   ```
   127.0.0.1 admin.netmanager.local
   127.0.0.1 pelanggan.netmanager.local
   ```

3. **Simpan dan keluar** (Ctrl+X, lalu Y, lalu Enter)

4. **Jalankan aplikasi:**
   ```bash
   npm run dev
   ```

5. **Akses aplikasi:**
   - Admin: `http://admin.netmanager.local:3000`
   - Pelanggan: `http://pelanggan.netmanager.local:3000`

#### Setup untuk Windows:

1. **Buka Notepad sebagai Administrator:**
   - Klik kanan pada Notepad → Run as Administrator

2. **Buka hosts file:**
   - File → Open
   - Navigasi ke `C:\Windows\System32\drivers\etc\hosts`
   - Pilih "All Files" di dropdown file type

3. **Tambahkan baris berikut:**
   ```
   127.0.0.1 admin.netmanager.local
   127.0.0.1 pelanggan.netmanager.local
   ```

4. **Simpan file**

5. **Jalankan aplikasi:**
   ```bash
   npm run dev
   ```

6. **Akses aplikasi:**
   - Admin: `http://admin.netmanager.local:3000`
   - Pelanggan: `http://pelanggan.netmanager.local:3000`

## 🚀 Production Setup

Untuk production, Anda perlu mengkonfigurasi DNS dan server web Anda.

### 1. Konfigurasi DNS

Tambahkan record DNS untuk subdomain:

```
A     admin.yourdomain.com     → IP_SERVER_ANDA
A     pelanggan.yourdomain.com  → IP_SERVER_ANDA
```

Atau jika menggunakan CNAME:

```
CNAME admin.yourdomain.com     → yourdomain.com
CNAME pelanggan.yourdomain.com → yourdomain.com
```

### 2. Konfigurasi Server Web

#### Menggunakan Nginx:

```nginx
# Admin subdomain
server {
    listen 80;
    server_name admin.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Pelanggan subdomain
server {
    listen 80;
    server_name pelanggan.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Menggunakan Apache:

```apache
# Admin subdomain
<VirtualHost *:80>
    ServerName admin.yourdomain.com
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>

# Pelanggan subdomain
<VirtualHost *:80>
    ServerName pelanggan.yourdomain.com
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

### 3. Update Environment Variables

Pastikan `NEXTAUTH_URL` di `.env` sesuai dengan domain production Anda:

```env
NEXTAUTH_URL="https://admin.yourdomain.com"
```

Atau jika ingin mendukung kedua subdomain:

```env
NEXTAUTH_URL="https://yourdomain.com"
```

### 4. Enable HTTPS (Recommended)

Gunakan Let's Encrypt untuk SSL certificate:

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx  # Untuk Nginx
# atau
sudo apt-get install certbot python3-certbot-apache  # Untuk Apache

# Generate certificate untuk kedua subdomain
sudo certbot --nginx -d admin.yourdomain.com -d pelanggan.yourdomain.com
```

## 🔧 Cara Kerja

### Middleware Routing

Middleware (`middleware.ts`) akan:
1. Mendeteksi subdomain dari request header `host`
2. Jika request dari `admin.*`, redirect ke `/admin` jika belum di path `/admin`
3. Jika request dari `pelanggan.*`, redirect ke `/pelanggan` jika belum di path `/pelanggan`
4. Jika tidak ada subdomain, tetap bisa akses langsung (untuk development)

### Utility Functions

File `lib/utils/subdomain.ts` menyediakan helper functions:
- `getSubdomain(request)` - Mendapatkan subdomain dari request
- `isAdminSubdomain(request)` - Cek apakah request dari admin subdomain
- `isPelangganSubdomain(request)` - Cek apakah request dari pelanggan subdomain
- `getBaseUrl(request)` - Mendapatkan base URL berdasarkan subdomain

## 🧪 Testing

### Test di Development:

1. **Test admin subdomain:**
   ```bash
   curl http://admin.localhost:3000
   # atau
   curl http://admin.netmanager.local:3000
   ```

2. **Test pelanggan subdomain:**
   ```bash
   curl http://pelanggan.localhost:3000
   # atau
   curl http://pelanggan.netmanager.local:3000
   ```

### Test di Production:

1. **Test admin subdomain:**
   ```bash
   curl https://admin.yourdomain.com
   ```

2. **Test pelanggan subdomain:**
   ```bash
   curl https://pelanggan.yourdomain.com
   ```

## ⚠️ Troubleshooting

### Problem: `*.localhost` tidak bekerja

**Solusi:**
- Gunakan Opsi 2 dengan hosts file
- Atau gunakan browser yang lebih baru (Chrome 63+, Firefox 63+, Safari 11+)

### Problem: Subdomain tidak redirect dengan benar

**Solusi:**
1. Pastikan middleware sudah di-update
2. Cek header `host` di request
3. Pastikan server web (Nginx/Apache) mengirim header `Host` dengan benar

### Problem: NextAuth tidak bekerja dengan subdomain

**Solusi:**
1. Pastikan `NEXTAUTH_URL` di `.env` sesuai dengan domain yang digunakan
2. Jika menggunakan multiple subdomain, pastikan cookie domain diatur dengan benar
3. Cek `NEXTAUTH_SECRET` sudah di-set

### Problem: CORS error saat akses API

**Solusi:**
1. Pastikan API routes tidak memblokir request dari subdomain
2. Cek konfigurasi CORS di `next.config.ts`
3. Pastikan header `Origin` dan `Referer` dikirim dengan benar

## 📝 Catatan Penting

1. **Development**: Di development, aplikasi tetap bisa diakses langsung tanpa subdomain untuk kemudahan development
2. **Production**: Di production, disarankan untuk enforce subdomain dengan meng-uncomment kode di layout files
3. **Cookie Domain**: Pastikan cookie domain diatur dengan benar jika menggunakan multiple subdomain
4. **Session**: NextAuth session akan bekerja di semua subdomain jika cookie domain diatur dengan benar

## 🔗 Referensi

- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
- [MDN: Using localhost](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Identifying_resources_on_the_Web)

