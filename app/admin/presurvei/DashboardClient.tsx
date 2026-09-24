"use client";

import { usePermission } from "@/hooks/use-permission";

import {
  CorongDashboard,
  KegiatanTerbaru,
  ProspekTakBertuan,
  RingkasanPencapaian,
} from "./BagianDashboard";
import { tentukanBagianDashboard } from "./ringkasanDashboard";

/**
 * Dashboard presurvei: corong, prospek tak bertuan, pencapaian bulan berjalan,
 * dan kegiatan terbaru.
 *
 * Izin diperiksa per bagian, bukan hanya per halaman: bagian yang endpoint-nya
 * menolak pemakai tidak dipasang sama sekali, sehingga query-nya tidak pernah
 * dikirim.
 */
export function DashboardClient() {
  const { hasPermission } = usePermission();
  const bagian = tentukanBagianDashboard(hasPermission);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Presurvei
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ringkasan corong prospek, pencapaian, dan kegiatan terbaru
        </p>
      </div>

      <CorongDashboard judul={bagian.judulCorong} />

      <div className="grid gap-6 lg:grid-cols-2">
        {bagian.canLihatTakBertuan && <ProspekTakBertuan />}
        {bagian.canLihatLaporan && <RingkasanPencapaian />}
        <KegiatanTerbaru
          judul={bagian.judulKegiatan}
          canLihatPemisahanPeran={bagian.canLihatPemisahanPeran}
        />
      </div>
    </div>
  );
}
