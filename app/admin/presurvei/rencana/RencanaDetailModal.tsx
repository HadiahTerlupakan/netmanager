"use client";

import { useState } from "react";
import { HiOutlineCalendarDays, HiOutlineXCircle } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { Modal } from "@/components/ui/Modal";

import { penutupModalDitahanSaatMenyimpan } from "../penutupModal";
import { FormBatalRencana, FormUbahRencana } from "./RencanaAksiForm";
import { RincianRencana } from "./RincianRencana";
import { isRencanaTerbuka } from "./tampilanRencana";
import { useKirimRencana } from "./useKirimRencana";
import { useRincianRencanaQuery } from "./useRincianRencanaQuery";

/** Isi modal yang sedang tampil. */
type ModeDetail = "lihat" | "ubah" | "batal";

const JUDUL_MODE: Record<ModeDetail, string> = {
  lihat: "Rincian Rencana",
  ubah: "Jadwal Ulang Rencana",
  batal: "Batalkan Rencana",
};

interface RencanaDetailModalProps {
  rencanaId: string;
  /** Pemakai berhak `presurvei_rencana:update`. */
  canUbah: boolean;
  onClose: () => void;
}

/**
 * Modal rincian rencana beserta laporannya, dengan aksi jadwal ulang dan
 * batal untuk rencana yang masih terbuka. Rinciannya diambil ulang dari
 * server — bukan dari baris tabel — karena laporan hanya ada di rincian.
 */
export function RencanaDetailModal({
  rencanaId,
  canUbah,
  onClose,
}: RencanaDetailModalProps) {
  const [mode, setMode] = useState<ModeDetail>("lihat");
  const { rincian, isLoading, isError } = useRincianRencanaQuery(rencanaId);
  const kembaliKeRincian = () => setMode("lihat");
  const pengirim = useKirimRencana(kembaliKeRincian);
  const tutup = penutupModalDitahanSaatMenyimpan(pengirim.isMenyimpan, onClose);

  const pindahMode = (modeBaru: ModeDetail) => {
    pengirim.bersihkanPesanServer();
    setMode(modeBaru);
  };

  const isAksiTersedia =
    canUbah && rincian !== undefined && isRencanaTerbuka(rincian.statusTampil);

  return (
    <Modal isOpen onClose={tutup} title={JUDUL_MODE[mode]} size="2xl">
      {isLoading && <Skeleton className="h-64 w-full" />}
      {isError && (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Rincian rencana gagal dimuat.
        </p>
      )}
      {rincian && mode === "lihat" && (
        <div className="space-y-5">
          <RincianRencana rincian={rincian} />
          {isAksiTersedia && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
              <Button
                type="button"
                variant="destructive"
                onClick={() => pindahMode("batal")}
              >
                <HiOutlineXCircle className="h-4 w-4" />
                Batalkan
              </Button>
              <Button type="button" onClick={() => pindahMode("ubah")}>
                <HiOutlineCalendarDays className="h-4 w-4" />
                Jadwal ulang / Ubah
              </Button>
            </div>
          )}
        </div>
      )}
      {rincian && mode === "ubah" && (
        <FormUbahRencana
          rencana={rincian}
          pengirim={pengirim}
          onKembali={() => pindahMode("lihat")}
        />
      )}
      {rincian && mode === "batal" && (
        <FormBatalRencana
          rencana={rincian}
          pengirim={pengirim}
          onKembali={() => pindahMode("lihat")}
        />
      )}
    </Modal>
  );
}
