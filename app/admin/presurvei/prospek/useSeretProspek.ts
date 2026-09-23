"use client";

import { useState } from "react";

import {
  isStatusFinal,
  resolveAksiKanban,
  type AksiKanban,
  type ProspekStatus,
} from "@/modules/presurvei/client";

/** Kartu yang sedang diangkat. */
export interface KartuDiangkat {
  id: string;
  dari: ProspekStatus;
}

/** Hasil menjatuhkan kartu yang sah: kartu mana dan apa yang dilakukan. */
export interface KeputusanSeret {
  prospekId: string;
  aksi: AksiKanban;
}

/**
 * Perpindahan status yang diminta papan.
 *
 * Objek, bukan argumen berurutan: `dari` dan `tujuan` bertipe sama dan
 * bersebelahan, jadi tertukarnya tidak akan ditolak compiler.
 */
export interface PerpindahanProspek {
  prospekId: string;
  dari: ProspekStatus;
  tujuan: ProspekStatus;
}

/** Aksi yang dijalankan papan setelah keputusan seret diambil. */
export interface HandlerSeretProspek {
  onUbahStatus: (perpindahan: PerpindahanProspek) => void;
  onBukaKonversi: (prospekId: string) => void;
}

/** Rupa kolom selama sebuah kartu diangkat. */
export type TampilanKolomSeret = "netral" | "tujuan" | "redup";

/**
 * Apa yang terjadi bila kartu yang sedang diangkat dijatuhkan ke `ke`.
 *
 * Murni dan terpisah dari komponen supaya murah diuji — interaksi seretnya
 * sendiri lebih mahal diuji daripada nilainya di sini. Aturan transisinya
 * milik domain (`resolveAksiKanban`), tidak ditulis ulang di sini.
 */
export function putuskanSeret(
  diangkat: KartuDiangkat | null,
  ke: ProspekStatus,
): KeputusanSeret | null {
  if (diangkat === null) {
    return null;
  }

  const aksi = resolveAksiKanban(diangkat.dari, ke);
  return aksi === null ? null : { prospekId: diangkat.id, aksi };
}

/**
 * Rupa kolom `status` selama kartu `diangkat` diseret.
 *
 * Kolom asal dibiarkan netral walau bukan tujuan sah: meredupkannya membuat
 * kartu yang baru diangkat tampak ditolak kolomnya sendiri.
 */
export function tampilanKolomSaatSeret(
  diangkat: KartuDiangkat | null,
  status: ProspekStatus,
): TampilanKolomSeret {
  if (diangkat === null || diangkat.dari === status) return "netral";
  return putuskanSeret(diangkat, status) === null ? "redup" : "tujuan";
}

/**
 * Apakah kartu di kolom `status` boleh diangkat.
 *
 * Status final (tanpa transisi sah, `isStatusFinal`) dikunci: mengangkatnya
 * hanya meredupkan semua kolom selain kolom asalnya, tanpa satu pun tujuan.
 * `TIDAK_MINAT` BUKAN final — ia bisa kembali ke `DIHUBUNGI`.
 */
export function isKartuDapatDiseret(
  status: ProspekStatus,
  isBolehUbah: boolean,
): boolean {
  return isBolehUbah && !isStatusFinal(status);
}

/**
 * State seret papan prospek: kartu yang sedang diangkat, kolom mana yang boleh
 * menerimanya, dan aksi yang dijalankan saat kartu dijatuhkan.
 */
export function useSeretProspek(handler: HandlerSeretProspek) {
  const [diangkat, setDiangkat] = useState<KartuDiangkat | null>(null);

  const mulaiSeret = (kartu: KartuDiangkat) => setDiangkat(kartu);
  const selesaiSeret = () => setDiangkat(null);

  /** Rupa kolom `status` terhadap kartu yang sedang diangkat. */
  const tampilanKolom = (status: ProspekStatus) =>
    tampilanKolomSaatSeret(diangkat, status);

  /** Jalankan aksi untuk kartu yang dijatuhkan ke kolom `status`. */
  const jatuhkan = (status: ProspekStatus) => {
    const keputusan = putuskanSeret(diangkat, status);
    selesaiSeret();
    if (keputusan === null) return;

    if (keputusan.aksi.jenis === "buka-konversi") {
      handler.onBukaKonversi(keputusan.prospekId);
      return;
    }
    handler.onUbahStatus({
      prospekId: keputusan.prospekId,
      dari: diangkat.dari,
      tujuan: keputusan.aksi.tujuan,
    });
  };

  return { diangkat, mulaiSeret, selesaiSeret, tampilanKolom, jatuhkan };
}
