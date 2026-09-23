"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { formatApiError } from "@/lib/utils/api-response-parser";
import type { ProspekListItemDto } from "@/modules/presurvei/client";

import {
  buildUbahProspekUrl,
  isKartuTermuat,
  pesanSetelahPindah,
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
   * Ambil ulang kolom asal dan tujuan, lalu periksa apakah kartunya tampil
   * di kolom tujuan.
   *
   * Awalan `[KUNCI_KOLOM_PROSPEK, status]` mengenai semua halaman satu kolom
   * saja. `invalidateQueries` baru selesai setelah query aktifnya selesai
   * diambil ulang (`node_modules/@tanstack/query-core/src/queryClient.ts:304-310`
   * dan `:322-337`), jadi cache tujuan yang dibaca sesudahnya sudah versi baru.
   */
  const segarkanKolom = async ({
    prospekId,
    dari,
    tujuan,
  }: PerpindahanProspek) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [KUNCI_KOLOM_PROSPEK, dari] }),
      queryClient.invalidateQueries({
        queryKey: [KUNCI_KOLOM_PROSPEK, tujuan],
      }),
    ]);

    // Hanya halaman aktif: kolom tersembunyi tidak diambil ulang invalidasi,
    // dan cache basinya tidak menggambarkan apa yang tampil.
    const halamanTujuan = queryClient.getQueriesData<AmplopHalamanKolom>({
      queryKey: [KUNCI_KOLOM_PROSPEK, tujuan],
      type: "active",
    });
    return isKartuTermuat(
      halamanTujuan.map(([, amplop]) => amplop?.data),
      prospekId,
    );
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

      const isTermuat = await segarkanKolom(perpindahan);
      if (isTermuat) {
        toast.success(pesanSetelahPindah(tujuan, true));
      } else {
        toast(pesanSetelahPindah(tujuan, false), {
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
