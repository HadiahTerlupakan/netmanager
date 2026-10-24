"use client";

import VpnCommandBox from "./VpnCommandBox";
import { VPN_CORE_LISTEN_PORT, VPN_HUB_CONTAINER } from "./vpnShared";

/** Dijalankan sebagai root; keluarannya dibandingkan dengan syarat di atasnya. */
const VPS_CHECK_COMMAND =
  'systemd-detect-virt; uname -r; modprobe wireguard && echo "wireguard OK"; modprobe l2tp_ppp && echo "l2tp OK"';

const BOX_CLASS =
  "rounded-lg border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-900/20 p-3 text-sm text-gray-700 dark:text-gray-300";

/** Syarat VPS sebelum formulir diisi; port mengikuti isian formulir. */
export function VpnServerRequirements({ listenPort }: { listenPort: string }) {
  return (
    <div className={`${BOX_CLASS} space-y-2`}>
      <p className="font-medium text-gray-900 dark:text-white">
        Sebelum mulai, pastikan VPS:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Virtualisasi KVM. VPS OpenVZ atau LXC tidak bisa dipakai karena
          WireGuard butuh kernel sendiri.
        </li>
        <li>Kernel Linux 5.6 atau lebih baru.</li>
        <li>
          Debian atau Ubuntu, kecuali Docker sudah terpasang. Docker dipasang
          otomatis bila belum ada.
        </li>
        <li>Bisa login sebagai root atau user dengan sudo.</li>
        <li>Punya IP publik tetap, atau domain yang menunjuk ke IP itu.</li>
        <li>
          Di firewall provider VPS: UDP {listenPort || "?"} terbuka untuk
          koneksi masuk, dan koneksi keluar ke UDP {VPN_CORE_LISTEN_PORT}{" "}
          diizinkan.
        </li>
        <li>Untuk L2TP/IPsec: UDP 500 dan 4500 terbuka untuk koneksi masuk.</li>
      </ul>
      <p>
        Cek VPS sebagai root. Hasil yang benar: <code>kvm</code>, versi kernel
        5.6 ke atas, lalu <code>wireguard OK</code>. <code>l2tp OK</code>{" "}
        opsional: tanpa itu server hanya melayani WireGuard.
      </p>
      <VpnCommandBox command={VPS_CHECK_COMMAND} />
    </div>
  );
}

/** Langkah setelah perintah instal muncul, dan yang dicek bila belum tersambung. */
export function VpnServerInstallSteps({ listenPort }: { listenPort: number }) {
  return (
    <div className={`${BOX_CLASS} space-y-3`}>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Login SSH ke VPS sebagai root atau user dengan sudo.</li>
        <li>
          Tempel perintah di bawah. Awali dengan satu spasi agar perintah, yang
          memuat kunci server, tidak tersimpan di riwayat shell.
        </li>
        <li>
          Tunggu sampai status di bawah menjadi &quot;Server tersambung&quot;,
          biasanya kurang dari satu menit setelah perintah selesai.
        </li>
        <li>
          Tetapkan server ini ke tenant lewat tombol &quot;Server VPN&quot; di
          daftar tenant, agar router tenant itu bisa memakainya.
        </li>
      </ol>
      <div>
        <p className="font-medium text-gray-900 dark:text-white">
          Belum tersambung juga?
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Pastikan UDP {listenPort} terbuka di firewall provider VPS, dan
            koneksi keluar ke UDP {VPN_CORE_LISTEN_PORT} tidak diblokir.
          </li>
          <li>
            Lihat log di VPS: <code>docker logs {VPN_HUB_CONTAINER}</code>
          </li>
          <li>
            Lewat 1 jam, perintah ini kedaluwarsa. Pakai tombol &quot;Buat ulang
            perintah instal&quot; di daftar server.
          </li>
        </ul>
      </div>
    </div>
  );
}
