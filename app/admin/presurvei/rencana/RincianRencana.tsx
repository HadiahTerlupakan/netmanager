"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatDateTimeDisplay } from "@/lib/utils/datetime";
import {
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS_CONFIG,
  type KegiatanDetailDto,
  type RincianRencanaDto,
} from "@/modules/presurvei/client";

import { TEKS_KOSONG } from "../kegiatan/[id]/blokDetail";
import { Badge, BadgeStatusRencana, BadgeSumberRencana } from "./BadgeRencana";
import { labelWaktuRencana, tautanPeta, teksNama } from "./tampilanRencana";

const RUTE_DETAIL_KEGIATAN = "/admin/presurvei/kegiatan";

/** Satu pasang label dan nilai; nilai kosong diganti `TEKS_KOSONG`. */
function Medan({ label, nilai }: { label: string; nilai: ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm break-words text-gray-900 dark:text-white">
        {nilai ?? TEKS_KOSONG}
      </dd>
    </div>
  );
}

/**
 * Nilai medan lokasi: tautan Google Maps, atau null bila koordinat kosong —
 * null (bukan elemen kosong) supaya `Medan` menggantinya dengan `TEKS_KOSONG`.
 */
function nilaiTautanPeta(
  latitude: number | null,
  longitude: number | null,
): ReactNode {
  const href = tautanPeta(latitude, longitude);
  if (href === null) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-600 hover:underline dark:text-indigo-400"
    >
      Buka di peta
    </a>
  );
}

/** Deretan thumbnail foto laporan; tiap foto membuka aslinya di tab baru. */
function ThumbnailFoto({ urls }: { urls: string[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((url, urutan) => (
        <li
          key={`${urutan}-${url}`}
          className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
          >
            <Image
              src={url}
              alt={`Foto laporan ke-${urutan + 1}`}
              fill
              sizes="120px"
              className="object-cover"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Blok laporan kunjungan yang menutup rencana. */
function BlokLaporan({ laporan }: { laporan: KegiatanDetailDto }) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Medan
          label="Hasil"
          nilai={<Badge tampilan={KEGIATAN_HASIL_CONFIG[laporan.hasil]} />}
        />
        <Medan
          label="Waktu"
          nilai={formatDateTimeDisplay(laporan.waktuMulai)}
        />
        <Medan label="Ditemui" nilai={laporan.ditemuiNama} />
        <Medan label="Alamat dikunjungi" nilai={laporan.alamatDikunjungi} />
        <Medan
          label="Lokasi"
          nilai={nilaiTautanPeta(laporan.latitude, laporan.longitude)}
        />
      </dl>
      <Medan label="Catatan" nilai={laporan.catatan} />
      {laporan.fotoUrls.length > 0 && <ThumbnailFoto urls={laporan.fotoUrls} />}
      <Link
        href={`${RUTE_DETAIL_KEGIATAN}/${laporan.id}`}
        className="inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Lihat kegiatan lengkap
      </Link>
    </div>
  );
}

/** Seluruh isi rincian rencana, termasuk laporan bila sudah ada. */
export function RincianRencana({ rincian }: { rincian: RincianRencanaDto }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Medan label="Tanggal & jam" nilai={labelWaktuRencana(rincian)} />
        <Medan label="Sales" nilai={teksNama(rincian.namaSales)} />
        <Medan
          label="Jenis"
          nilai={<Badge tampilan={KEGIATAN_JENIS_CONFIG[rincian.jenis]} />}
        />
        <Medan
          label="Status"
          nilai={<BadgeStatusRencana rencana={rincian} />}
        />
        <Medan
          label="Sumber"
          nilai={<BadgeSumberRencana rencana={rincian} />}
        />
        <Medan label="Prospek" nilai={rincian.namaProspek} />
        <Medan label="Alamat" nilai={rincian.alamat} />
        <Medan
          label="Lokasi rencana"
          nilai={nilaiTautanPeta(rincian.latitude, rincian.longitude)}
        />
        <Medan
          label="Dibuat"
          nilai={formatDateTimeDisplay(rincian.createdAt)}
        />
      </dl>

      <Medan
        label="Tujuan"
        nilai={<span className="whitespace-pre-line">{rincian.tujuan}</span>}
      />

      {rincian.statusTampil === "BATAL" && (
        <dl className="grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-3 sm:grid-cols-2 dark:bg-gray-900/40">
          <Medan label="Alasan batal" nilai={rincian.alasanBatal} />
          <Medan
            label="Dibatalkan"
            nilai={formatDateTimeDisplay(rincian.dibatalkanAt)}
          />
        </dl>
      )}

      <section className="border-t border-gray-100 pt-4 dark:border-gray-700">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          Laporan
        </h3>
        {rincian.laporan ? (
          <BlokLaporan laporan={rincian.laporan} />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Belum dilaporkan.
          </p>
        )}
      </section>
    </div>
  );
}
