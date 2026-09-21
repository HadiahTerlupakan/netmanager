#!/usr/bin/env bash
#
# Menjaga cache dev Next.js tetap sehat sebelum `npm run dev`.
#
# Dua masalah nyata yang ditemukan 2026-09-21 di mesin pengembang macOS:
#
# 1. Spotlight mengindeks `.next`. Turbopack menulis puluhan ribu berkas ke
#    sana terus-menerus dan `mds` mengejar setiap penulisan, sehingga Next.js
#    sendiri mencetak "Slow filesystem detected (418ms)". Penanda
#    `.metadata_never_index` mematikan pengindeksan untuk direktori itu — tetapi
#    ikut terhapus setiap kali `.next` dibersihkan, jadi harus dibuat ulang.
#
# 2. Cache membengkak sampai 39 GB tanpa disadari. Dampaknya diukur pada route
#    yang SUDAH terkompilasi: 13,7 detik dengan cache gemuk versus 0,06 detik
#    setelah dibersihkan — 228x. Membaca cache-nya sendiri yang jadi beban,
#    bukan kompilasinya.
#
# Skrip ini tidak pernah menghapus apa pun sendiri; ia hanya memperingatkan.
# Cache aman dibuang kapan saja dengan `rm -rf .next`.

set -euo pipefail

CACHE_DIR=".next"
BATAS_GB=10

mkdir -p "$CACHE_DIR"

# Penanda Spotlight hanya berarti di macOS; di OS lain tidak berefek apa-apa.
if [ "$(uname -s)" = "Darwin" ]; then
  touch "$CACHE_DIR/.metadata_never_index"
fi

ukuran_gb=$(du -sg "$CACHE_DIR" 2>/dev/null | awk '{print $1}')
ukuran_gb=${ukuran_gb:-0}

if [ "$ukuran_gb" -ge "$BATAS_GB" ]; then
  printf '\n⚠  Cache dev .next sudah %s GB (ambang %s GB).\n' "$ukuran_gb" "$BATAS_GB"
  printf '   Cache sebesar ini justru MEMPERLAMBAT dev — ongkos bacanya melebihi\n'
  printf '   ongkos kompilasi ulang. Bersihkan dengan:  rm -rf .next\n\n'
fi
