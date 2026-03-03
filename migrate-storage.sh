#!/bin/bash
# Script untuk memformat /dev/sdb dan memigrasi data container (K3s, Docker, Containerd) ke disk tersebut
# HARAP JALANKAN SEBAGAI ROOT (sudo bash migrate-storage.sh)

set -e

# Pastikan script dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then
  echo "Harap jalankan script ini dengan sudo (misal: sudo bash migrate-storage.sh)"
  exit 1
fi

echo "========================================================="
echo "Mulai proses migrasi penyimpanan Container ke /dev/sdb..."
echo "========================================================="

# 1. Format disk /dev/sdb menjadi ext4 jika belum terformat
if lsblk -f | grep sdb | grep -q ext4; then
    echo "[1/6] Disk /dev/sdb sudah diformat ext4. Melewati format..."
else
    echo "[1/6] Memformat /dev/sdb sebagai ext4..."
    mkfs.ext4 -F /dev/sdb
fi

# 2. Buat direktori mount dan mount disk sementara
echo "[2/6] Mempersiapkan titik mount di /data-storage..."
mkdir -p /data-storage
# Pastikan tidak ada yang mounted di /data-storage
mountpoint -q /data-storage && umount /data-storage || true
mount /dev/sdb /data-storage

# Dapatkan UUID disk untuk fstab
UUID=$(blkid -s UUID -o value /dev/sdb)

# Tambahkan ke fstab jika belum ada agar otomatis mount saat reboot
if ! grep -q "$UUID" /etc/fstab; then
    echo "UUID=$UUID /data-storage ext4 defaults 0 2" >> /etc/fstab
fi

# 3. Hentikan service container
echo "[3/6] Menghentikan service K3s, Docker, dan Containerd (Aplikasi akan mati sementara)..."
systemctl stop k3s || true
systemctl stop docker docker.socket || true
systemctl stop containerd || true

# 4. Sinkronisasi data lama ke disk baru
echo "[4/6] Menyalin data K3s, Docker, dan Containerd ke disk baru (Proses ini mungkin memakan waktu menit)..."
mkdir -p /data-storage/docker
mkdir -p /data-storage/containerd
mkdir -p /data-storage/k3s

# Pindahkan isi jika ukurannya besar (menggunakan rsync agar aman)
if [ -d /var/lib/docker ]; then
    rsync -aqxP /var/lib/docker/ /data-storage/docker/
    mv /var/lib/docker /var/lib/docker.old
fi

if [ -d /var/lib/containerd ]; then
    rsync -aqxP /var/lib/containerd/ /data-storage/containerd/
    mv /var/lib/containerd /var/lib/containerd.old
fi

if [ -d /var/lib/rancher/k3s ]; then
    rsync -aqxP /var/lib/rancher/k3s/ /data-storage/k3s/
    mv /var/lib/rancher/k3s /var/lib/rancher/k3s.old
fi

# 5. Buat symlink dari path asli ke path baru di /data-storage
echo "[5/6] Membuat symbolic link ke disk baru..."
ln -s /data-storage/docker /var/lib/docker
ln -s /data-storage/containerd /var/lib/containerd
ln -s /data-storage/k3s /var/lib/rancher/k3s

# 6. Mulai kembali seluruh services
echo "[6/6] Menyalakan kembali system container..."
systemctl start containerd
systemctl start docker
systemctl start k3s

echo "========================================================="
echo "Migrasi SELESAI! ✔"
echo "Anda bisa mengecek storage baru dengan perintah: df -h"
echo "Catatan: File asli (/var/lib/docker.old, dsb) masih ada sebagai backup."
echo "         Silakan hapus file *.old jika semuanya sudah berjalan normal"
echo "         selama beberapa hari."
echo "========================================================="
