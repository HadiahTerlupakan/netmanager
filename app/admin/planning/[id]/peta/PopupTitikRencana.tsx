"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { useMesinPeta } from "@/components/map/mesin-peta";
import { Button } from "@/components/ui/Button";
import type { TitikRencanaDTO } from "@/modules/planning/client";

/**
 * Panel pemandangan jalan hanya dimuat ketika benar-benar dibuka — ia
 * menarik pustaka `streetView` milik Google, dan sebagian besar pemakaian
 * peta tidak memerlukannya.
 */
const PanelStreetView = dynamic(
  () => import("./PanelStreetView").then((mod) => mod.PanelStreetView),
  { ssr: false },
);

interface KontrolFotoTitikProps {
  titik: TitikRencanaDTO;
  sedangUnggahFoto: boolean;
  onUnggahFoto: (nodeId: string, file: File) => void;
}

/**
 * Pemilih satu foto survei untuk sebuah titik.
 *
 * Dipakai titik rencana maupun titik yang sudah terbit dari rencana ini:
 * unggah foto sengaja TIDAK terkunci status (lihat `PlanningDocumentService`),
 * karena foto hasil pekerjaan baru ada setelah titiknya dibangun.
 */
export function KontrolFotoTitik({
  titik,
  sedangUnggahFoto,
  onUnggahFoto,
}: KontrolFotoTitikProps) {
  const inputFoto = useRef<HTMLInputElement | null>(null);

  const pilihFoto = (daftar: FileList | null) => {
    const file = daftar?.[0];
    if (file) onUnggahFoto(titik.nodeId, file);
    // Dikosongkan supaya memilih berkas yang sama dua kali tetap memicu
    // `change` — kalau tidak, unggah ulang setelah gagal tampak diam saja.
    if (inputFoto.current) inputFoto.current.value = "";
  };

  return (
    <div>
      <label
        className="block text-xs font-medium text-gray-600 dark:text-gray-300"
        htmlFor={`foto-titik-${titik.nodeId}`}
      >
        Foto survei titik ini
      </label>
      <input
        ref={inputFoto}
        id={`foto-titik-${titik.nodeId}`}
        type="file"
        accept="image/*"
        disabled={sedangUnggahFoto}
        className="mt-1 w-full text-xs"
        onChange={(e) => pilihFoto(e.target.files)}
      />
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        {sedangUnggahFoto
          ? "Mengunggah foto…"
          : "Hanya gambar, maksimal 5MB. Foto tersimpan di tab Dokumen."}
      </p>
    </div>
  );
}

interface PopupTitikRencanaProps {
  titik: TitikRencanaDTO;
  /** Permission DAN status yang masih boleh diubah (`actions.canEdit`). */
  dapatDiubah: boolean;
  /** Izin `planning:update` saja; unggah foto tidak terkunci status rencana. */
  dapatUnggahFoto: boolean;
  sedangDihapus: boolean;
  sedangDiubah: boolean;
  sedangUnggahFoto: boolean;
  onUbah: (titik: TitikRencanaDTO) => void;
  onHapus: (titik: TitikRencanaDTO) => void;
  onUnggahFoto: (nodeId: string, file: File) => void;
}

/**
 * Isi popup satu titik rencana di peta.
 *
 * Dipisah dari kanvas Leaflet karena di sinilah tiga aksi per titik tinggal —
 * ubah, hapus, unggah foto — dan popup Leaflet baru masuk DOM ketika dibuka,
 * sehingga aksi-aksinya tidak bisa diuji lewat kanvas.
 */
export function PopupTitikRencana({
  titik,
  dapatDiubah,
  dapatUnggahFoto,
  sedangDihapus,
  sedangDiubah,
  sedangUnggahFoto,
  onUbah,
  onHapus,
  onUnggahFoto,
}: PopupTitikRencanaProps) {
  return (
    <div className="min-w-[200px] space-y-2 text-sm">
      <div className="space-y-1">
        <p className="font-semibold">{titik.name ?? "Tanpa nama"}</p>
        <p className="text-gray-500">
          {titik.type.toUpperCase()} · rencana
          {titik.splitter ? ` · splitter ${titik.splitter}` : ""}
        </p>
      </div>

      {dapatDiubah && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            loading={sedangDiubah}
            disabled={sedangDiubah}
            onClick={() => onUbah(titik)}
          >
            Ubah titik
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={sedangDihapus}
            disabled={sedangDihapus}
            onClick={() => onHapus(titik)}
          >
            Hapus titik
          </Button>
        </div>
      )}

      {dapatUnggahFoto && (
        <KontrolFotoTitik
          titik={titik}
          sedangUnggahFoto={sedangUnggahFoto}
          onUnggahFoto={onUnggahFoto}
        />
      )}

      <TombolStreetView titik={titik} />
    </div>
  );
}

/**
 * Pembuka pemandangan jalan pada koordinat titik.
 *
 * Hanya ditawarkan saat mesin petanya Google: pustaka Street View datang
 * bersama SDK Maps JavaScript, jadi selama API key belum terisi dan peta
 * masih memakai Leaflet, tombol ini tidak punya apa pun untuk dibuka.
 * Menyembunyikannya lebih jujur daripada tombol yang selalu gagal.
 */
function TombolStreetView({ titik }: { titik: TitikRencanaDTO }) {
  const mesin = useMesinPeta();
  const [terbuka, setTerbuka] = useState(false);

  if (mesin !== "google") return null;
  if (titik.latitude === null || titik.longitude === null) return null;

  if (!terbuka) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setTerbuka(true)}
        className="w-full"
      >
        Lihat dari jalan
      </Button>
    );
  }

  return (
    <PanelStreetView posisi={{ lat: titik.latitude, lng: titik.longitude }} />
  );
}
