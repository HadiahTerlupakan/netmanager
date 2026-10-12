"use client";

import Link from "next/link";

import { PenandaUniversal } from "@/components/map/PenandaUniversal";
import { PetaUniversal } from "@/components/map/PetaUniversal";

import { KegiatanPetaKeterangan } from "./KegiatanPetaKeterangan";
import type { TitikKegiatan } from "./titikPeta";

interface Props {
  titik: TitikKegiatan[];
  tanpaKoordinat: number;
  diLuarBatas: number;
}

/** Pusat peta sebelum ada titik yang bisa dijadikan acuan: Monas, Jakarta. */
const PUSAT_AWAL = { lat: -6.208763, lng: 106.845599 };
const ZOOM_AWAL = 12;
const TINGGI_PETA_PX = 480;

/**
 * Peta kunjungan sales: satu penanda per kegiatan berkoordinat.
 *
 * Dulu OpenLayers berpetak OpenStreetMap, dengan ~240 baris pengelolaan
 * layer, feature, style, dan overlay popup secara imperatif. Kini memakai
 * kanvas yang sama dengan seluruh aplikasi, sehingga peta kunjungan ini
 * memperlihatkan citra satelit yang sama dengan peta jaringan.
 *
 * Warna penanda tetap dari `titikPeta.ts`, sejajar dengan badge hasil di
 * daftar — bukan warna tipe perangkat, karena ini bukan perangkat.
 */
export default function KegiatanPeta({
  titik,
  tanpaKoordinat,
  diLuarBatas,
}: Props) {
  const koordinat = titik.map((satu) => ({
    lat: satu.latitude,
    lng: satu.longitude,
  }));

  return (
    <div className="p-4">
      <div
        style={{ height: TINGGI_PETA_PX }}
        className="w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <PetaUniversal
          pusat={koordinat[0] ?? PUSAT_AWAL}
          zoom={ZOOM_AWAL}
          titikPas={koordinat}
        >
          {titik.map((satu) => (
            <PenandaUniversal
              key={satu.id}
              posisi={{ lat: satu.latitude, lng: satu.longitude }}
              type="ont"
              warna={satu.warna}
              title={satu.label}
              popup={<RingkasanKegiatan titik={satu} />}
            />
          ))}
        </PetaUniversal>
      </div>

      <KegiatanPetaKeterangan
        tanpaKoordinat={tanpaKoordinat}
        diLuarBatas={diLuarBatas}
      />
    </div>
  );
}

/** Isi popup satu kegiatan. */
function RingkasanKegiatan({ titik }: { titik: TitikKegiatan }) {
  return (
    <div className="min-w-[200px]">
      <p className="text-sm font-semibold text-gray-900">{titik.label}</p>
      {titik.alamat && (
        <p className="mt-1 text-xs text-gray-500">{titik.alamat}</p>
      )}
      <Link
        href={`/admin/presurvei/kegiatan/${titik.id}`}
        className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline"
      >
        Lihat detail
      </Link>
    </div>
  );
}
