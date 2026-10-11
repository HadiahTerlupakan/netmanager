#!/usr/bin/env bash
#
# Memperbaiki checksum migration yang tercatat di `_prisma_migrations`.
#
# MASALAHNYA. Prisma mencatat sha256 dari `migration.sql` saat sebuah migration
# diterapkan. Bila berkasnya kemudian disunting — reformat, perbaikan komentar,
# apa pun — hash yang tercatat tidak lagi cocok, dan `prisma migrate dev`
# menolak berjalan sampai itu diselesaikan. Di database dev proyek ini dua
# migration lama mengalaminya.
#
# YANG BERBAHAYA, dan karena itu dijaga. Mengganti hash yang tercatat akan
# MENYEMBUNYIKAN divergensi skema yang sungguhan: kalau berkasnya disunting agar
# melakukan hal yang berbeda, database tidak akan pernah menyusul, dan
# memperbarui hash-nya membuat Prisma berhenti mengeluh soal itu selamanya.
#
# Karena itu skrip ini menolak bekerja sebelum `prisma migrate diff`
# membuktikan struktur database sudah sama persis dengan `schema.prisma`. Kalau
# strukturnya cocok, hash yang tercatat memang satu-satunya yang basi, dan
# memperbaruinya aman. Kalau tidak, yang Anda punya adalah drift skema sungguhan
# dan skrip ini bukan jawabannya.
#
# Skrip ini TIDAK PERNAH menyentuh database produksi: ia menolak URL yang bukan
# localhost, dan menuntut konfirmasi tertulis sebelum menulis.
#
# Pakai:
#   ./scripts/repair-migration-checksum.sh --check     # hanya laporan
#   ./scripts/repair-migration-checksum.sh --repair    # perbaiki setelah lolos
set -euo pipefail

MODE="${1:---check}"
URL_DB="${DATABASE_URL:-$(sed -n 's|^DATABASE_URL="\(.*\)"|\1|p' .env | head -1)}"
KONTAINER="${TEST_DB_CONTAINER:-netmanager-postgres-app}"
PENGGUNA="${TEST_DB_USER:-netmgr}"

if [[ -z "$URL_DB" ]]; then
  echo "DATABASE_URL tidak ditemukan." >&2
  exit 1
fi

if [[ "$URL_DB" != *"@localhost:"* && "$URL_DB" != *"@127.0.0.1:"* ]]; then
  echo "DATABASE_URL bukan localhost. Skrip ini hanya untuk database lokal." >&2
  exit 1
fi

NAMA_DB=$(printf '%s' "$URL_DB" | sed -n 's|.*/\([^/?]*\)\(?.*\)\{0,1\}$|\1|p')
echo "Database: $NAMA_DB"

# Tanpa `-i`, dan dengan stdin ditutup: SQL selalu dioper lewat `-c`, sementara
# `docker exec -i` akan MENELAN stdin skrip ini — termasuk jawaban konfirmasi
# di bawah, yang membuat perbaikan diam-diam tidak pernah berjalan.
psql_db() {
  docker exec "$KONTAINER" psql -U "$PENGGUNA" -d "$NAMA_DB" -v ON_ERROR_STOP=1 "$@" </dev/null
}

# ── 1. Cari migration yang checksum-nya basi ────────────────────────────────
declare -a BASI=()
while IFS='|' read -r nama tercatat; do
  [[ -z "$nama" ]] && continue
  berkas="prisma/migrations/$nama/migration.sql"
  [[ -f "$berkas" ]] || continue
  benar=$(shasum -a 256 "$berkas" | cut -d' ' -f1)
  if [[ "$tercatat" != "$benar" ]]; then
    BASI+=("$nama|$benar")
    echo "  basi: $nama"
    echo "        tercatat $tercatat"
    echo "        berkas   $benar"
  fi
done < <(psql_db -tAc "SELECT migration_name, checksum FROM _prisma_migrations ORDER BY migration_name;")

if [[ ${#BASI[@]} -eq 0 ]]; then
  echo "Tidak ada checksum yang basi."
  exit 0
fi

echo
echo "${#BASI[@]} migration dengan checksum basi."

# ── 2. Penjaga: struktur database harus sudah sama dengan schema.prisma ─────
echo
echo "Memeriksa apakah strukturnya memang sudah sama dengan schema.prisma..."
DIFF=$(DATABASE_URL="$URL_DB" npx prisma migrate diff \
  --from-config-datasource --to-schema prisma/schema.prisma 2>&1)

if ! grep -q "No difference detected" <<<"$DIFF"; then
  cat <<PESAN >&2

DITOLAK. Struktur database TIDAK sama dengan schema.prisma:

$DIFF

Yang Anda hadapi adalah drift SKEMA, bukan sekadar checksum basi. Memperbarui
hash hanya akan membungkam Prisma dan membuat perbedaan itu menetap. Selesaikan
perbedaan di atas lebih dulu.
PESAN
  exit 1
fi
echo "Struktur cocok — checksum memang satu-satunya yang basi."

if [[ "$MODE" != "--repair" ]]; then
  echo
  echo "Hanya laporan. Jalankan dengan --repair untuk memperbaiki."
  exit 0
fi

# ── 3. Perbaiki ─────────────────────────────────────────────────────────────
echo
read -r -p "Perbarui ${#BASI[@]} checksum di '$NAMA_DB'? Ketik 'perbaiki': " jawab
if [[ "$jawab" != "perbaiki" ]]; then
  echo "Dibatalkan."
  exit 1
fi

for entri in "${BASI[@]}"; do
  nama="${entri%%|*}"
  benar="${entri##*|}"
  psql_db -c "UPDATE _prisma_migrations SET checksum = '$benar' WHERE migration_name = '$nama';"
  echo "  diperbarui: $nama"
done

echo
echo "Selesai. 'npx prisma migrate dev' seharusnya tidak lagi terhalang."
