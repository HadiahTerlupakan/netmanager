#!/usr/bin/env bash
#
# Verifikasi pasca-migrasi server produksi ke lokasi/IP baru.
#
# Jalankan DI SERVER PRODUKSI:
#   sudo bash scripts/post-migration-check.sh
#
# Skrip ini hanya membaca, tidak mengubah apa pun. Setiap pemeriksaan mandiri:
# satu kegagalan tidak menghentikan sisanya, supaya sekali jalan langsung
# terlihat semua yang rusak.

set -uo pipefail

DOMAIN="${DOMAIN:-radpro.id}"
NAMESPACE="${NAMESPACE:-netmanager-production}"
RADIUS_NODEPORT="${RADIUS_NODEPORT:-30812}"

lolos=0
gagal=0

lapor() {
  # $1 = status (OK|GAGAL|INFO), $2 = judul, $3 = keterangan
  case "$1" in
    OK) printf '  [ OK ]   %-38s %s\n' "$2" "$3"; lolos=$((lolos + 1)) ;;
    GAGAL) printf '  [GAGAL]  %-38s %s\n' "$2" "$3"; gagal=$((gagal + 1)) ;;
    *) printf '  [info]   %-38s %s\n' "$2" "$3" ;;
  esac
}

echo "=== Verifikasi pasca-migrasi $(date -u '+%Y-%m-%d %H:%M UTC') ==="
echo

# ---------------------------------------------------------------------------
echo "1. Identitas jaringan"
IP_HOST="$(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | head -1)"
IP_KELUAR="$(curl -sS --max-time 15 https://api.ipify.org 2>/dev/null || echo "")"
lapor INFO "IP pada antarmuka" "${IP_HOST:-tidak terbaca}"
lapor INFO "IP keluar (egress)" "${IP_KELUAR:-tidak terbaca}"

IP_DNS="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | head -1)"
if [ -n "$IP_DNS" ] && [ "$IP_DNS" = "$IP_HOST" ]; then
  lapor OK "DNS $DOMAIN" "$IP_DNS (cocok dengan host)"
else
  lapor GAGAL "DNS $DOMAIN" "menunjuk ${IP_DNS:-?}, host ${IP_HOST:-?} — perbarui A record di Cloudflare"
fi

# ---------------------------------------------------------------------------
echo
echo "2. Kubernetes"
if kubectl get node >/dev/null 2>&1; then
  NODE_IP="$(kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null)"
  if [ "$NODE_IP" = "$IP_HOST" ]; then
    lapor OK "InternalIP node" "$NODE_IP"
  else
    lapor GAGAL "InternalIP node" "masih $NODE_IP — restart k3s agar menyesuaikan"
  fi

  SAN="$(openssl x509 -in /var/lib/rancher/k3s/server/tls/serving-kube-apiserver.crt \
        -noout -text 2>/dev/null | grep -o 'IP Address:[0-9.]*' | cut -d: -f2 | tr '\n' ' ')"
  if echo "$SAN" | grep -q "$IP_HOST"; then
    lapor OK "SAN sertifikat API" "memuat $IP_HOST"
  else
    lapor GAGAL "SAN sertifikat API" "hanya [$SAN] — hapus serving-kube-apiserver.crt/.key lalu restart k3s"
  fi

  BELUM_SIAP="$(kubectl -n "$NAMESPACE" get pods --no-headers 2>/dev/null | grep -cvE 'Running|Completed')"
  if [ "${BELUM_SIAP:-1}" -eq 0 ]; then
    lapor OK "Pod di $NAMESPACE" "semua Running"
  else
    lapor GAGAL "Pod di $NAMESPACE" "$BELUM_SIAP pod tidak Running"
  fi
else
  lapor GAGAL "Akses kubectl" "tidak bisa menghubungi API server"
fi

# ---------------------------------------------------------------------------
echo
echo "3. Layanan menghadap pelanggan"
KODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOMAIN" 2>/dev/null)"
if [ "$KODE" = "200" ]; then
  lapor OK "https://$DOMAIN" "http 200"
else
  lapor GAGAL "https://$DOMAIN" "http ${KODE:-tidak merespons}"
fi

HABIS="$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
lapor INFO "Sertifikat TLS berlaku sampai" "${HABIS:-tidak terbaca}"

# RADIUS: pelanggan PPPoE gagal autentikasi kalau jalur ini putus, dan NAS di
# MikroTik masih menunjuk IP lama.
#
# NodePort di k3s dilayani aturan iptables, bukan proses yang membuka socket,
# jadi `ss -lun` tidak akan pernah menemukannya — yang membuktikan jalurnya
# hidup adalah adanya endpoint pod plus aturan iptables untuk port tersebut.
EP="$(kubectl -n "$NAMESPACE" get endpoints netmanager-radius \
      -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null)"
ATURAN="$(iptables-save 2>/dev/null | grep -c "$RADIUS_NODEPORT")"
if [ -n "$EP" ] && [ "${ATURAN:-0}" -gt 0 ]; then
  lapor OK "RADIUS NodePort $RADIUS_NODEPORT" "endpoint $EP, $ATURAN aturan iptables"
else
  lapor GAGAL "RADIUS NodePort $RADIUS_NODEPORT" "endpoint '${EP:-kosong}', aturan iptables ${ATURAN:-0}"
fi
lapor INFO "NAS MikroTik" "pastikan menunjuk ${IP_HOST:-IP baru}, bukan IP lama"

# ---------------------------------------------------------------------------
echo
echo "4. Jalur keluar yang dipakai deploy"
for target in "https://ghcr.io/v2/" "https://registry-1.docker.io/v2/"; do
  nama="$(echo "$target" | cut -d/ -f3)"
  waktu="$(curl -sS -o /dev/null -w '%{time_total}' --max-time 20 "$target" 2>/dev/null)"
  if [ -n "$waktu" ]; then
    lapor OK "Jangkau $nama" "${waktu}s"
  else
    lapor GAGAL "Jangkau $nama" "tidak merespons"
  fi
done

# Throughput sesungguhnya, bukan sekadar terjangkau: rute yang buruk baru
# terlihat pada transfer besar, bukan pada permintaan kecil.
LAJU="$(curl -sS -o /dev/null -w '%{speed_download}' --max-time 60 \
       'https://speed.cloudflare.com/__down?bytes=20971520' 2>/dev/null)"
if [ -n "$LAJU" ] && [ "${LAJU%.*}" -gt 1000000 ] 2>/dev/null; then
  lapor OK "Unduh 20 MB" "$(( ${LAJU%.*} / 1048576 )) MB/s"
else
  lapor GAGAL "Unduh 20 MB" "$(( ${LAJU%.*:-0} / 1024 )) KB/s — terlalu lambat untuk tarik image"
fi

# ---------------------------------------------------------------------------
echo
echo "=== Ringkasan: $lolos lolos, $gagal gagal ==="
if [ "$gagal" -gt 0 ]; then
  echo
  echo "Yang tidak diperiksa skrip ini karena berada di luar server:"
  echo "  - Secret DEPLOY_SSH_TARGET dan DEPLOY_KNOWN_HOSTS di Gitea Actions"
  echo "    (keduanya terikat IP lama; deploy akan gagal verifikasi host)"
  echo "  - Konfigurasi NAS RADIUS pada router MikroTik"
  exit 1
fi
echo "Semua pemeriksaan di server lolos. Sisa yang manual: secret Gitea dan NAS MikroTik."
