# PWA Setup untuk Portal Pelanggan

Portal pelanggan NetManager sekarang mendukung PWA (Progressive Web App), memungkinkan pelanggan untuk menginstall aplikasi di perangkat mobile mereka.

## Fitur PWA

- ✅ **Installable**: Pelanggan dapat menginstall aplikasi di home screen
- ✅ **Offline Support**: Service worker menyediakan caching untuk akses offline
- ✅ **App-like Experience**: Tampilan standalone tanpa browser UI
- ✅ **Fast Loading**: Caching resources untuk performa lebih cepat

## File yang Dibuat

1. **`public/pelanggan-manifest.json`**: Manifest file untuk PWA
2. **`public/pelanggan-sw.js`**: Service worker untuk caching dan offline support
3. **`app/pelanggan/pwa-script.tsx`**: Client component untuk register service worker
4. **`app/pelanggan/layout.tsx`**: Layout dengan metadata PWA
5. **`public/icon.svg`**: SVG icon placeholder (perlu dikonversi ke PNG)

## Setup Icon

Untuk membuat icon PWA, Anda perlu membuat file PNG:

1. **Ukuran yang diperlukan:**
   - `icon-192x192.png` (192x192 pixels)
   - `icon-512x512.png` (512x512 pixels)

2. **Cara membuat icon:**
   - Gunakan online tool: https://realfavicongenerator.net/
   - Upload `public/icon.svg`
   - Download dan simpan sebagai `icon-192x192.png` dan `icon-512x512.png` di folder `public/`

   Atau install sharp dan jalankan:
   ```bash
   npm install sharp --save-dev
   node scripts/generate-pwa-icons.js
   ```

## Testing PWA

1. **Development:**
   ```bash
   npm run dev
   ```

2. **Build Production:**
   ```bash
   npm run build
   npm start
   ```

3. **Test di Browser:**
   - Buka `http://localhost:3000/pelanggan` di Chrome/Edge
   - Buka DevTools > Application > Service Workers
   - Cek apakah service worker ter-register
   - Cek Application > Manifest untuk melihat manifest

4. **Test Install:**
   - Di Chrome/Edge mobile, buka portal pelanggan
   - Browser akan menampilkan prompt "Add to Home Screen"
   - Atau klik menu > "Install App"

## Service Worker

Service worker akan:
- Cache halaman `/pelanggan` dan `/pelanggan/login`
- Menyediakan offline support
- Update cache secara otomatis saat ada perubahan

## Manifest Configuration

- **Name**: NetManager - Portal Pelanggan
- **Short Name**: NetManager
- **Start URL**: `/pelanggan`
- **Display**: Standalone (fullscreen app-like)
- **Theme Color**: `#4f46e5` (Indigo)
- **Background Color**: `#ffffff` (White)

## Browser Support

- ✅ Chrome/Edge (Android & Desktop)
- ✅ Safari (iOS 11.3+)
- ✅ Firefox (Android)
- ⚠️ Safari iOS memiliki beberapa keterbatasan untuk PWA

## Troubleshooting

### Service Worker tidak ter-register
- Pastikan aplikasi dijalankan di HTTPS atau localhost
- Cek console browser untuk error
- Pastikan file `pelanggan-sw.js` dapat diakses di `/pelanggan-sw.js`

### Icon tidak muncul
- Pastikan file `icon-192x192.png` dan `icon-512x512.png` ada di folder `public/`
- Cek path di `pelanggan-manifest.json` sudah benar

### PWA tidak bisa diinstall
- Pastikan manifest.json valid (cek di DevTools > Application > Manifest)
- Pastikan service worker aktif
- Pastikan menggunakan HTTPS (kecuali localhost)

## Catatan

- Service worker hanya aktif untuk route `/pelanggan/*`
- API calls tidak di-cache untuk memastikan data selalu fresh
- Cache akan di-update otomatis saat service worker baru ter-install

