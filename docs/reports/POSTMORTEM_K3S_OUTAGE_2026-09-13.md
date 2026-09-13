# Post-mortem — Gangguan k3s & DNS Cluster, 13 September 2026

- **Server**: `radpro` (31.56.30.53), k3s v1.34.4+k3s1, single node
- **Namespace terdampak**: `netmanager-production`, `lumeris-web`, `cattle-*`, `cert-manager`
- **Durasi dampak**: 00:02–00:06 UTC (07:02–07:06 WIB), ±4 menit
- **Status**: Pulih otomatis. Tidak ada kehilangan data.

---

## Ringkasan

Sesi perubahan jaringan manual pada host memicu k3s crash dua kali. Restart k3s
membuat seluruh pod kehilangan DNS cluster selama ±4 menit. Worker BullMQ dan
FreeRADIUS sempat mati total, keduanya pulih sendiri setelah k3s siap.

Insiden ini **bukan** kegagalan spontan dan **bukan** bug aplikasi.

---

## Linimasa (UTC)

| Waktu | Kejadian |
|---|---|
| 12 Sep 23:54 | `/etc/netplan/50-cloud-init.yaml` diedit manual (`nano`), lalu `netplan try` / `netplan apply` berulang |
| 12 Sep 23:55:02 | `systemd-networkd`: `ens18: Re-configuring with /run/systemd/network/10-netplan-ens18.network` (2×), `DHCPv6 lease lost` |
| 13 Sep 00:00–00:01:46 | DNS upstream (1.1.1.1, 8.8.8.8) tidak terjangkau. `systemd-resolved` turun-kelas berulang, lalu `Clock change detected. Flushing caches.` |
| 13 Sep 00:02–00:06 | Seluruh pod kehilangan DNS cluster |
| 13 Sep 00:05:21 | k3s crash #1 — `failed to start networking: unable to initialize network policy controller: error getting node subnet: failed to find interface with specified node ip` |
| 13 Sep 00:05:37 | k3s crash #2, pesan identik |
| 13 Sep 00:05:44 | systemd restart k3s (`restart counter is at 2`); banyak `containerd-shim` yatim tertinggal |
| 13 Sep 00:05:52 | `kube-proxy` mulai melaporkan `NodeIPs changed ... oldNodeIPs=["141.11.160.150"]` (IP server lama) |
| 13 Sep 00:06:20 | `netmanager-worker`: `[BullMQ] All workers started` — pulih |
| 13 Sep 00:06:37 | `netmanager-radius`: `Ready to process requests` — pulih |

---

## Akar masalah

`netplan apply` mengonfigurasi ulang `ens18` (interface utama). Selama proses itu
alamat interface sempat lepas. k3s mencari interface yang memegang node IP untuk
menginisialisasi network policy controller (kube-router), tidak menemukannya, lalu
mematikan diri. systemd me-restart k3s, dan restart itulah yang menjatuhkan DNS
cluster untuk semua pod.

**Perubahan jaringan pada interface utama host = restart k3s = outage cluster.**

---

## Dampak per komponen

| Komponen | Gejala | Pulih |
|---|---|---|
| `netmanager-app` (2 replika) | 44× `Redis EAI_AGAIN redis`, 38–40× `EAI_AGAIN db-netmanager`, Firebase `app/invalid-credential` (`EAI_AGAIN oauth2.googleapis.com`) | 00:06 |
| `netmanager-worker` | `[Redis] Failed to connect, workers not started` + `Failed to initialize Event Bus` — BullMQ mati total | 00:06:20 |
| `netmanager-radius` | exit 1 — `could not translate host name "db-radius" to address`, modul `sql` & `sqlippool` gagal diinstansiasi | 00:06:37 |
| Rancher stack | `rancher`, `gitjob`, `cert-manager-cainjector`, `system-upgrade-controller` CrashLoopBackOff; `rancher-webhook` sempat `failing closed` | 00:07 |

---

## Tindakan yang sudah dilakukan (13 Sep 2026)

1. **Hapus Job yatim `web-migrate-manual`** (ns `default`, milik lumeris).
   Job Prisma migrate dibuat 2026-08-03, image `lumeris-web:ab3f337` (versi jalan
   sekarang `f800ab7`), `ImagePullBackOff` 40 hari karena secret `ghcr-pull-secret`
   tidak ada. Membanjiri journal kubelet tiap ~13 detik.
   Hasil: journal k3s turun dari ratusan menjadi **21 baris / 5 menit**.

2. **CoreDNS dinaikkan ke 2 replika.** Sebelumnya 1 replika (SPOF, sudah restart 14×).
   Kedua pod `Running` dan terdaftar di EndpointSlice `kube-dns`.
   Resolusi diverifikasi dari dalam pod aplikasi: `redis`, `db-netmanager`, dan
   `oauth2.googleapis.com` semua resolve.

3. **Perbaikan kode `unhandledRejection` MixRadius** — lihat entri `[FIXED]` di
   `docs/CHANGELOG.md`. Belum ter-deploy ke produksi.

4. **Metadata cloud-init dipermanenkan ke IP baru.** Cache cloud-init masih
   mendeklarasikan jaringan lama. Sumbernya dua file:

   | File | Isi lama |
   |---|---|
   | `/var/lib/cloud/instances/iid-datasource-none/network-config.json` | `141.11.160.150/28`, gw `141.11.160.145`, DNS `113.192.0.3` & `113.192.1.3` |
   | `.../obj.pkl` → `sys_cfg['network']['ethernets']['ens18']` | idem (di-regenerate tiap boot dari config sistem) |

   Keduanya ditulis ulang ke kondisi nyata: `31.56.30.53/29`, gw `31.56.30.49`,
   DNS `1.1.1.1` & `8.8.8.8`. Dua file cache di `/run/cloud-init/`
   (`instance-data-sensitive.json`, `combined-cloud-config.json`) ikut disamakan.

   - Backup asli: `/root/cloudinit-backup-20260913-022227/` (termasuk netplan)
   - `obj.pkl` dipatch in-place lewat `pickle` — direktori instance, semaphore
     `sem/`, dan `instance-id` (`iid-datasource-none`) tidak diubah, jadi tidak
     ada risiko cloud-init menganggapnya instance baru dan mengulang modul first-boot
   - Permission dipertahankan (`obj.pkl` `0400 root`, `network-config.json` `0600 root`)
   - Integritas diverifikasi: `obj.pkl` masih ter-load sebagai `DataSourceNone`,
     kedua JSON di `/run` valid, dan `cloud-init query merged_cfg.network` sudah
     melaporkan `31.56.30.53/29`
   - **Jaringan hidup tidak disentuh** — tidak ada `netplan apply`/`try`. `ens18`
     tetap `31.56.30.53/29`, default route via `31.56.30.49`, gateway responsif
     (0.23 ms), 14 pod `netmanager-production` tetap `Running`

   Hasil: `grep -rl "141.11.160" /etc /var/lib/cloud /run/cloud-init` → kosong.

   Perlindungan sekarang berlapis tiga:
   1. `/etc/cloud/cloud.cfg.d/99-disable-network-config.cfg` → `network: {config: disabled}`,
      cloud-init tidak menulis netplan sama sekali
   2. Kalau lapis 1 hilang, `/etc/cloud/cloud.cfg.d/90-installer-network.cfg`
      (system config, presedensi tertinggi) sudah berisi IP baru
   3. Cache datasource yang dulu jadi sumber IP lama kini juga berisi IP baru

---

## Catatan penting

### CoreDNS 2 replika tidak mencegah insiden ini
Insiden dipicu matinya k3s itu sendiri; jumlah replika CoreDNS tidak relevan untuk
skenario tersebut. Nilainya ada di skenario lain: satu pod CoreDNS crash/OOM,
trafik tetap dilayani replika satunya.

### Scale CoreDNS bisa ter-reset saat upgrade k3s
k3s menulis ulang `/var/lib/rancher/k3s/server/manifests/coredns.yaml` setiap start,
dan deploy controller-nya melacak checksum isi file. Selama isi file tidak berubah,
`replicas=2` bertahan. **Saat versi k3s naik dan isi `coredns.yaml` berubah, replika
akan kembali ke 1** — jalankan ulang:

```bash
sudo k3s kubectl -n kube-system scale deploy coredns --replicas=2
```

Node ini single-node, jadi **jangan** tambahkan `podAntiAffinity` tipe
`requiredDuringSchedulingIgnoredDuringExecution` — replika kedua akan `Pending` selamanya.

### `NodeIPs changed` — noise, bukan gangguan
`kube-proxy` melaporkan `newNodeIPs=["31.56.30.53"] oldNodeIPs=["141.11.160.150"]`
tiap beberapa menit. Temuan:

- **Nol kejadian** dalam 13,5 jam sebelum restart; kejadian pertama **00:05:52**, 8 detik setelah k3s restart.
- IP lama **tidak ada** di objek k8s manapun (node, endpoints, endpointslices, services), tidak ada di config k3s (`node-args` hanya `["server"]`), dan hostname `radpro` resolve ke `127.0.1.1`.
- Sisa jejak IP lama di disk: metadata cloud-init (`merged_cfg/network/ethernets/ens18/addresses[0] = 141.11.160.150/28`) dan env `GAME_API_BASE_URL` milik lumeris di containerd — keduanya tidak dibaca kube-proxy.
- Per source Kubernetes 1.34 (`pkg/proxy/node.go`), node IP diambil dari `node.Status.Addresses` dan cache `n.nodeIPs` tidak pernah di-reset — sehingga transisi yang sama ter-log berulang tanpa aksi.
- Sejak 00:07 **tidak ada satu pun error aplikasi** yang berkorelasi dengan log ini.

Kesimpulan: kosmetik. Satu-satunya cara membersihkan adalah restart k3s — yang
justru merupakan penyebab outage pagi ini. **Tidak dieksekusi.**
Sumber seed nilai lama itu belum berhasil dipastikan.

---

## Isu terbuka (belum dikerjakan)

| Isu | Dampak | Catatan |
|---|---|---|
| **Login MixRadius gagal** | `/api/mobile/mixradius/customers` → 500. 6× sejak 00:07 | `[MixRadius] Login response did not reach dashboard`, user `rudihartono`, endpoint `sblnet.topsetting.com:973`. Kredensial/endpoint eksternal — di luar kode kita |
| **GenieACS mati** | `/api/acs/devices` → 502 | `AcsDeviceService listDevices failed ECONNREFUSED localhost:7557` |
| **`GAME_API_BASE_URL` lumeris menunjuk IP lama** | Game API lumeris kemungkinan tidak terjangkau | Env pod `lumeris-web` (`web` & `worker`): `http://141.11.160.150:34061`. Server game-nya (`lumeris-map`) jalan di box ini pada port 34061, tapi dialamatkan lewat IP lama. **Di luar scope netmanager** — perlu update deployment lumeris |
| **`DNSConfigForming`** | `Nameserver limits were exceeded` → `1.1.1.1 8.8.8.8 1.1.1.1` | Resolver ketiga duplikat, mubazir |

---

## Rekomendasi

1. **Perubahan netplan di host = perlakukan sebagai maintenance window.** `netplan apply`
   pada `ens18` menjatuhkan k3s. Kalau harus, jadwalkan di jam sepi dan siapkan
   verifikasi pasca-perubahan.
2. **Pertimbangkan `Restart=always` + `RestartSec` lebih panjang** atau health-gate
   sebelum k3s start, supaya k3s tidak start saat interface belum stabil.
3. **Bersihkan resource yatim secara berkala** — Job `ImagePullBackOff` 40 hari
   membanjiri journal dan menyulitkan diagnosis insiden nyata.
