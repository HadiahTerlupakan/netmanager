"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  PERAN_PELAKU,
  daftarKolomHidup,
  type KegiatanListItemDto,
  type ProspekListItemDto,
} from "@/modules/presurvei/client";

import { KUNCI_DAFTAR_KEGIATAN } from "./kegiatan/kegiatanFormState";
import { HALAMAN_PERTAMA } from "./prospek/prospekKolomQuery";
import { opsiQueryHalamanKolom } from "./prospek/useProspekKolom";
import {
  buildJumlahKegiatanPeranUrl,
  buildKegiatanTerbaruUrl,
  buildProspekTakBertuanUrl,
  hitungCorong,
  kartuJumlahPeran,
  kunciQueryProspekTakBertuan,
  ringkasHasilKolom,
  type KartuCorong,
  type KartuPeran,
} from "./ringkasanDashboard";

/** Referensi tunggal untuk "belum ada data", supaya tidak lahir array baru tiap render. */
const TANPA_KEGIATAN: readonly KegiatanListItemDto[] = Object.freeze([]);
const TANPA_PROSPEK: readonly ProspekListItemDto[] = Object.freeze([]);

interface AmplopDaftar<T> {
  data: T[];
  meta: { total: number };
}

async function ambilDaftar<T>(
  url: string,
  pesanGagal: string,
): Promise<AmplopDaftar<T>> {
  const respons = await fetch(url);
  if (!respons.ok) throw new Error(pesanGagal);
  return respons.json();
}

/**
 * Kartu corong dari halaman pertama tiap kolom hidup papan.
 *
 * Memakai kunci dan pengambil papan (`opsiQueryHalamanKolom`), jadi angka
 * dashboard dan papan selalu sama dan invalidasi papan ikut menyegarkannya.
 */
export function useCorongDashboard(): KartuCorong[] {
  const kolom = daftarKolomHidup();
  const hasil = useQueries({
    queries: kolom.map((status) =>
      opsiQueryHalamanKolom(status, HALAMAN_PERTAMA),
    ),
  });

  const { jumlahPerStatus, keadaanTakTermuat } = ringkasHasilKolom(
    kolom.map((status, urutan) => ({
      status,
      total: hasil[urutan].data?.meta.total,
      isGagal: hasil[urutan].isError,
    })),
  );

  return hitungCorong(jumlahPerStatus, keadaanTakTermuat);
}

/**
 * Kegiatan terbaru dalam rentang `JUMLAH_HARI_KEGIATAN` hari.
 *
 * URL-nya dihitung sekali saat pasang: menghitungnya tiap render menggeser
 * kunci cache begitu tanggal berganti di tengah sesi. Kuncinya berawalan
 * `KUNCI_DAFTAR_KEGIATAN`, jadi kegiatan yang dicatat lewat form ikut muncul.
 */
export function useKegiatanTerbaru() {
  const [url] = useState(() => buildKegiatanTerbaruUrl(new Date()));
  const query = useQuery({
    queryKey: [KUNCI_DAFTAR_KEGIATAN, url],
    queryFn: () =>
      ambilDaftar<KegiatanListItemDto>(url, "Gagal memuat kegiatan terbaru"),
  });

  return {
    daftar: query.data?.data ?? TANPA_KEGIATAN,
    isLoading: query.isPending,
    isError: query.isError,
  };
}

/**
 * Jumlah kegiatan `JUMLAH_HARI_KEGIATAN` hari per peran pelaku, dari
 * `meta.total` dua permintaan satu baris.
 *
 * URL dihitung sekali saat pasang, dengan satu "sekarang" untuk kedua peran,
 * supaya keduanya selalu merentang hari yang sama. Kuncinya berawalan
 * `KUNCI_DAFTAR_KEGIATAN`, jadi invalidasi form catat/ubah kegiatan ikut
 * menyegarkan kedua angka.
 */
export function useJumlahKegiatanPerPeran(): KartuPeran[] {
  const [permintaan] = useState(() => {
    const sekarang = new Date();
    return PERAN_PELAKU.map((peran) => ({
      peran,
      url: buildJumlahKegiatanPeranUrl(sekarang, peran),
    }));
  });

  const hasil = useQueries({
    queries: permintaan.map(({ url }) => ({
      queryKey: [KUNCI_DAFTAR_KEGIATAN, url],
      queryFn: () =>
        ambilDaftar<KegiatanListItemDto>(url, "Gagal memuat jumlah kegiatan"),
    })),
  });

  return kartuJumlahPeran(
    permintaan.map(({ peran }, urutan) => ({
      peran,
      total: hasil[urutan].data?.meta.total,
      isGagal: hasil[urutan].isError,
    })),
  );
}

/**
 * Halaman pertama prospek tak bertuan beserta jumlah seluruhnya.
 *
 * Kuncinya dari `kunciQueryProspekTakBertuan` — lihat di sana untuk invalidasi
 * mana yang mengenainya dan mana yang tidak.
 */
export function useProspekTakBertuan() {
  const url = buildProspekTakBertuanUrl();
  const query = useQuery({
    queryKey: kunciQueryProspekTakBertuan(),
    queryFn: () =>
      ambilDaftar<ProspekListItemDto>(url, "Gagal memuat prospek tak bertuan"),
  });

  return {
    daftar: query.data?.data ?? TANPA_PROSPEK,
    total: query.data?.meta.total ?? null,
    isLoading: query.isPending,
    isError: query.isError,
  };
}
