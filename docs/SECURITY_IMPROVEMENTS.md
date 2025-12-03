# Peningkatan Keamanan NetManager

Dokumentasi ini menjelaskan peningkatan keamanan yang telah diimplementasikan pada aplikasi NetManager.

## 1. Enkripsi Password Pelanggan

### Masalah Sebelumnya
- Password pelanggan disimpan dalam plain text di database
- Risiko kebocoran data jika database diserang

### Solusi
- Menambahkan field `passwordHash` ke model Pelanggan
- Menggunakan bcrypt dengan salt rounds = 12 untuk meng-hash password
- Membuat migration script untuk meng-hash password pelanggan yang ada
- Update endpoint registrasi untuk meng-hash password baru
- Update endpoint login untuk verifikasi password hash dengan fallback ke plain text untuk backward compatibility

### Cara Menjalankan Migrasi
```bash
npm run security:migrate-passwords
```

## 2. Implementasi JWT untuk Autentikasi Pelanggan

### Masalah Sebelumnya
- Token autentikasi menggunakan base64 encoding yang mudah di-decode
- Tidak ada mekanisme refresh token
- Token tidak memiliki expiry time yang jelas

### Solusi
- Mengimplementasikan JWT (JSON Web Token) untuk autentikasi
- Access token dengan expiry 15 menit
- Refresh token dengan expiry 7 hari
- Token versioning untuk invalidate refresh token lama
- Endpoint baru untuk refresh token dan logout

### Endpoint Baru
- `POST /api/pelanggan/auth/login` - Login dengan JWT
- `POST /api/pelanggan/auth/refresh` - Refresh access token
- `POST /api/pelanggan/auth/logout` - Logout dan invalidate refresh token

## 3. Peningkatan Rate Limiting

### Masalah Sebelumnya
- Rate limiting terlalu longgar untuk endpoint sensitif
- Tidak ada progressive delay untuk percobaan login gagal

### Solusi
- Memperketat rate limiting untuk endpoint autentikasi (5 requests per 5 menit)
- Menambahkan progressive delay untuk percobaan login gagal
- Rate limiting khusus untuk endpoint sensitif lainnya

### Konfigurasi Rate Limiting
- `/api/auth`: 5 requests per 5 menit
- `/api/pelanggan/auth/login`: 5 requests per 5 menit
- `/api/pelanggan/auth/refresh`: 10 requests per 5 menit
- `/api/finance/auth/login`: 5 requests per 5 menit
- `/api/olts/test-connection`: 10 requests per menit
- `/api/mikrotik-routers/test-connection`: 10 requests per menit
- `/api/kmz`: 5 uploads per menit
- `/api/pelanggan-ppp`: 20 requests per menit

## 4. Peningkatan Validasi Input

### Masalah Sebelumnya
- Tidak semua endpoint menggunakan sanitasi input
- Potensi serangan XSS atau injection

### Solusi
- Membuat middleware global untuk sanitasi input
- Memastikan semua endpoint menggunakan sanitasi dari `lib/utils/sanitize.ts`
- Sanitasi untuk request body, query parameters, dan path parameters

### Middleware Sanitasi
- `sanitizeRequestBody` - Sanitasi request body (JSON dan form data)
- `sanitizeQueryParams` - Sanitasi query parameters
- `sanitizePathParams` - Sanitasi path parameters

## 5. Peningkatan Content Security Policy (CSP)

### Masalah Sebelumnya
- CSP kurang komprehensif
- Tidak ada perlindungan untuk beberapa jenis serangan

### Solusi
- Memperbarui CSP dengan direktif yang lebih ketat
- Menambahkan direktif untuk object-src, media-src, manifest-src, worker-src, frame-src, dan child-src
- Mencegah loading resource dari domain yang tidak terpercaya

### CSP Baru
```
default-src 'self'
script-src 'self' 'unsafe-eval' 'unsafe-inline'
style-src 'self' 'unsafe-inline'
img-src 'self' data: https: blob:
font-src 'self' data:
connect-src 'self' https:
frame-ancestors 'self'
base-uri 'self'
form-action 'self'
object-src 'none'
media-src 'self'
manifest-src 'self'
worker-src 'self' blob:
frame-src 'self'
child-src 'self'
```

## 6. Rekomendasi Tambahan

### Environment Variables
Pastikan environment variables berikut sudah diatur dengan benar:
- `NEXTAUTH_SECRET` - Gunakan string yang kuat dan unik
- `ENCRYPTION_KEY` - Gunakan key yang kuat untuk enkripsi data sensitif

### Monitoring
- Monitor log untuk aktivitas mencurigakan
- Setup alert untuk rate limit yang terlampaui
- Review log error secara berkala

### Backup
- Backup database secara berkala
- Test restore backup untuk memastikan backup valid
- Simpan backup di lokasi yang aman

## 7. Testing

### Uji Coba Keamanan
- Uji coba login dengan password yang salah (verifikasi rate limiting)
- Uji coba XSS melalui input form
- Uji coba injection SQL melalui parameter
- Verifikasi bahwa password sudah terenkripsi di database

### Automated Testing
- Jalankan test suite untuk memastikan semua fitur berfungsi
- Jalankan security scan secara berkala
- Implementasi automated security testing di CI/CD pipeline
