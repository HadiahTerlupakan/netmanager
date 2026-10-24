# VPN MikroTik — Hasil Spike

Uji lab 2026-10-23 dengan service netmanager-vpn (bukan prototipe tangan):
core dan dua hub di radpro, satu router uji. Tanpa nilai rahasia.

## Lingkungan

| Bagian | Nilai |
| --- | --- |
| Router uji | RouterOS 7.24.5 (stable), CHR x86_64 di QEMU. Bukan perangkat ARM seperti router lapangan |
| Policy routing di router | 2 rule (milik script), 0 mangle |
| VPS | radpro, kernel 5.15.0-191-generic, KVM, modul `wireguard` termuat |
| Core | k3s namespace `netmanager-vpn`, hostNetwork, `wg-core` 10.99.0.1 UDP 51822 |
| Hub A | container Docker bridge di radpro, UDP 51821, backhaul 10.99.0.2 |
| Hub B | container Docker bridge di radpro, UDP 51823, backhaul 10.99.0.3 |

Kedua hub di radpro memakai jaringan bridge, bukan `--network host` seperti
`install-hub.sh`: hub dengan host network memasang route `10.100.0.0/14` dan
`wg-up` di namespace host, bertabrakan dengan route core di host yang sama.
Hub di VPS sendiri tetap memakai skrip instal biasa.

## Hasil

| Uji | Hasil |
| --- | --- |
| Script dari core di-import | berhasil, handshake langsung |
| Ping router → core | 0% loss, sekitar 1,3–1,4 ms |
| MTU | 1352 byte dengan DF lolos; 1392 ditolak (batas `wg-up` 1380) |
| API router dari pod netmanager-app | login 380 ms; `/log print` 1000 baris (~220 KB) 105 ms |
| Sumber koneksi API di log router | 10.99.0.1, jadi hub tidak me-NAT |
| Router → 10.99.0.1:7480 (API core) | diblokir |
| Tempel ulang script | berhasil; jumlah objek WireGuard, alamat, route, rule, table, script, scheduler tidak berubah |
| Pindah hub A → B | router pindah sekitar 35 detik setelah hub A berhenti (dua cek gagal berselang 20 detik); core mencatat event dan hub aktif B sekitar 9 detik kemudian; ping lewat hub B 0% loss; API router terjangkau dari pod |
| Hub A hidup lagi | router tetap di hub B (disengaja, tidak ada kembali ke hub pertama) |
| RADIUS dan PPPoE lewat tunnel | belum diuji; perlu integrasi netmanager di produksi |

## Temuan di luar dugaan

1. **Policy script dan scheduler harus memuat `policy`.** Dengan
   `read,write,test`, RouterOS 7.24.5 memberi tiap run scheduler global yang
   kosong. Penghitung gagal selalu 1 dan router tidak pernah pindah hub.
   Bisect: `read,write,test` dan `+sensitive` gagal, `+policy` berhasil.
   Diperbaiki di netmanager-vpn PR #3.
2. **Tanda gagal harus per `host|port`.** Dengan tanda per host, dua hub di
   satu IP (hub A dan B di radpro) ikut tertandai bersama, lalu skrip memilih
   lagi hub pertama yang mati. Diperbaiki di netmanager-vpn PR #4 dan
   diverifikasi di router uji.
3. `join` hub butuh `NET_ADMIN` walau hanya menyimpan konfigurasi: tanpa itu
   langkah reconcile gagal membuat `wg-up`, meski konfigurasinya sudah
   tersimpan di `state.db`.

## Sisa

- Uji RADIUS dan PPPoE lewat tunnel, termasuk sumber request di log
  `netmanager-radius` (harus alamat `/32` router).
- Uji di router ARM lapangan; router uji adalah CHR.

## L2TP/IPsec di radpro (2026-10-24)

Spike sekali pakai untuk tahap 1 rancangan multi-protokol
(`2026-10-23-vpn-multi-protocol-design.md`). Container sementara di radpro,
router uji yang sama. Container, image, dan client uji sudah dihapus.

| Bagian | Nilai |
| --- | --- |
| Container | Docker bridge, `-p 500:500/udp -p 4500:4500/udp --device /dev/ppp --cap-add NET_ADMIN`, Alpine 3.22 |
| Daemon | accel-ppp 1.13.0-r1 (paket Alpine community) untuk L2TP, strongSwan 5.9.14 (swanctl, IKEv1, PSK, transport `udp/1701`) |
| Modul host | `ppp_generic l2tp_ppp l2tp_netlink esp4 xfrm_user af_key nft_fib_inet nft_xfrm` dimuat dengan modprobe; tetap termuat |

| Uji | Hasil |
| --- | --- |
| Tunnel lewat DNAT Docker | tersambung dalam 2 detik; NAT-T di UDP 4500 (hub terlihat di belakang NAT karena alamat container 172.17.0.x) |
| Proposal yang disepakati dengan default `l2tp-client` | IKE AES-CBC-128/SHA1/MODP2048; ESP AES-CBC-256/HMAC-SHA1/MODP1024 (PFS) |
| Alamat | router `10.100.255.250/32` dari `chap-secrets`, hub `10.99.0.250`; hub punya route `/32` via `ppp1` |
| MTU | 1380 dengan DF lolos; 1381 ditolak di router (`max-mtu=1380`) |
| L2TP hanya di dalam IPsec | `udp dport 1701 meta ipsec missing drop` diterima kernel; semua paket L2TP terhitung `meta ipsec exists` |
| Anti-spoof | `iifname "ppp*" fib saddr . iif oif missing drop` menjatuhkan ping bersumber `192.0.2.99` (counter 3 paket) |
| `set connect-to` ke nilai baru | client langsung putus ("administrator request") dan login ulang; nilai yang sama tidak memicu apa pun |
| Memutus satu sesi | `accel-cmd terminate ip <alamat>`; router login ulang sendiri dalam 3 detik |
| Versi | hanya 7.24.5 tersedia di lab; versi minimum sementara 7.24.5 |

## Temuan L2TP di luar dugaan

1. **`fib` hanya di hook prerouting pada kernel 5.15.** Di chain input dan
   forward, kernel menolak aturan `fib` dengan "Not supported", baik dari
   nft 1.1.3 maupun 1.0.7. Aturan anti-spoof hub harus berada di chain
   prerouting (prioritas -150), yang mencakup paket ke hub dan yang
   diteruskan. `meta ipsec` diterima di input.
2. **accel-ppp menolak semua panggilan L2TP tanpa `[client-ip-range]`.**
   Dengan `0.0.0.0/0` ia mematikan pengaman soft-lockup kernel, jadi rentang
   yang dipakai adalah semua alamat kecuali `10.0.0.0/8` (semua alamat sesi
   ada di 10/8).
3. **Router login ulang dalam detik setelah sesinya diputus.** Mencabut atau
   mengganti protokol router harus menghapus kredensialnya dari
   `chap-secrets` sebelum memutus sesi, atau router langsung masuk lagi.
4. Di router yang masih punya rule `netmanager-vpn` WireGuard, tujuan
   `10.99.0.0/24` tetap dibelokkan ke table `netmanager-vpn`. Ping uji lewat
   L2TP butuh rule itu dimatikan sementara. Di script L2TP sungguhan, route
   table yang sama menunjuk ke interface L2TP, jadi ini hanya gejala lab.
