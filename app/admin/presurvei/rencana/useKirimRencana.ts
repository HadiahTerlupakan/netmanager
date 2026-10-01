"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { formatApiError } from "@/lib/utils/api-response-parser";

import { KUNCI_RENCANA } from "./rencanaQuery";

/** Satu permintaan tulis rencana (buat, ubah, atau batal). */
export interface PermintaanRencana {
  url: string;
  method: "POST" | "PATCH";
  muatan: unknown;
  pesanBerhasil: string;
  pesanGagal: string;
}

/**
 * Pengirim permintaan tulis rencana.
 *
 * Penolakan server (403 di luar lingkup, 422 sales tidak sah, 400 tanggal
 * lampau, 409 sudah ditutup) disimpan sebagai `pesanServer` untuk tampil DI
 * FORM, bukan hanya toast: pemakai perlu membacanya sampai isian diubah.
 * Setelah berhasil, seluruh cache berawalan `KUNCI_RENCANA` — daftar,
 * rincian, dan rekap — dibuang, karena satu perubahan menggeser ketiganya.
 */
export function useKirimRencana(onBerhasil: () => void) {
  const queryClient = useQueryClient();
  const [isMenyimpan, setIsMenyimpan] = useState(false);
  const [pesanServer, setPesanServer] = useState<string | null>(null);

  const kirim = async (permintaan: PermintaanRencana) => {
    setIsMenyimpan(true);
    setPesanServer(null);
    try {
      const respons = await fetch(permintaan.url, {
        method: permintaan.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permintaan.muatan),
      });
      const badan: unknown = await respons.json().catch((): null => null);

      if (!respons.ok) {
        setPesanServer(formatApiError(badan, permintaan.pesanGagal));
        return;
      }

      toast.success(permintaan.pesanBerhasil);
      void queryClient.invalidateQueries({ queryKey: [KUNCI_RENCANA] });
      onBerhasil();
    } catch {
      setPesanServer(permintaan.pesanGagal);
    } finally {
      setIsMenyimpan(false);
    }
  };

  const bersihkanPesanServer = () => setPesanServer(null);

  return { kirim, isMenyimpan, pesanServer, bersihkanPesanServer };
}

/** Pengirim beserta keadaannya, untuk diteruskan ke form anak. */
export type PengirimRencana = ReturnType<typeof useKirimRencana>;
