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
