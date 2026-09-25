#!/usr/bin/env bash
# Deploy netmanager ke cluster produksi — dijalankan DI host produksi.
#
# Dipanggil GitHub Actions lewat SSH dengan kunci yang terkunci ke skrip ini
# (`command="/usr/local/bin/netmanager-deploy",restrict` di authorized_keys).
# Satu-satunya masukan adalah SHA commit. Semua yang lain — tag image, manifes,
# keabsahan commit — diturunkan sendiri dari repo publik GitHub, sehingga kunci
# yang bocor paling jauh hanya bisa men-deploy ulang commit yang memang ada di
# `main`. Tidak ada shell, kubectl bebas, atau manifes kiriman pemanggil.
#
# Isi langkahnya pindahan dari `.gitea/workflows/deploy-production.yml` (lihat
# riwayat git berkas itu untuk alasan tiap pengaman), kini berjalan lokal.
#
# Pemakaian:
#   lewat SSH (GitHub Actions):  ssh radpro-deploy <sha-40>
#   manual darurat di host:      netmanager-deploy <sha-40> --izinkan-tanpa-cadangan
#     (bendera itu hanya dihormati bila skrip TIDAK dipanggil lewat forced command)

set -euo pipefail

REPO_GITHUB="HadiahTerlupakan/netmanager"
CABANG_PRODUKSI="main"
NAMESPACE="netmanager-production"
REGISTRY="ghcr.io/hadiahterlupakan"
DIR_CADANGAN="/var/backups/netmanager"
BERKAS_KUNCI="/tmp/netmanager-deploy.lock"
# Dump sehat berukuran puluhan MB; ambang ini hanya menyaring arsip yang
# praktis kosong karena aliran putus di awal.
UKURAN_CADANGAN_MINIMUM=1024
RETENSI_CADANGAN_HARI=7
# Image netmanager-app yang ditahan di node: yang berjalan + dua sasaran rollback.
JUMLAH_IMAGE_DISIMPAN=3
# Harus lebih panjang daripada activeDeadlineSeconds Job migrasi (3600).
BATAS_TUNGGU_MIGRASI_DETIK=3900
BATAS_ROLLOUT="420s"
K="sudo -n kubectl -n ${NAMESPACE}"

gagal() {
  echo "::error::$*" >&2
  exit 1
}

# --- Masukan ---------------------------------------------------------------
# Lewat forced command, argumen datang dari SSH_ORIGINAL_COMMAND dan hanya
# token pertama yang dipakai; argumen tambahan dari pemanggil jarak jauh
# diabaikan agar tidak ada jalan melewati cadangan dari luar.
IZIN_TANPA_CADANGAN=false
if [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
  read -r SHA _ <<< "${SSH_ORIGINAL_COMMAND}"
else
  SHA="${1:-}"
  if [ "${2:-}" = "--izinkan-tanpa-cadangan" ]; then
    IZIN_TANPA_CADANGAN=true
  fi
fi

[[ "${SHA}" =~ ^[0-9a-f]{40}$ ]] || gagal "Masukan harus SHA commit 40 karakter heksadesimal"

# Deploy tidak boleh ikut mati saat koneksi SSH putus (job GitHub dibatalkan
# atau kena batas waktu) — migrasi yang berhenti di tengah apply lebih mahal
# daripada deploy yang tetap selesai. Skrip menjalankan dirinya ulang di sesi
# baru dengan keluaran ke berkas log permanen; sesi SSH hanya mengikuti log itu
# dan mewarisi status keluarnya. Log juga menjadi catatan setiap deploy,
# termasuk pemakaian --izinkan-tanpa-cadangan.
if [ -z "${NETMANAGER_DEPLOY_TERLEPAS:-}" ]; then
  DIR_LOG="${DIR_CADANGAN}/log"
  mkdir -p "${DIR_LOG}"
  BERKAS_LOG="${DIR_LOG}/$(date +%Y%m%d_%H%M%S)_${SHA:0:12}.log"
  argumen=("${SHA}")
  [ "${IZIN_TANPA_CADANGAN}" = "true" ] && argumen+=("--izinkan-tanpa-cadangan")
  NETMANAGER_DEPLOY_TERLEPAS=1 setsid -w "$0" "${argumen[@]}" > "${BERKAS_LOG}" 2>&1 < /dev/null &
  PID_DEPLOY=$!
  echo "Log deploy: ${BERKAS_LOG}"
  tail --pid="${PID_DEPLOY}" -n +1 -f "${BERKAS_LOG}" || true
  wait "${PID_DEPLOY}"
  exit $?
fi

# Satu deploy dalam satu waktu. Deploy kedua menunggu, bukan ditolak, supaya
# dua push beruntun sama-sama sampai.
exec 9> "${BERKAS_KUNCI}"
echo "Menunggu giliran deploy..."
flock 9

api_github() {
  curl -fsS --retry 3 --retry-delay 5 \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO_GITHUB}/$1"
}

# --- 1. Commit harus ada di cabang produksi --------------------------------
# Commit dari fork juga bisa dijangkau lewat URL repo induk, jadi keberadaan
# commit saja tidak cukup: ia harus leluhur (atau sama dengan) `main`.
echo "Verifikasi commit ${SHA} ada di ${CABANG_PRODUKSI}"
STATUS_BANDING="$(api_github "compare/${SHA}...${CABANG_PRODUKSI}" | jq -r '.status + " " + (.behind_by|tostring)')"
case "${STATUS_BANDING}" in
  "ahead 0"|"identical 0") ;;
  *) gagal "Commit ${SHA} bukan bagian dari ${CABANG_PRODUKSI} (${STATUS_BANDING}); deploy ditolak" ;;
esac

# --- 2. Tag image diturunkan, bukan diterima --------------------------------
# Rumusnya harus sama persis dengan build-image.yml: 12 karakter commit +
# epoch committer. Sufiks yang menaik menjaga pemangkasan image tetap benar.
TANGGAL_COMMIT="$(api_github "commits/${SHA}" | jq -r '.commit.committer.date')"
EPOCH_COMMIT="$(date -u -d "${TANGGAL_COMMIT}" +%s)"
TAG="${SHA:0:12}-${EPOCH_COMMIT}"
APP_IMAGE="${REGISTRY}/netmanager-app:${TAG}"
CRON_IMAGE="${REGISTRY}/netmanager-cron:${TAG}"
RADIUS_IMAGE="${REGISTRY}/netmanager-radius:${TAG}"
echo "Tag image: ${TAG}"

# --- 3. Manifes diambil dari commit itu sendiri -----------------------------
KERJA="$(mktemp -d)"
trap 'rm -rf "${KERJA}"' EXIT
curl -fsSL --retry 3 "https://codeload.github.com/${REPO_GITHUB}/tar.gz/${SHA}" \
  | tar -xz -C "${KERJA}" --strip-components=1 --wildcards '*/k8s/*'
[ -f "${KERJA}/k8s/migration-job.yaml" ] || gagal "Arsip commit tidak memuat k8s/migration-job.yaml"

mkdir -p "${KERJA}/rendered"
for manifest in "${KERJA}"/k8s/production/*.yaml "${KERJA}/k8s/migration-job.yaml"; do
  [ -f "$manifest" ] || continue
  # Template placeholder di repo tidak pernah di-apply: menimpa secret hidup.
  case "$(basename "$manifest")" in
    secrets.yaml|registry-secret.yaml) continue ;;
  esac
  sed \
    -e "s|{{APP_IMAGE}}|${APP_IMAGE}|g" \
    -e "s|{{CRON_IMAGE}}|${CRON_IMAGE}|g" \
    -e "s|{{RADIUS_IMAGE}}|${RADIUS_IMAGE}|g" \
    -e "s|{{NAMESPACE}}|${NAMESPACE}|g" \
    -e "s|{{IMAGE_TAG}}|${APP_IMAGE}|g" \
    -e "s|{{REGISTRY_SECRET}}|${NAMESPACE}-registry|g" \
    "$manifest" > "${KERJA}/rendered/$(basename "$manifest")"
done
if grep -rlF -e '{{APP_IMAGE}}' -e '{{CRON_IMAGE}}' -e '{{RADIUS_IMAGE}}' "${KERJA}/rendered/"; then
  gagal "Render manifes menyisakan placeholder"
fi

# --- 4. Image harus sudah ada di registry -----------------------------------
# Dicek memakai kredensial pull cluster sendiri, sehingga yang lolos di sini
# pasti bisa ditarik kubelet — bukan ImagePullBackOff setelah apply.
KREDENSIAL_PULL="$(${K} get secret "${NAMESPACE}-registry" -o jsonpath='{.data.\.dockerconfigjson}' \
  | base64 -d | jq -r '.auths | to_entries[0].value | .username + ":" + .password')"
image_tersedia() {
  local nama="$1" token
  token="$(curl -fsS -u "${KREDENSIAL_PULL}" "https://ghcr.io/token?scope=repository:hadiahterlupakan/${nama}:pull" | jq -r .token)"
  curl -fsS -o /dev/null \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json" \
    "https://ghcr.io/v2/hadiahterlupakan/${nama}/manifests/${TAG}"
}
for nama in netmanager-app netmanager-cron netmanager-radius; do
  image_tersedia "${nama}" || gagal "Image ${nama}:${TAG} tidak ada di registry"
done
echo "Ketiga image tersedia."

# --- 5. Preflight produksi ---------------------------------------------------
echo "Preflight 1/3 — kesehatan node"
KUERI_NODE='{range .items[*]}{.metadata.name}{"="}{range .status.conditions[*]}{.type}={.status}{" "}{end}{"\n"}{end}'
NODE="$(sudo -n kubectl get nodes -o jsonpath="${KUERI_NODE}")"
printf '%s\n' "${NODE}"
# here-string, bukan pipa: di bawah pipefail, SIGPIPE dari `grep -q` membuat
# kondisi salah dan node tidak sehat malah diloloskan.
if grep -Eq "Ready=False|DiskPressure=True" <<< "${NODE}"; then
  sudo -n kubectl describe nodes >&2 || true
  sudo -n kubectl top nodes >&2 || true
  gagal "Node produksi tidak sehat (Ready=False atau DiskPressure=True); deploy dibatalkan sebelum menyentuh cluster."
fi

echo "Preflight 2/3 — secret pull registry"
${K} get secret "${NAMESPACE}-registry" > /dev/null 2>&1 \
  || gagal "Secret pull registry ${NAMESPACE}-registry belum ada di namespace ${NAMESPACE}"

echo "Preflight 3/3 — secret runtime bukan placeholder"
${K} get secret netmanager-secrets > /dev/null 2>&1 \
  || gagal "Secret netmanager-secrets tidak ada di namespace ${NAMESPACE}"
NILAI_CRON="$(${K} get secret netmanager-secrets -o jsonpath='{.data.CRON_SECRET}' | base64 -d | tr -d '\r\n')"
if [ -z "${NILAI_CRON}" ] || [ "${NILAI_CRON}" = "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY" ]; then
  gagal "CRON_SECRET pada netmanager-secrets masih placeholder atau kosong"
fi
unset NILAI_CRON
echo "Preflight lolos."

# --- 6. Cadangan keempat database sebelum migrasi ---------------------------
batalkan_atau_lanjut() {
  if [ "${IZIN_TANPA_CADANGAN}" = "true" ]; then
    echo "::warning::Cadangan $1 gagal, migrasi tetap lanjut karena --izinkan-tanpa-cadangan"
    return 0
  fi
  gagal "Cadangan pra-migrasi gagal ($1); migrasi dibatalkan sebelum menyentuh basis data."
}

STEMPEL="$(date +%Y%m%d_%H%M%S)"
sudo -n mkdir -p "${DIR_CADANGAN}"
sudo -n chown "$(id -u):$(id -g)" "${DIR_CADANGAN}"
for NAMA_URL in DATABASE_URL RADIUS_DATABASE_URL DATABASE_URL_BILLING DATABASE_URL_MITRA; do
  MENTAH="${DIR_CADANGAN}/${STEMPEL}_${NAMA_URL}.sql"
  BERKAS="${MENTAH}.gz"
  echo "Mencadangkan ${NAMA_URL} ke ${BERKAS}"
  # Tanpa pipa: status `pg_dump | gzip` adalah status gzip, jadi dump yang
  # terpotong tetap menghasilkan arsip sah. Query string Prisma dibuang karena
  # ditolak libpq.
  if ! ${K} exec deployment/netmanager-app -- sh -c "pg_dump \"\$(printenv ${NAMA_URL} | sed \"s/?.*//\")\" --no-owner --no-privileges" > "${MENTAH}"; then
    rm -f "${MENTAH}"
    batalkan_atau_lanjut "${NAMA_URL}: pg_dump"
    continue
  fi
  if ! gzip -f "${MENTAH}"; then
    rm -f "${MENTAH}" "${BERKAS}"
    batalkan_atau_lanjut "${NAMA_URL}: kompresi"
    continue
  fi
  if ! { gzip -t "${BERKAS}" && [ "$(stat -c %s "${BERKAS}")" -ge "${UKURAN_CADANGAN_MINIMUM}" ]; }; then
    batalkan_atau_lanjut "${NAMA_URL}: arsip tidak utuh"
    continue
  fi
  echo "Cadangan ${NAMA_URL} utuh."
done
find "${DIR_CADANGAN}" -name '*.sql.gz' -mtime +"${RETENSI_CADANGAN_HARI}" -delete 2>/dev/null || true

# --- 7. Migrasi --------------------------------------------------------------
# Job bersifat immutable, jadi yang lama dihapus dulu.
${K} delete job netmanager-migration-job --ignore-not-found
${K} apply -f "${KERJA}/rendered/migration-job.yaml"
echo "Menunggu migrasi selesai..."
# Complete DAN Failed dipantau sekaligus: `kubectl wait` untuk Complete saja
# tidak pernah kembali saat Job gagal.
batas=$((SECONDS + BATAS_TUNGGU_MIGRASI_DETIK))
while :; do
  selesai="$(${K} get job/netmanager-migration-job -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null || true)"
  gagal_job="$(${K} get job/netmanager-migration-job -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null || true)"
  [ "${selesai}" = "True" ] && break
  if [ "${gagal_job}" = "True" ] || [ "${SECONDS}" -ge "${batas}" ]; then
    ${K} describe job netmanager-migration-job >&2 || true
    POD="$(${K} get pods -l job-name=netmanager-migration-job -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
    if [ -n "${POD}" ]; then
      ${K} describe pod "${POD}" >&2 || true
      ${K} logs "${POD}" --tail=100 >&2 || true
    fi
    gagal "Migrasi gagal atau melewati batas waktu"
  fi
  sleep 10
done
echo "Migrasi selesai."

# --- 8. Terapkan manifes dan tunggu rollout ---------------------------------
for manifest in "${KERJA}"/rendered/*.yaml; do
  [ "$(basename "$manifest")" = "migration-job.yaml" ] && continue
  echo "apply $(basename "$manifest")"
  ${K} apply -f "$manifest"
done
for deployment in netmanager-app netmanager-worker netmanager-cron netmanager-radius; do
  echo "menunggu ${deployment}"
  ${K} rollout status "deploy/${deployment}" --timeout="${BATAS_ROLLOUT}"
done

# Rollout bisa dilaporkan sukses padahal manifes lama yang terpasang.
AKTIF="$(${K} get deploy netmanager-app -o jsonpath='{.spec.template.spec.containers[0].image}')"
echo "aktif   : ${AKTIF}"
echo "harusnya: ${APP_IMAGE}"
[ "${AKTIF}" = "${APP_IMAGE}" ] || gagal "Image aktif tidak sesuai setelah rollout"

# --- 9. Pangkas image aplikasi lama di node ---------------------------------
# Hanya netmanager-app (cron/radius berbagi satu image id). Apa pun yang masih
# dirujuk workload tidak disentuh.
REPO_IMAGE=netmanager-app
dipakai="$(sudo -n kubectl get pods,deploy,statefulset,cronjob,job -A \
  -o jsonpath='{range .items[*]}{.spec.template.spec.containers[*].image}{"\n"}{.spec.containers[*].image}{"\n"}{end}' 2>/dev/null \
  | tr ' ' '\n' | grep "${REPO_IMAGE}:" | sed 's/.*://' | sort -u || true)"
# Sufiks tag menaik (nomor run lama, epoch commit sekarang), jadi urut numerik
# sufiks = urut terbaru ke terlama.
semua="$(sudo -n crictl images 2>/dev/null | awk -v r="${REPO_IMAGE}" '$1 ~ r"$" {print $2" "$3}' | sort -t- -k2 -rn || true)"
jumlah="$(printf '%s\n' "${semua}" | grep -c . || true)"
echo "image ${REPO_IMAGE} di node: ${jumlah}, disimpan: ${JUMLAH_IMAGE_DISIMPAN}"
if [ "${jumlah}" -gt "${JUMLAH_IMAGE_DISIMPAN}" ]; then
  printf '%s\n' "${semua}" | tail -n +$((JUMLAH_IMAGE_DISIMPAN + 1)) | while read -r tag id; do
    [ -n "${id}" ] || continue
    # Here-string, BUKAN pipa ke `grep -q` (lihat tests/ci/pipefail-safety).
    if grep -qx "${tag}" <<< "${dipakai}"; then
      echo "  lewati ${tag} — masih dirujuk workload"
      continue
    fi
    if sudo -n crictl --timeout 300s rmi "${id}" > /dev/null 2>&1; then
      echo "  hapus ${tag}"
    else
      echo "  GAGAL menghapus ${tag} (${id})"
    fi
  done
fi
df -h / | tail -1

echo "Deploy ${TAG} selesai."
