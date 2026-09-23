"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { formatApiError } from "@/lib/utils/api-response-parser";
import type { UbahKegiatanInput } from "@/modules/presurvei/client";

import { KUNCI_DAFTAR_KEGIATAN } from "../kegiatanFormState";
import { urlRincianKegiatan } from "./ubahKegiatanState";

const PESAN_GAGAL_SIMPAN = "Gagal menyimpan perubahan kegiatan";

/**
 * Pengiriman `PATCH /api/presurvei/kegiatan/[id]`.
 *
 * Penolakan server (400 lintas kelompok hasil, 403, 409 versi basi) disimpan
 * sebagai `pesanServer` untuk ditampilkan DI FORM, bukan hanya toast: pesan
 * seperti "catat kegiatan baru" adalah petunjuk tindakan yang harus tetap
 * terbaca sampai pemakai mengubah isiannya.
 */
export function useUbahKegiatan(kegiatanId: string, onBerhasil: () => void) {
  const queryClient = useQueryClient();
  const [isMenyimpan, setIsMenyimpan] = useState(false);
  const [pesanServer, setPesanServer] = useState<string | null>(null);

  const simpan = async (muatan: UbahKegiatanInput) => {
    setIsMenyimpan(true);
    setPesanServer(null);
    try {
      const respons = await fetch(urlRincianKegiatan(kegiatanId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(muatan),
      });
      const badan: unknown = await respons.json().catch((): null => null);

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
      queryClient.invalidateQueries({
        queryKey: [urlRincianKegiatan(kegiatanId)],
      });
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
