# Panduan Deployment Kubernetes (Staging)

Manifest di folder ini disiapkan untuk lingkungan staging aplikasi NetManager di namespace `netmanager-staging`.

## 📂 Struktur Berkas
- `namespace.yaml`: Membuat namespace `netmanager-staging`.
- `configmap.yaml`: Konfigurasi environment variable non-sensitif.
- `secrets.yaml`: Template untuk kredensial (semua harus diisi dalam bentuk plain text di `stringData` atau base64 di `data`).
- `db-statefulset.yaml`: Deployment PostgreSQL dengan volume persistensi.
- `redis-deployment.yaml`: Deployment Redis.
- `app-deployment.yaml`: Deployment aplikasi Next.js (NetManager).
- `ingress-staging.yaml`: Konfigurasi akses domain via Ingress Controller (Nginx).

## 🚀 Langkah-langkah Deployment

1. **Persiapan Namespace**
   ```bash
   kubectl apply -f namespace.yaml
   ```

2. **Konfigurasi Kredensial**
   Edit `secrets.yaml` dan isi dengan nilai yang benar, lalu jalankan:
   ```bash
   kubectl apply -f secrets.yaml
   kubectl apply -f configmap.yaml
   ```

3. **Deploy Infrastruktur (DB & Redis)**
   ```bash
   kubectl apply -f db-statefulset.yaml
   kubectl apply -f redis-deployment.yaml
   ```

4. **Deploy Aplikasi**
   Pastikan image `netmanager-app:staging` sudah tersedia di registry Anda.
   ```bash
   kubectl apply -f app-deployment.yaml
   ```

5. **Konfigurasi Akses Luar**
   ```bash
   kubectl apply -f ingress-staging.yaml
   ```

## ⚠️ Catatan Penting
- **Cert-Manager**: Pastikan `cert-manager` sudah terinstal di cluster untuk otomatisasi SSL (Let's Encrypt).
- **Multiple Databases**: Jika aplikasi membutuhkan database terpisah untuk Radius, Billing, dan Mitra (seperti di Docker Compose), Anda bisa mereplikasi `db-statefulset.yaml` atau menggunakan managed database service.
- **Image Registry**: Sesuaikan field `image` di `app-deployment.yaml` dengan registry (Docker Hub/GHCR/private) yang Anda gunakan.
