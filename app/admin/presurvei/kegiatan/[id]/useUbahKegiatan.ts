"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { formatApiError } from "@/lib/utils/api-response-parser";

import { KUNCI_DAFTAR_KEGIATAN } from "../kegiatanFormState";
import {
  PESAN_VERSI_BASI,
  urlRincianKegiatan,
  type MuatanUbahKegiatan,
} from "./ubahKegiatanState";

const PESAN_GAGAL_SIMPAN = "Gagal menyimpan perubahan kegiatan";

/** Kegiatan sudah tidak pada `versi` yang dikirim (kunci konkurensi). */
const STATUS_VERSI_BASI = 409;

/**
 * Pengiriman `PATCH /api/presurvei/kegiatan/[id]`.
 *
 * Penolakan server (400 lintas kelompok hasil, 403, 409 versi basi) disimpan
 * sebagai `pesanServer` untuk ditampilkan DI FORM, bukan hanya toast: pesan
 * seperti "catat kegiatan baru" adalah petunjuk tindakan yang harus tetap
 * terbaca sampai pemakai mengubah isiannya.
 *
 * Muatan selalu membawa `versi` (`updatedAt` rincian yang ditampilkan), jadi
 * 409 berarti orang lain sudah menyimpan sejak rincian ini dimuat — bukan
 * hanya dalam jendela satu request. Pada 409 rinciannya dimuat ulang supaya
 * percobaan berikutnya memakai versi dan nilai terbaru.
 */
export function useUbahKegiatan(kegiatanId: string, onBerhasil: () => void) {
  const queryClient = useQueryClient();
  const [isMenyimpan, setIsMenyimpan] = useState(false);
  const [pesanServer, setPesanServer] = useState<string | null>(null);

  const segarkanRincian = () =>
    queryClient.invalidateQueries({
      queryKey: [urlRincianKegiatan(kegiatanId)],
    });

  const simpan = async (muatan: MuatanUbahKegiatan) => {
    setIsMenyimpan(true);
    setPesanServer(null);
    try {
      const respons = await fetch(urlRincianKegiatan(kegiatanId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(muatan),
      });
      const badan: unknown = await respons.json().catch((): null => null);

      if (respons.status === STATUS_VERSI_BASI) {
        setPesanServer(PESAN_VERSI_BASI);
        void segarkanRincian();
        return;
      }

      if (!respons.ok) {
        setPesanServer(formatApiError(badan, PESAN_GAGAL_SIMPAN));
        return;
      }

      toast.success("Perubahan kegiatan tersimpan");

      // Rincian (beserta riwayatnya) di kunci `useApi` = URL-nya; daftar
      // kegiatan dan kartu "kegiatan terbaru" dashboard sama-sama berawalan
      // `KUNCI_DAFTAR_KEGIATAN` (`useKegiatanListQuery.ts`,
      // `useDashboardPresurvei.ts`). Tanpa invalidasi, `staleTime` 30 detik
      // menampilkan nilai lama setelah modal ditutup.
      void segarkanRincian();
      queryClient.invalidateQueries({ queryKey: [KUNCI_DAFTAR_KEGIATAN] });
      onBerhasil();
    } catch {
      setPesanServer(PESAN_GAGAL_SIMPAN);
    } finally {
      setIsMenyimpan(false);
    }
  };

  const bersihkanPesanServer = () => setPesanServer(null);

  return { simpan, isMenyimpan, pesanServer, bersihkanPesanServer };
}
