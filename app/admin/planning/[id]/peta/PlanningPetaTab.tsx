"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { HiOutlineMapPin, HiOutlineShare } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import {
  calculateMapDistance,
  determineFiberType,
} from "@/components/map/map-utils";
import type { Coordinates, TitikRencanaDTO } from "@/modules/planning/client";

import { FormTitikRencana, type KoordinatTeks } from "./FormTitikRencana";
import { PanelRingkasanMaterial } from "./PanelRingkasanMaterial";
import type { JalurDraf } from "./PetaRencanaLeaflet";
import { usePetaRencana, type PesanPeta } from "./usePetaRencana";

// Leaflet menyentuh `window` saat modulnya dimuat, jadi peta hanya boleh
// dirender di klien — pola yang sama dengan `components/map/MapWrapper.tsx`.
const PetaRencanaLeaflet = dynamic(() => import("./PetaRencanaLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] w-full items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
  ),
});

interface PlanningPetaTabProps {
  planningId: string;
  /** Koordinat lokasi rencana, dipakai memusatkan peta saat belum ada titik. */
  koordinatPlanning: Coordinates | null;
  /** Permission DAN status yang masih boleh diubah (`actions.canEdit`). */
  dapatDiubah: boolean;
}

type ModePeta = "titik" | "jalur";

const JENIS_KABEL: Array<{ nilai: string; label: string }> = [
  { nilai: "feeder", label: "Feeder (backbone)" },
  { nilai: "distribution", label: "Distribution (ODC ke ODP)" },
  { nilai: "drop", label: "Drop" },
  { nilai: "odc_to_odc", label: "ODC ke ODC" },
  { nilai: "odp_to_odp", label: "ODP ke ODP" },
];

/** Jakarta; dipakai hanya bila rencana belum punya titik maupun koordinat. */
const PUSAT_BAWAAN: [number, number] = [-6.2088, 106.8456];

const KELAS_PESAN: Record<PesanPeta["nada"], string> = {
  galat:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
  info: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  sukses:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
};

/** Titik pertama yang berkoordinat, untuk memusatkan peta. */
function cariPusat(
  titik: TitikRencanaDTO[],
  koordinatPlanning: Coordinates | null,
): [number, number] {
  const berkoordinat = titik.find(
    (satu) => satu.latitude !== null && satu.longitude !== null,
  );
  if (berkoordinat) {
    return [berkoordinat.latitude!, berkoordinat.longitude!];
  }
  if (koordinatPlanning) {
    return [koordinatPlanning.latitude, koordinatPlanning.longitude];
  }
  return PUSAT_BAWAAN;
}

/** Koordinat draf dari teks di form; null selama angkanya belum lengkap. */
function koordinatDrafDari(koordinat: KoordinatTeks): [number, number] | null {
  const latitude = Number(koordinat.latitude);
  const longitude = Number(koordinat.longitude);
  if (!koordinat.latitude.trim() || !koordinat.longitude.trim()) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return [latitude, longitude];
}

/**
 * Tab Peta pada detail Planning OSP: titik dan jalur rencana di atas jaringan
 * yang sudah berdiri, plus rekap kebutuhan material yang lahir darinya.
 */
export default function PlanningPetaTab({
  planningId,
  koordinatPlanning,
  dapatDiubah,
}: PlanningPetaTabProps) {
  const {
    peta,
    rekap,
    sedangMemuat,
    pesan,
    bersihkanPesan,
    sedangMenyimpanTitik,
    sedangMenyimpanJalur,
    sedangMenerbitkan,
    tambahTitik,
    hapusTitik,
    tambahJalur,
    hapusJalur,
    terbitkanMaterial,
  } = usePetaRencana(planningId);

  const [mode, setMode] = useState<ModePeta>("titik");
  const [koordinat, setKoordinat] = useState<KoordinatTeks>({
    latitude: "",
    longitude: "",
  });
  const [jalurDraf, setJalurDraf] = useState<JalurDraf | null>(null);
  const [tujuanJalur, setTujuanJalur] = useState<TitikRencanaDTO | null>(null);
  const [jenisKabel, setJenisKabel] = useState("distribution");
  const [persenDipilih, setPersenDipilih] = useState<number | null>(null);

  const titikRencana = peta?.titik ?? [];
  const nodeNyata = peta?.nodeNyata ?? [];
  const persenCadangan = persenDipilih ?? rekap?.spareKabelPersen ?? 0;

  const batalkanJalur = () => {
    setJalurDraf(null);
    setTujuanJalur(null);
  };

  const gantiMode = (modeBaru: ModePeta) => {
    setMode(modeBaru);
    batalkanJalur();
  };

  const klikPeta = (latitude: number, longitude: number) => {
    if (mode === "titik") {
      setKoordinat({
        latitude: String(latitude),
        longitude: String(longitude),
      });
      return;
    }
    // Dalam mode jalur, klik di kanvas adalah titik belok — hanya setelah
    // titik asal dipilih dan sebelum tujuan ditentukan.
    if (!jalurDraf || tujuanJalur) return;
    setJalurDraf({
      ...jalurDraf,
      waypoints: [...jalurDraf.waypoints, [latitude, longitude]],
    });
  };

  const klikTitik = (titik: TitikRencanaDTO) => {
    if (mode !== "jalur" || !dapatDiubah) return;
    if (!jalurDraf) {
      setJalurDraf({ sumber: titik, waypoints: [] });
      return;
    }
    if (titik.nodeId === jalurDraf.sumber.nodeId) {
      batalkanJalur();
      return;
    }
    setTujuanJalur(titik);
    setJenisKabel(determineFiberType(jalurDraf.sumber.type, titik.type));
  };

  const simpanJalur = async () => {
    if (!jalurDraf || !tujuanJalur) return;
    const asal = jalurDraf.sumber;
    if (
      asal.latitude === null ||
      asal.longitude === null ||
      tujuanJalur.latitude === null ||
      tujuanJalur.longitude === null
    ) {
      return;
    }

    const tersimpan = await tambahJalur({
      source: asal.nodeId,
      target: tujuanJalur.nodeId,
      fiberType: jenisKabel,
      waypoints: jalurDraf.waypoints,
      distance: calculateMapDistance(
        asal.latitude,
        asal.longitude,
        tujuanJalur.latitude,
        tujuanJalur.longitude,
        jalurDraf.waypoints,
      ),
      notes: null,
    });

    if (tersimpan) batalkanJalur();
  };

  if (sedangMemuat && !peta) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pesan && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${KELAS_PESAN[pesan.nada]}`}
        >
          <p>{pesan.teks}</p>
          <button
            type="button"
            onClick={bersihkanPesan}
            className="text-xs underline"
          >
            Tutup
          </button>
        </div>
      )}

      {dapatDiubah && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={mode === "titik" ? "default" : "outline"}
            onClick={() => gantiMode("titik")}
          >
            <HiOutlineMapPin className="h-4 w-4" />
            Tandai titik
          </Button>
          <Button
            size="sm"
            variant={mode === "jalur" ? "default" : "outline"}
            onClick={() => gantiMode("jalur")}
          >
            <HiOutlineShare className="h-4 w-4" />
            Gambar jalur
          </Button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {mode === "titik"
              ? "Klik peta untuk mengisi koordinat titik baru."
              : "Klik titik asal, klik peta untuk titik belok, lalu klik titik tujuan."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <PetaRencanaLeaflet
            titikRencana={titikRencana}
            nodeNyata={nodeNyata}
            jalur={peta?.jalur ?? []}
            pusat={cariPusat(
              [...titikRencana, ...nodeNyata],
              koordinatPlanning,
            )}
            koordinatDraf={koordinatDrafDari(koordinat)}
            jalurDraf={jalurDraf}
            sedangGambarJalur={mode === "jalur"}
            dapatDiubah={dapatDiubah}
            onKlikPeta={klikPeta}
            onKlikTitik={klikTitik}
            onHapusTitik={hapusTitik}
            onHapusJalur={hapusJalur}
          />

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Penanda redup adalah node jaringan yang sudah terpasang. Titik
            rencana tampil penuh dan bisa disambung ke node redup itu.
          </p>

          {jalurDraf && tujuanJalur && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Jalur baru: {jalurDraf.sumber.name ?? "titik asal"} →{" "}
                {tujuanJalur.name ?? "titik tujuan"}
              </h3>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300"
                    htmlFor="jalur-jenis-kabel"
                  >
                    Jenis kabel
                  </label>
                  <select
                    id="jalur-jenis-kabel"
                    value={jenisKabel}
                    onChange={(e) => setJenisKabel(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {JENIS_KABEL.map((pilihan) => (
                      <option key={pilihan.nilai} value={pilihan.nilai}>
                        {pilihan.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  loading={sedangMenyimpanJalur}
                  disabled={sedangMenyimpanJalur}
                  onClick={simpanJalur}
                >
                  Simpan jalur
                </Button>
                <Button size="sm" variant="outline" onClick={batalkanJalur}>
                  Batal
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <FormTitikRencana
            koordinat={koordinat}
            onKoordinatChange={setKoordinat}
            sedangMenyimpan={sedangMenyimpanTitik}
            dapatDiubah={dapatDiubah}
            onSimpan={tambahTitik}
          />
          <PanelRingkasanMaterial
            rekap={rekap}
            sedangMemuat={sedangMemuat}
            persenCadangan={persenCadangan}
            onPersenCadanganChange={setPersenDipilih}
            sedangMenerbitkan={sedangMenerbitkan}
            dapatMenerbitkan={dapatDiubah}
            onTerbitkan={() => void terbitkanMaterial(persenCadangan)}
          />
        </div>
      </div>
    </div>
  );
}
