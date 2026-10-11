"use client";

import { useState } from "react";
import { HiOutlineArrowUpTray } from "react-icons/hi2";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import {
  bolehMenerbitkanPeta,
  type PlanningStatus,
} from "@/modules/planning/client";

interface PanelPenerbitanPetaProps {
  statusPlanning: PlanningStatus;
  /** Izin `planning:update`; izin `map:create` baru diketahui dari jawaban server. */
  dapatMenerbitkan: boolean;
  jumlahTitikRencana: number;
  jumlahJalurRencana: number;
  sedangMenerbitkan: boolean;
  onTerbitkan: () => void;
}

/**
 * Penerbitan peta rencana ke topologi operasional.
 *
 * Tombolnya hanya ada saat status rencana memang mengizinkan — daftarnya
 * dibaca dari `bolehMenerbitkanPeta` di domain, daftar yang sama yang
 * ditegakkan service, bukan salinannya. Sebelum ini endpoint penerbitan tidak
 * punya pemanggil mana pun: rencana bisa digambar, dihitung, dan disetujui,
 * lalu hanya `curl` yang bisa menerbitkannya.
 *
 * Tindakannya memasukkan baris ke topologi operasional dan tidak ada tombol
 * "batalkan terbit", jadi dikonfirmasi lebih dulu.
 */
export function PanelPenerbitanPeta({
  statusPlanning,
  dapatMenerbitkan,
  jumlahTitikRencana,
  jumlahJalurRencana,
  sedangMenerbitkan,
  onTerbitkan,
}: PanelPenerbitanPetaProps) {
  const [konfirmasiTerbuka, setKonfirmasiTerbuka] = useState(false);

  if (!dapatMenerbitkan) return null;

  const statusMengizinkan = bolehMenerbitkanPeta(statusPlanning);
  const adaYangBisaTerbit = jumlahTitikRencana + jumlahJalurRencana > 0;

  const konfirmasi = () => {
    setKonfirmasiTerbuka(false);
    onTerbitkan();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Terbitkan ke peta jaringan
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Titik dan jalur rencana berhenti menjadi usulan dan muncul di peta
          jaringan operasional. Pelanggan baru bisa disambungkan ke ODP-nya, dan
          titiknya tidak bisa lagi diubah dari rencana ini.
        </p>
      </div>

      {statusMengizinkan ? (
        <>
          <Button
            size="sm"
            loading={sedangMenerbitkan}
            disabled={sedangMenerbitkan || !adaYangBisaTerbit}
            onClick={() => setKonfirmasiTerbuka(true)}
          >
            <HiOutlineArrowUpTray className="h-4 w-4" />
            Terbitkan titik rencana
          </Button>
          {!adaYangBisaTerbit && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Belum ada titik atau jalur rencana yang menunggu diterbitkan.
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Rencana berstatus {statusPlanning} belum bisa diterbitkan. Titik
          rencana baru boleh masuk peta jaringan setelah rencananya disetujui.
        </p>
      )}

      <ConfirmDialog
        open={konfirmasiTerbuka}
        title="Terbitkan titik rencana?"
        description={`${jumlahTitikRencana} titik dan ${jumlahJalurRencana} jalur akan masuk ke peta jaringan operasional dan berhenti ditandai sebagai rencana. Tidak ada tombol untuk membatalkannya.`}
        confirmText="Terbitkan"
        cancelText="Batal"
        onConfirm={konfirmasi}
        onCancel={() => setKonfirmasiTerbuka(false)}
      />
    </div>
  );
}
