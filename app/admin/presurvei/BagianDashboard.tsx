"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { StatCard } from "@/components/common/StatCard";
import { formatDateTimeDisplay } from "@/lib/utils/datetime";
import {
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS_CONFIG,
  PROSPEK_SUMBER_CONFIG,
} from "@/modules/presurvei/client";

import { keBarisTampilan, pesanLaporanKosong } from "./laporan/barisLaporan";
import { useLaporanPeriode } from "./laporan/useLaporanPeriode";
import { namaBulan } from "./periode";
import { teksJumlahKartu, JUMLAH_HARI_KEGIATAN } from "./ringkasanDashboard";
import {
  useCorongDashboard,
  useKegiatanTerbaru,
  useProspekTakBertuan,
} from "./useDashboardPresurvei";
import { useDaftarSalesPresurvei } from "./useDaftarSalesPresurvei";

const URL_PAPAN_PROSPEK = "/admin/presurvei/prospek";
const URL_DAFTAR_KEGIATAN = "/admin/presurvei/kegiatan";
const URL_LAPORAN = "/admin/presurvei/laporan";

/** Kerangka kartu satu bagian dashboard: judul, tautan, dan isi. */
function KerangkaBagian({
  judul,
  tautan,
  children,
}: {
  judul: string;
  tautan?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {judul}
        </h2>
        {tautan && (
          <Link
            href={tautan.href}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {tautan.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Pesan pengganti isi bagian: memuat, gagal, atau kosong. */
function PesanBagian({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-500 dark:text-gray-400">{children}</p>;
}

/** Kartu corong per kolom hidup; angkanya sama dengan papan prospek. */
export function CorongDashboard({ judul }: { judul: string }) {
  const kartu = useCorongDashboard();

  return (
    <KerangkaBagian
      judul={judul}
      tautan={{ href: URL_PAPAN_PROSPEK, label: "Buka papan" }}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kartu.map((item) => (
          <StatCard
            key={item.status}
            label={item.label}
            value={teksJumlahKartu(item)}
            icon={
              <span
                className={`inline-block h-3 w-3 rounded-full ${item.warna}`}
              />
            }
          />
        ))}
      </div>
    </KerangkaBagian>
  );
}

/**
 * Prospek tanpa pemilik. Lahir saat form publik masuk dan tenant belum punya
 * sales aktif; tanpa tempat ini ia tidak pernah ditemukan.
 */
export function ProspekTakBertuan() {
  const { daftar, total, isLoading, isError } = useProspekTakBertuan();

  const isi = (() => {
    if (isLoading) return <PesanBagian>Memuat…</PesanBagian>;
    if (isError)
      return <PesanBagian>Prospek tak bertuan gagal dimuat.</PesanBagian>;
    if (daftar.length === 0)
      return <PesanBagian>Semua prospek sudah punya pemilik.</PesanBagian>;

    return (
      <>
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {daftar.map((prospek) => (
            <li key={prospek.id} className="py-2 text-sm">
              <div className="font-medium text-gray-900 dark:text-white">
                {prospek.nama}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {prospek.noTelp} · {PROSPEK_SUMBER_CONFIG[prospek.sumber].label}{" "}
                · {formatDateTimeDisplay(prospek.createdAt)}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Menampilkan {daftar.length} dari {total} prospek tak bertuan.
        </p>
      </>
    );
  })();

  return (
    <KerangkaBagian
      judul="Prospek tanpa pemilik"
      tautan={{ href: URL_PAPAN_PROSPEK, label: "Tugaskan di papan" }}
    >
      {isi}
    </KerangkaBagian>
  );
}

/** Kegiatan terbaru dalam rentang tujuh hari kalender UTC. */
export function KegiatanTerbaru({ judul }: { judul: string }) {
  const { daftar, isLoading, isError } = useKegiatanTerbaru();

  const isi = (() => {
    if (isLoading) return <PesanBagian>Memuat…</PesanBagian>;
    if (isError) return <PesanBagian>Kegiatan gagal dimuat.</PesanBagian>;
    if (daftar.length === 0)
      return <PesanBagian>Belum ada kegiatan pada rentang ini.</PesanBagian>;

    return (
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {daftar.map((kegiatan) => (
          <li key={kegiatan.id} className="py-2 text-sm">
            <div className="font-medium text-gray-900 dark:text-white">
              {KEGIATAN_JENIS_CONFIG[kegiatan.jenis].label} ·{" "}
              {KEGIATAN_HASIL_CONFIG[kegiatan.hasil].label}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {kegiatan.namaSales ?? kegiatan.userId} ·{" "}
              {formatDateTimeDisplay(kegiatan.waktuMulai)}
            </div>
          </li>
        ))}
      </ul>
    );
  })();

  return (
    <KerangkaBagian
      judul={`${judul} — ${JUMLAH_HARI_KEGIATAN} hari terakhir`}
      tautan={{ href: URL_DAFTAR_KEGIATAN, label: "Semua kegiatan" }}
    >
      {isi}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Rentang dihitung per tanggal UTC, mulai pukul 07.00 WIB.
      </p>
    </KerangkaBagian>
  );
}

/** Ringkasan pencapaian target bulan berjalan; periode bawaan `periodeSekarang()`. */
export function RingkasanPencapaian() {
  const { periode, daftarLaporan, isLoading, isError } = useLaporanPeriode();
  const daftarSales = useDaftarSalesPresurvei();

  const baris = useMemo(
    () => keBarisTampilan(daftarLaporan, daftarSales),
    [daftarLaporan, daftarSales],
  );

  const isi = (() => {
    if (isLoading) return <PesanBagian>Memuat…</PesanBagian>;
    if (baris.length === 0)
      return <PesanBagian>{pesanLaporanKosong(isError)}</PesanBagian>;

    return (
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {baris.map((item) => (
          <li key={item.userId} className="py-2 text-sm">
            <div className="font-medium text-gray-900 dark:text-white">
              {item.namaSales}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {item.isTanpaTarget
                ? "Belum ada target"
                : `Kunjungan ${item.kunjungan.tercapai}/${item.kunjungan.target} · Prospek ${item.prospek.tercapai}/${item.prospek.target} · Konversi ${item.konversi.tercapai}/${item.konversi.target}`}
            </div>
          </li>
        ))}
      </ul>
    );
  })();

  return (
    <KerangkaBagian
      judul={`Pencapaian ${namaBulan(periode.bulan)} ${periode.tahun}`}
      tautan={{ href: URL_LAPORAN, label: "Laporan lengkap" }}
    >
      {isi}
    </KerangkaBagian>
  );
}
