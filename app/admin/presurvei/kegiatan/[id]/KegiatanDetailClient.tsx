"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { HiOutlineArrowLeft } from "react-icons/hi2";

import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { useApi, type FetchError } from "@/lib/hooks/useApi";
import {
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS_CONFIG,
  type KegiatanDetailDto,
  type TampilanStatus,
} from "@/modules/presurvei/client";

import { keTitikPeta } from "../titikPeta";
import {
  blokYangTampil,
  teksEstimasiKabel,
  teksRentangWaktu,
  TEKS_KOSONG,
} from "./blokDetail";

/**
 * Peta dimuat tanpa SSR: OpenLayers menyentuh `window` saat modulnya dimuat,
 * dan render di server gagal dengan `window is not defined`. Komponen yang
 * sama persis dengan tab peta di layar daftar — satu penanda, bukan seratus.
 */
const KegiatanPeta = dynamic(() => import("../KegiatanPeta"), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-[480px] w-auto" />,
});

const RUTE_DAFTAR_KEGIATAN = "/admin/presurvei/kegiatan";

const KELAS_PESAN = "py-12 text-center text-gray-500 dark:text-gray-400";
const KELAS_KARTU =
  "rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800";

/**
 * Halaman ini memuat tepat satu kegiatan, jadi tidak ada yang tersisa di luar
 * batas pengambilan — berbeda dari tab peta yang memotong di seratus baris.
 */
const TAK_ADA_YANG_TERPOTONG = 0;

/** Satu blok berlabel pada halaman detail. */
function Kartu({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className={KELAS_KARTU}>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
        {judul}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Satu pasang label dan nilai.
 *
 * Penggantian nilai kosong dikerjakan di sini, sekali, dengan `??` dan bukan
 * `||`: nol dan string kosong adalah nilai yang sah di beberapa field detail
 * ini, dan `||` akan melaporkannya sebagai tidak terisi.
 */
function BarisRingkasan({ label, nilai }: { label: string; nilai: ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">
        {nilai ?? TEKS_KOSONG}
      </dd>
    </div>
  );
}

/** Badge enum, memakai label dan warna yang sama dengan layar daftar. */
function BadgeStatus({ tampilan }: { tampilan: TampilanStatus }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs ${tampilan.warna}`}
    >
      {tampilan.label}
    </span>
  );
}

/** Galeri foto kegiatan; tiap foto membuka aslinya di tab baru. */
function GaleriFoto({ urls }: { urls: string[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {urls.map((url, urutan) => (
        // Kunci menggabungkan urutan dan URL: foto yang sama bisa terunggah
        // dua kali, dan URL telanjang sebagai kunci akan bentrok.
        <li
          key={`${urutan}-${url}`}
          className="relative aspect-video overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
          >
            <Image
              src={url}
              alt={`Foto kegiatan ke-${urutan + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Blok data teknis hasil survei lokasi.
 *
 * Menerima `dataTeknis` yang sudah dipastikan ada, bukan seluruh kegiatan:
 * dengan `strictNullChecks: false` compiler tidak menolak `kegiatan.dataTeknis
 * .odpTerdekat` di cabang yang salah, jadi bentuk props-nya yang menyatakan
 * kontrak itu.
 */
function BlokDataTeknis({
  dataTeknis,
}: {
  dataTeknis: NonNullable<KegiatanDetailDto["dataTeknis"]>;
}) {
  return (
    <Kartu judul="Data teknis">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BarisRingkasan label="ODP terdekat" nilai={dataTeknis.odpTerdekat} />
        <BarisRingkasan
          label="Estimasi kabel"
          nilai={teksEstimasiKabel(dataTeknis.estimasiKabelMeter)}
        />
        <BarisRingkasan
          label="Catatan teknis"
          nilai={dataTeknis.catatanTeknis}
        />
      </dl>
    </Kartu>
  );
}

/** Seluruh isi halaman untuk satu kegiatan yang sudah termuat. */
function IsiDetailKegiatan({ kegiatan }: { kegiatan: KegiatanDetailDto }) {
  const blok = blokYangTampil(kegiatan);

  // Dimemo demi reference-nya, bukan kecepatannya: satu titik memang murah
  // dipetakan, tapi array baru tiap render membuat effect penggambar penanda
  // di `KegiatanPeta` membangun ulang seluruh lapisan. Alasan yang sama
  // dicatat di `KegiatanClient.tsx`.
  //
  // `keTitikPeta` dipakai ulang, bukan ditulis ulang untuk satu titik: ia
  // sudah membawa tabel warna per hasil DAN urutan [bujur, lintang] yang
  // diuji — menukar urutan itu melempar penanda ke luar jangkauan Web
  // Mercator dan menghilangkannya dari layar tanpa satu pun pesan.
  const peta = useMemo(() => keTitikPeta([kegiatan]), [kegiatan]);

  return (
    <div className="space-y-6">
      <Kartu judul="Ringkasan">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BarisRingkasan label="Waktu" nilai={teksRentangWaktu(kegiatan)} />
          <BarisRingkasan label="Sales" nilai={kegiatan.userId} />
          <BarisRingkasan
            label="Jenis"
            nilai={
              <BadgeStatus tampilan={KEGIATAN_JENIS_CONFIG[kegiatan.jenis]} />
            }
          />
          <BarisRingkasan
            label="Hasil"
            nilai={
              <BadgeStatus tampilan={KEGIATAN_HASIL_CONFIG[kegiatan.hasil]} />
            }
          />
          <BarisRingkasan label="Alamat" nilai={kegiatan.alamatDikunjungi} />
          <BarisRingkasan label="Ditemui" nilai={kegiatan.ditemuiNama} />
        </dl>
      </Kartu>

      <Kartu judul="Catatan">
        <p className="text-sm whitespace-pre-line text-gray-900 dark:text-white">
          {kegiatan.catatan ?? TEKS_KOSONG}
        </p>
      </Kartu>

      {blok.dataTeknis && <BlokDataTeknis dataTeknis={kegiatan.dataTeknis} />}

      {blok.peta && (
        <Kartu judul="Titik lokasi">
          <KegiatanPeta
            titik={peta.titik}
            tanpaKoordinat={peta.tanpaKoordinat}
            diLuarBatas={TAK_ADA_YANG_TERPOTONG}
          />
        </Kartu>
      )}

      {blok.foto && (
        <Kartu judul={`Foto (${kegiatan.fotoUrls.length})`}>
          <GaleriFoto urls={kegiatan.fotoUrls} />
        </Kartu>
      )}
    </div>
  );
}

interface MuatanProps {
  kegiatan: KegiatanDetailDto | undefined;
  error: FetchError | null;
  isLoading: boolean;
}

/**
 * Isi halaman menurut keadaan pengambilan datanya.
 *
 * Gagal memuat dibedakan dari tidak ditemukan: menyamakan keduanya membuat
 * gangguan jaringan atau 403 tampil sebagai kegiatan yang seolah tidak ada,
 * dan pemakai yang sebenarnya cuma kehilangan sinyal akan menyimpulkan
 * catatannya hilang. Pembedaan yang sama diambil di `IklanEditClient.tsx`.
 */
function MuatanDetail({ kegiatan, error, isLoading }: MuatanProps) {
  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (error) {
    return (
      <p className={KELAS_PESAN}>Gagal memuat kegiatan: {error.message}</p>
    );
  }

  if (!kegiatan) {
    return <p className={KELAS_PESAN}>Kegiatan tidak ditemukan</p>;
  }

  return <IsiDetailKegiatan kegiatan={kegiatan} />;
}

/**
 * Halaman rincian satu kegiatan sales.
 *
 * Halaman sendiri, bukan modal di atas daftar: galeri foto dan blok data
 * teknis tidak muat nyaman di dalam dialog, dan popup peta menautkan ke sini
 * sebagai alamat yang bisa dibagikan.
 */
export function KegiatanDetailClient({ kegiatanId }: { kegiatanId: string }) {
  const {
    data: kegiatan,
    error,
    isLoading,
  } = useApi<KegiatanDetailDto>(`/api/presurvei/kegiatan/${kegiatanId}`);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={RUTE_DAFTAR_KEGIATAN}
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          <HiOutlineArrowLeft className="h-4 w-4" />
          Kembali ke daftar kegiatan
        </Link>
        <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
          Detail Kegiatan
        </h1>
      </div>

      <MuatanDetail kegiatan={kegiatan} error={error} isLoading={isLoading} />
    </div>
  );
}
