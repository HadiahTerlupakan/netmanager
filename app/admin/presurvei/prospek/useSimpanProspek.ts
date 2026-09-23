"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { formatApiError } from "@/lib/utils/api-response-parser";

import { awalanKunciProspekTakBertuan } from "../ringkasanDashboard";
import {
  bacaDuplikat,
  bacaPenolakanPemilik,
  denganAbaikanDuplikat,
  kunciKolomSetelahSimpan,
  opsiSimpanUntukMode,
  type ModeFormProspek,
  type MuatanBuatProspek,
  type MuatanProspek,
  type ProspekBentrok,
} from "./prospekFormState";

/** Penolakan duplikat yang menunggu keputusan pemakai. */
export interface DuplikatTertunda {
  bentrok: ProspekBentrok[];
  /** Muatan yang ditolak; dikirim ulang apa adanya bila pemakai memaksa. */
  muatan: MuatanBuatProspek;
}

/**
 * Pengiriman muatan prospek ke API, untuk mode buat maupun ubah.
 *
 * Penolakan duplikat tidak diperlakukan sebagai kesalahan: ia disimpan
 * sebagai `duplikat` supaya form bisa menampilkan prospek yang bentrok dan
 * menawarkan "Tetap simpan". Keputusan "duplikat atau kesalahan lain" ada di
 * `bacaDuplikat`, yang diuji terhadap bentuk kawat sungguhan.
 *
 * Penolakan pemilik (sales bukan sales aktif se-tenant) juga bukan toast:
 * pesannya diserahkan ke `onPemilikDitolak` supaya tampil di medan pemilik.
 */
export function useSimpanProspek(
  mode: ModeFormProspek,
  onBerhasil: () => void,
  onPemilikDitolak: (pesan: string) => void,
) {
  const queryClient = useQueryClient();
  const [isMenyimpan, setIsMenyimpan] = useState(false);
  const [duplikat, setDuplikat] = useState<DuplikatTertunda | null>(null);
  const opsi = opsiSimpanUntukMode(mode);

  const simpan = async (muatan: MuatanProspek) => {
    setIsMenyimpan(true);
    try {
      const respons = await fetch(opsi.url, {
        method: opsi.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(muatan),
      });
      const badan: unknown = await respons.json().catch((): null => null);

      if (!respons.ok) {
        const bentrok = bacaDuplikat(respons.status, badan);
        // Hanya muatan buat yang bisa ditolak sebagai duplikat
        // (`ProspekService.buat`); `sumber` membedakannya dari muatan ubah.
        if (bentrok !== null && "sumber" in muatan) {
          setDuplikat({ bentrok, muatan });
          return;
        }
        const pesanPemilik = bacaPenolakanPemilik(respons.status, badan);
        if (pesanPemilik !== null) {
          onPemilikDitolak(pesanPemilik);
          return;
        }
        toast.error(formatApiError(badan, opsi.pesanGagal));
        return;
      }

      toast.success(opsi.pesanSukses);

      // Query di-cache 30 detik (`staleTime` di `session-provider.tsx`). Tanpa
      // invalidasi kartu baru tidak muncul di kolomnya dan kartu yang diubah
      // tetap menampilkan isi lamanya. Key detail ikut dibuang supaya form
      // ubah yang dibuka lagi tidak memuat salinan lama.
      queryClient.invalidateQueries({
        queryKey: kunciKolomSetelahSimpan(badan),
      });
      if (mode.jenis === "ubah") {
        queryClient.invalidateQueries({ queryKey: [opsi.url] });
        // Prospek yang diubah bisa tak bertuan; nama dan teleponnya tampil di
        // daftar tak bertuan dashboard. Mode buat tidak perlu: prospek dari
        // form ini selalu berpemilik (`pemilikDiminta ?? idPemanggil`,
        // `app/api/presurvei/akses-presurvei.ts:41-48`), jadi tak pernah
        // masuk daftar itu.
        queryClient.invalidateQueries({
          queryKey: awalanKunciProspekTakBertuan(),
        });
      }

      setDuplikat(null);
      onBerhasil();
    } catch {
      toast.error(opsi.pesanGagal);
    } finally {
      setIsMenyimpan(false);
    }
  };

  /** Kirim ulang muatan yang ditolak, kali ini melewati pemeriksaan duplikat. */
  const tetapSimpan = () => {
    if (duplikat === null) return;
    void simpan(denganAbaikanDuplikat(duplikat.muatan));
  };

  /** Lupakan penolakan duplikat, mis. karena pemakai mengubah isian. */
  const lupakanDuplikat = () => setDuplikat(null);

  return { simpan, tetapSimpan, lupakanDuplikat, duplikat, isMenyimpan };
}
