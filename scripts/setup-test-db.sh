#!/usr/bin/env bash
#
# Menyiapkan database uji untuk tes integrasi DB nyata (`npm run test:db`):
# `netmanager_test` di kontainer app dan `billing_test` di kontainer billing.
#
# Tes-tes itu menyentuh Postgres sungguhan karena ada perilaku yang TIDAK bisa
# dibuktikan dengan prisma yang di-mock: arti `notIn: []`, apakah sebuah unique
# index benar-benar menolak duplikat, dan apakah `ON DELETE SET NULL` memang
# melepas FK. Tiruan hanya mengulang asumsi penulisnya.
#
# Database uji SELALU terpisah dari database dev. Skrip ini tidak pernah
# menyentuh `netmanager` maupun `billing`.
#
# Pakai:
#   ./scripts/setup-test-db.sh            # buat/migrasikan kedua database uji
#   ./scripts/setup-test-db.sh --recreate # buang dulu, lalu buat ulang
#
# Lalu:
#   npm run test:db
set -euo pipefail

NAMA_DB="${TEST_DB_NAME:-netmanager_test}"
KONTAINER="${TEST_DB_CONTAINER:-netmanager-postgres-app}"
NAMA_DB_BILLING="${TEST_DB_BILLING_NAME:-billing_test}"
KONTAINER_BILLING="${TEST_DB_BILLING_CONTAINER:-netmanager-postgres-billing}"
PENGGUNA="${TEST_DB_USER:-netmgr}"

for kontainer in "$KONTAINER" "$KONTAINER_BILLING"; do
  if ! docker ps --format '{{.Names}}' | grep -qx "$kontainer"; then
    echo "Kontainer '$kontainer' tidak berjalan. Jalankan 'npm run db:up' lebih dulu." >&2
    exit 1
  fi
done

# Tanpa `-i`: SQL dioper lewat `-c`, dan `docker exec -i` akan menelan stdin
# skrip ini.
psql_sistem() {
  local kontainer="$1"
  shift
  docker exec "$kontainer" psql -U "$PENGGUNA" -d postgres -v ON_ERROR_STOP=1 "$@" </dev/null
}

# Buat (atau buat ulang dengan --recreate) satu database uji di kontainernya.
siapkan_db() {
  local kontainer="$1" nama="$2" opsi="$3"
  if [[ "$opsi" == "--recreate" ]]; then
    echo "Membuang database '$nama'..."
    psql_sistem "$kontainer" -c "DROP DATABASE IF EXISTS \"$nama\";"
  fi

  local ada
  ada=$(psql_sistem "$kontainer" -tAc "SELECT 1 FROM pg_database WHERE datname = '$nama';")
  if [[ -z "$ada" ]]; then
    echo "Membuat database '$nama'..."
    psql_sistem "$kontainer" -c "CREATE DATABASE \"$nama\";"
  else
    echo "Database '$nama' sudah ada."
  fi
}

siapkan_db "$KONTAINER" "$NAMA_DB" "${1:-}"
siapkan_db "$KONTAINER_BILLING" "$NAMA_DB_BILLING" "${1:-}"

# Port dan sandi dibaca dari URL dev supaya skrip ini ikut benar bila
# docker-compose dipetakan ke port lain.
port_dari() {
  sed -n "s|^$1=\"postgresql://[^@]*@[^:]*:\([0-9]*\)/.*|\1|p" .env | head -1
}
sandi_dari() {
  sed -n "s|^$1=\"postgresql://[^:]*:\([^@]*\)@.*|\1|p" .env | head -1
}
URL_UJI="postgresql://${PENGGUNA}:$(sandi_dari DATABASE_URL)@localhost:$(port_dari DATABASE_URL)/${NAMA_DB}?schema=public"
URL_UJI_BILLING="postgresql://${PENGGUNA}:$(sandi_dari DATABASE_URL_BILLING)@localhost:$(port_dari DATABASE_URL_BILLING)/${NAMA_DB_BILLING}?schema=public"

echo "Menerapkan migration ke database uji..."
DATABASE_URL="$URL_UJI" npx prisma migrate deploy
DATABASE_URL_BILLING="$URL_UJI_BILLING" npx prisma migrate deploy --config=prisma.billing.config.ts

cat <<PESAN

Database uji siap.

  TEST_DATABASE_URL="$URL_UJI"
  TEST_DATABASE_URL_BILLING="$URL_UJI_BILLING"

Jalankan tesnya:

  TEST_DATABASE_URL="$URL_UJI" TEST_DATABASE_URL_BILLING="$URL_UJI_BILLING" npm run test:db

Tanpa TEST_DATABASE_URL, tes di tests/db/ dilewati — itu memang disengaja,
supaya 'npm test' dan CI (yang tidak punya Postgres) tetap hijau. Tes yang
menyentuh invoice juga dilewati tanpa TEST_DATABASE_URL_BILLING.
PESAN
