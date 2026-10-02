#!/usr/bin/env bash
# Daftarkan N self-hosted runner GitHub Actions untuk satu repo di host ini, masing-
# masing sebagai service systemd (user `runner`). Idempoten: runner yang sudah ada
# dilewati; `--replace` menimpa pendaftaran lama bernama sama di GitHub.
#
# Pakai (di VM):
#   sudo bash daftarkan-runner.sh <owner/repo> <jumlah> <registration-token>
# Token didapat (berlaku 1 jam, bisa dipakai untuk semua runner repo itu):
#   gh api -X POST repos/<owner/repo>/actions/runners/registration-token --jq .token
#
# Label `radpro-ci` dipakai workflow lewat variabel repo CI_RUNS_ON.

set -euo pipefail

REPO="${1:?owner/repo wajib}"
JUMLAH="${2:?jumlah runner wajib}"
TOKEN="${3:?registration token wajib}"

RUNNER_USER="runner"
RUNNER_VERSION="2.337.0"
LABEL="radpro-ci"
ANDROID_SDK_ROOT_DIR="/opt/android-sdk"
BASIS="/home/${RUNNER_USER}/runners"
ARSIP="/opt/actions-runner-cache/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo." >&2; exit 1; }

if [ ! -f "${ARSIP}" ]; then
  mkdir -p "$(dirname "${ARSIP}")"
  curl -fsSL -o "${ARSIP}" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
fi

NAMA_REPO="${REPO##*/}"
for i in $(seq 1 "${JUMLAH}"); do
  nama="$(hostname)-${NAMA_REPO}-${i}"
  dir="${BASIS}/${NAMA_REPO}-${i}"
  if [ -f "${dir}/.runner" ]; then
    echo "==> ${nama}: sudah terdaftar, dilewati"
    continue
  fi
  echo "==> ${nama}"
  mkdir -p "${dir}"
  tar -xzf "${ARSIP}" -C "${dir}"
  # installdependencies.sh memakai jalur relatif ./bin; libicu74 dari pasang-host-runner.sh sudah cukup.
  (cd "${dir}" && ./bin/installdependencies.sh > /dev/null 2>&1 || true)
  chown -R "${RUNNER_USER}:${RUNNER_USER}" "${dir}"

  # Variabel yang di runner GitHub sudah tersedia dari image-nya.
  cat > "${dir}/.env" <<EOF
LANG=C.UTF-8
ANDROID_HOME=${ANDROID_SDK_ROOT_DIR}
ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT_DIR}
EOF
  chown "${RUNNER_USER}:${RUNNER_USER}" "${dir}/.env"

  sudo -u "${RUNNER_USER}" "${dir}/config.sh" --unattended --replace \
    --url "https://github.com/${REPO}" --token "${TOKEN}" \
    --name "${nama}" --labels "${LABEL}" --work _work > /dev/null

  (cd "${dir}" && ./svc.sh install "${RUNNER_USER}" > /dev/null && ./svc.sh start > /dev/null)
done

systemctl list-units --type=service --no-legend 'actions.runner.*' | awk '{print $1, $3, $4}'
