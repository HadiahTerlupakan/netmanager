"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { formatApiError } from "@/lib/utils/api-response-parser";
import type { ProspekListItemDto } from "@/modules/presurvei/client";

import {
  buildUbahProspekUrl,
  isHalamanSegar,
  nasibKartuSetelahPindah,
  pesanSetelahPindah,
  type NasibKartuPindah,
} from "./pindahProspek";
import { KUNCI_KOLOM_PROSPEK } from "./prospekKolomQuery";
import type { PerpindahanProspek } from "./useSeretProspek";

const PESAN_GAGAL_PINDAH = "Gagal memindahkan prospek";

/**
 * Lama pesan "kartu tidak tampil" bertahan, dalam milidetik.
 *
 * Lebih lama dari bawaan toast biasa: pesannya dua kalimat dan menjelaskan
 * kenapa kartu yang baru diseret tidak terlihat di mana pun.
 */
const DURASI_PESAN_KARTU_TAK_TAMPIL = 8000;

/** Isi cache satu halaman kolom; lihat `useProspekKolom`. */
interface AmplopHalamanKolom {
  data: ProspekListItemDto[];
}

/**
 * Pemindahan status prospek dari papan.
 *
 * Server tetap penjaga terakhir aturan transisi (`ProspekService.ubah`
 * menolak dengan 409), jadi penolakannya ditampilkan apa adanya: pesannya
 * menyebut transisi mana yang ditolak.
 */
export function usePindahProspek() {
  const queryClient = useQueryClient();
  const [idDipindah, setIdDipindah] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const tandai = (prospekId: string, isDipindah: boolean) =>
    setIdDipindah((lama) => {
      const baru = new Set(lama);
      if (isDipindah) baru.add(prospekId);
      else baru.delete(prospekId);
      return baru;
    });

  /**
   * Ambil ulang kolom asal dan tujuan, lalu tentukan nasib kartu di kolom
   * tujuan.
   *
   * Awalan `[KUNCI_KOLOM_PROSPEK, status]` mengenai semua halaman satu kolom
   * saja. `invalidateQueries` baru resolve setelah refetch query aktifnya
   * selesai atau gagal (`node_modules/@tanstack/query-core/src/queryClient.ts:292-311`
   * dan `:314-338`) — karena itu kesegaran tiap halaman ikut dibaca, bukan
   * hanya datanya.
   */
  const segarkanKolom = async ({
    prospekId,
    dari,
    tujuan,
  }: PerpindahanProspek): Promise<NasibKartuPindah> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [KUNCI_KOLOM_PROSPEK, dari] }),
      queryClient.invalidateQueries({
        queryKey: [KUNCI_KOLOM_PROSPEK, tujuan],
      }),
    ]);

    // Hanya halaman aktif: halaman yang tidak dirender tidak diambil ulang
    // invalidasi, dan cache basinya tidak menggambarkan apa yang tampil.
    const halamanTujuan = queryClient
      .getQueryCache()
      .findAll({ queryKey: [KUNCI_KOLOM_PROSPEK, tujuan], type: "active" })
      .map((query) => ({
        kartu: (query.state.data as AmplopHalamanKolom | undefined)?.data,
        isSegar: isHalamanSegar(query.state),
      }));
    return nasibKartuSetelahPindah(halamanTujuan, prospekId);
  };

  /** Pindahkan status satu prospek dan beri tahu pemakai hasilnya. */
  const pindahkan = async (perpindahan: PerpindahanProspek) => {
    const { prospekId, tujuan } = perpindahan;
    tandai(prospekId, true);
    try {
      const respons = await fetch(buildUbahProspekUrl(prospekId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: tujuan }),
      });
      if (!respons.ok) {
        const badan: unknown = await respons.json().catch((): null => null);
        toast.error(formatApiError(badan, PESAN_GAGAL_PINDAH));
        return;
      }

      const nasib = await segarkanKolom(perpindahan);
      if (nasib === "tampil") {
        toast.success(pesanSetelahPindah(tujuan, nasib));
      } else {
        toast(pesanSetelahPindah(tujuan, nasib), {
          duration: DURASI_PESAN_KARTU_TAK_TAMPIL,
        });
      }
    } catch {
      toast.error(PESAN_GAGAL_PINDAH);
    } finally {
      tandai(prospekId, false);
    }
  };

  /** Apakah kartu ini sedang menunggu jawaban server. */
  const isSedangDipindah = (prospekId: string) => idDipindah.has(prospekId);

  return { pindahkan, isSedangDipindah };
}
