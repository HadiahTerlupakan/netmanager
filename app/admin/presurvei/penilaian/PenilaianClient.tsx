"use client";

import { useState } from "react";

import { formatDateDisplay } from "@/lib/utils/datetime";
import { BOBOT_PENILAIAN_KEPALA, BOBOT_PENILAIAN_SALES } from "@/modules/presurvei/client";

import { PemilihPeriode } from "../PemilihPeriode";
import { KartuKepala } from "./KartuKepala";
import { TabelAnggota } from "./TabelAnggota";
import { LABEL_INDIKATOR_KEPALA, LABEL_INDIKATOR_SALES } from "./tampilanPenilaian";
import { usePenilaianQuery } from "./usePenilaianQuery";

/** "Aktivitas 40% · Konversi 30% · ..." */
function teksBobot(bobot: Record<string, number>, label: Record<string, string>): string {
  return Object.keys(label)
    .map((kunci) => `${label[kunci]} ${bobot[kunci]}%`)
    .join(" · ");
}

/** Layar penilaian kinerja bulanan kepala sales beserta timnya. */
export function PenilaianClient() {
  const { periode, ubahPeriode, hasil, isLoading, isError } = usePenilaianQuery();
  const [kepalaTerpilihId, setKepalaTerpilihId] = useState<string | null>(null);

  const daftarKepala = hasil?.kepala ?? [];
  const kepalaTerpilih =
    daftarKepala.find((item) => item.kepalaId === kepalaTerpilihId) ?? daftarKepala[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Penilaian Kinerja</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Skor bulanan kepala sales dan anggota timnya (0–100)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <PemilihPeriode periode={periode} onUbah={ubahPeriode} />
        {hasil && <span className="text-sm text-gray-500">Dihitung sampai {formatDateDisplay(hasil.dihitungSampai)}</span>}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Memuat penilaian…</p>}
      {isError && <p className="text-sm text-red-600">Penilaian gagal dimuat.</p>}
      {hasil && daftarKepala.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          Belum ada kepala sales dengan anggota tim. Tetapkan kepala sales di halaman pengguna.
        </p>
      )}

      {daftarKepala.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {daftarKepala.map((kepala) => (
            <KartuKepala
              key={kepala.kepalaId}
              kepala={kepala}
              isTerpilih={kepala.kepalaId === kepalaTerpilih?.kepalaId}
              onPilih={() => setKepalaTerpilihId(kepala.kepalaId)}
            />
          ))}
        </div>
      )}

      {hasil && kepalaTerpilih && (
        <TabelAnggota sales={hasil.sales} kepalaId={kepalaTerpilih.kepalaId} namaKepala={kepalaTerpilih.nama} />
      )}

      <div className="space-y-1 text-sm text-gray-500">
        <p>Sales: {teksBobot(BOBOT_PENILAIAN_SALES, LABEL_INDIKATOR_SALES)}.</p>
        <p>Kepala sales: {teksBobot(BOBOT_PENILAIAN_KEPALA, LABEL_INDIKATOR_KEPALA)}.</p>
        <p>
          Indikator yang belum bisa diukur (mis. target belum ditetapkan) tidak dihitung; bobotnya dibagi ke
          indikator lain. Laporan rencana yang terlambat dihitung separuh. Predikat: ≥85 sangat baik, ≥70
          baik, ≥55 cukup.
        </p>
      </div>
    </div>
  );
}
