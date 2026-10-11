#!/usr/bin/env bash
#
# Menyiapkan database uji untuk tes integrasi DB nyata (`npm run test:db`).
#
# Tes-tes itu menyentuh Postgres sungguhan karena ada perilaku yang TIDAK bisa
# dibuktikan dengan prisma yang di-mock: arti `notIn: []`, apakah sebuah unique
# index benar-benar menolak duplikat, dan apakah `ON DELETE SET NULL` memang
# melepas FK. Tiruan hanya mengulang asumsi penulisnya.
#
# Database uji SELALU terpisah dari database dev. Skrip ini tidak pernah
# menyentuh `netmanager`.
#
# Pakai:
#   ./scripts/setup-test-db.sh            # buat/migrasikan netmanager_test
#   ./scripts/setup-test-db.sh --recreate # buang dulu, lalu buat ulang
#
# Lalu:
#   npm run test:db
set -euo pipefail

NAMA_DB="${TEST_DB_NAME:-netmanager_test}"
KONTAINER="${TEST_DB_CONTAINER:-netmanager-postgres-app}"
PENGGUNA="${TEST_DB_USER:-netmgr}"

if ! docker ps --format '{{.Names}}' | grep -qx "$KONTAINER"; then
  echo "Kontainer '$KONTAINER' tidak berjalan. Jalankan 'npm run db:up' lebih dulu." >&2
  exit 1
fi

psql_sistem() {
  docker exec -i "$KONTAINER" psql -U "$PENGGUNA" -d postgres -v ON_ERROR_STOP=1 "$@"
}

if [[ "${1:-}" == "--recreate" ]]; then
  echo "Membuang database '$NAMA_DB'..."
  psql_sistem -c "DROP DATABASE IF EXISTS \"$NAMA_DB\";"
fi

ada=$(psql_sistem -tAc "SELECT 1 FROM pg_database WHERE datname = '$NAMA_DB';")
if [[ -z "$ada" ]]; then
  echo "Membuat database '$NAMA_DB'..."
  psql_sistem -c "CREATE DATABASE \"$NAMA_DB\";"
else
  echo "Database '$NAMA_DB' sudah ada."
fi

# Port dibaca dari DATABASE_URL dev supaya skrip ini ikut benar bila
# docker-compose dipetakan ke port lain.
PORT_DEV=$(sed -n 's|^DATABASE_URL="postgresql://[^@]*@[^:]*:\([0-9]*\)/.*|\1|p' .env | head -1)
SANDI_DEV=$(sed -n 's|^DATABASE_URL="postgresql://[^:]*:\([^@]*\)@.*|\1|p' .env | head -1)
URL_UJI="postgresql://${PENGGUNA}:${SANDI_DEV}@localhost:${PORT_DEV:-5432}/${NAMA_DB}?schema=public"

echo "Menerapkan migration ke database uji..."
DATABASE_URL="$URL_UJI" npx prisma migrate deploy

cat <<PESAN

Database uji siap.

  TEST_DATABASE_URL="$URL_UJI"

Jalankan tesnya:

  TEST_DATABASE_URL="$URL_UJI" npm run test:db

Tanpa TEST_DATABASE_URL, tes di tests/db/ dilewati — itu memang disengaja,
supaya 'npm test' dan CI (yang tidak punya Postgres) tetap hijau.
PESAN
