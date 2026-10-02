#!/usr/bin/env bash
# Siapkan VM Ubuntu 24.04 sebagai host self-hosted runner GitHub Actions untuk
# netmanager & mobile-netmanager. Idempoten: aman dijalankan berulang.
#
# Yang disiapkan (meniru isi runner GitHub `ubuntu-24.04` yang dipakai workflow):
#   - user `runner` (sudo tanpa password, grup docker) — workflow memakai sudo
#     (mis. swapon / rm di build-android.yml) seperti di runner GitHub.
#   - Docker Engine + buildx (gitleaks, build image backend).
#   - Android cmdline-tools di /opt/android-sdk; platform/NDK/cmake dipasang
#     sendiri oleh workflow lewat sdkmanager.
#   - swap 8 GB (build Android + 4 shard tes bersamaan).
#   - pembersihan Docker mingguan supaya disk tidak penuh.
# Node & JDK untuk build diunduh setup-node / setup-java per job. JDK 17 headless di
# host hanya dipakai sdkmanager di sini (menerima lisensi Android sekali).
#
# Pakai (di VM, sebagai user ber-sudo):  sudo bash pasang-host-runner.sh

set -euo pipefail

RUNNER_USER="runner"
ANDROID_SDK_ROOT_DIR="/opt/android-sdk"
# Versi cmdline-tools dipatok supaya host bisa dibangun ulang dengan hasil sama.
CMDLINE_TOOLS_ZIP="commandlinetools-linux-13114758_latest.zip"
SWAP_FILE="/swapfile"
SWAP_SIZE="8G"

[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo." >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "==> Paket dasar"
apt-get -qq update
apt-get -qq -y install \
  ca-certificates curl git gnupg jq unzip zip xz-utils build-essential \
  python3 python3-venv libicu74 rsync openjdk-17-jdk-headless > /dev/null

echo "==> Docker Engine + buildx"
if ! command -v docker > /dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get -qq update
  apt-get -qq -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin > /dev/null
fi
systemctl enable --now docker > /dev/null

echo "==> User ${RUNNER_USER}"
id "${RUNNER_USER}" > /dev/null 2>&1 || useradd --create-home --shell /bin/bash "${RUNNER_USER}"
usermod -aG docker "${RUNNER_USER}"
echo "${RUNNER_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/91-${RUNNER_USER}"
chmod 440 "/etc/sudoers.d/91-${RUNNER_USER}"

echo "==> Android cmdline-tools di ${ANDROID_SDK_ROOT_DIR}"
if [ ! -x "${ANDROID_SDK_ROOT_DIR}/cmdline-tools/latest/bin/sdkmanager" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL "https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP}" -o "${tmp}/tools.zip"
  unzip -q "${tmp}/tools.zip" -d "${tmp}"
  mkdir -p "${ANDROID_SDK_ROOT_DIR}/cmdline-tools"
  rm -rf "${ANDROID_SDK_ROOT_DIR}/cmdline-tools/latest"
  mv "${tmp}/cmdline-tools" "${ANDROID_SDK_ROOT_DIR}/cmdline-tools/latest"
  rm -rf "${tmp}"
fi
chown -R "${RUNNER_USER}:${RUNNER_USER}" "${ANDROID_SDK_ROOT_DIR}"
# Lisensi diterima sekali agar sdkmanager di workflow tidak berhenti menunggu input.
sudo -u "${RUNNER_USER}" bash -c "yes | ${ANDROID_SDK_ROOT_DIR}/cmdline-tools/latest/bin/sdkmanager --sdk_root=${ANDROID_SDK_ROOT_DIR} --licenses > /dev/null" || true
[ -d "${ANDROID_SDK_ROOT_DIR}/licenses" ] || { echo "Lisensi Android belum diterima" >&2; exit 1; }

echo "==> Swap ${SWAP_SIZE}"
# Installer Ubuntu biasanya sudah membuat /swap.img; swap kedua hanya membuang disk.
if [ -z "$(swapon --show --noheadings)" ]; then
  [ -f "${SWAP_FILE}" ] || fallocate -l "${SWAP_SIZE}" "${SWAP_FILE}"
  chmod 600 "${SWAP_FILE}"
  mkswap "${SWAP_FILE}" > /dev/null
  swapon "${SWAP_FILE}"
  grep -q "^${SWAP_FILE} " /etc/fstab || echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
fi

echo "==> Pembersihan Docker mingguan"
cat > /etc/cron.weekly/docker-prune-ci <<'EOF'
#!/bin/sh
# Image/cache build lama menumpuk tiap run CI; sisakan yang dipakai 7 hari terakhir.
docker system prune --all --force --filter "until=168h" > /dev/null 2>&1
docker builder prune --all --force --filter "until=168h" > /dev/null 2>&1
EOF
chmod 755 /etc/cron.weekly/docker-prune-ci

echo "==> Selesai"
docker --version
docker buildx version | head -1
"${ANDROID_SDK_ROOT_DIR}/cmdline-tools/latest/bin/sdkmanager" --version
swapon --show
