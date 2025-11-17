# Generate PWA Icons

Untuk membuat icon PWA, Anda perlu membuat file PNG dengan ukuran:
- `icon-192x192.png` (192x192 pixels)
- `icon-512x512.png` (512x512 pixels)

## Cara Membuat Icon

### Opsi 1: Menggunakan Online Tool
1. Kunjungi https://realfavicongenerator.net/ atau https://www.pwabuilder.com/imageGenerator
2. Upload logo atau gambar NetManager
3. Download icon yang sudah di-generate
4. Simpan sebagai `icon-192x192.png` dan `icon-512x512.png` di folder `public/`

### Opsi 2: Menggunakan ImageMagick (jika terinstall)
```bash
# Convert SVG ke PNG
convert -background none -resize 192x192 public/icon.svg public/icon-192x192.png
convert -background none -resize 512x512 public/icon.svg public/icon-512x512.png
```

### Opsi 3: Menggunakan Design Tool
1. Buka Figma, Adobe Illustrator, atau design tool lainnya
2. Buat icon dengan ukuran 512x512 pixels
3. Export sebagai PNG dengan ukuran 192x192 dan 512x512
4. Simpan di folder `public/`

## Catatan
- Icon harus memiliki background yang solid atau transparan
- Icon akan digunakan sebagai app icon saat user menginstall PWA
- Pastikan icon terlihat jelas di berbagai ukuran

