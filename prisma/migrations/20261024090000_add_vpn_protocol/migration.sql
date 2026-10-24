-- ALTER di bawah tidak boleh menunggu lama di belakang transaksi panjang:
-- antrean kuncinya ikut memblokir semua akses ke tabel router. Bila habis
-- waktu, jalankan ulang job migrasi.
SET lock_timeout = '5s';

-- Protokol VPN sebuah router: WireGuard atau L2TP/IPsec.
CREATE TYPE "VpnProtocol" AS ENUM ('WIREGUARD', 'L2TP');

-- Router yang ada tetap memakai WireGuard lewat nilai bawaan kolom.
ALTER TABLE "MikroTikRouter" ADD COLUMN     "vpnProtocol" "VpnProtocol" NOT NULL DEFAULT 'WIREGUARD';

-- Protokol yang dilayani hub, cermin dari core; hub yang ada hanya WireGuard sampai core melaporkan lain.
ALTER TABLE "vpn_servers" ADD COLUMN     "protocols" TEXT[] DEFAULT ARRAY['wireguard']::TEXT[];
