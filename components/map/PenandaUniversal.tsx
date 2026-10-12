"use client";

import dynamic from "next/dynamic";

import { PenandaDapatDiseret } from "./google/PenandaDapatDiseret";
import { PenandaNode } from "./google/PenandaNode";
import type { RagamIkon } from "./google/ikon-node";
import { useMesinPeta } from "./mesin-peta";

const PenandaLeafletCadangan = dynamic(
  () =>
    import("./leaflet/PenandaLeafletCadangan").then(
      (mod) => mod.PenandaLeafletCadangan,
    ),
  { ssr: false },
);

interface PenandaUniversalProps {
  posisi: { lat: number; lng: number };
  type: string;
  ragam?: RagamIkon;
  /** Diredupkan untuk node yang hanya menjadi latar. */
  redup?: boolean;
  /** Warna pengganti warna tipe node, untuk penanda non-perangkat. */
  warna?: string;
  zIndex?: number;
  title?: string;
  onKlik?: () => void;
  /** Diisi berarti penandanya bisa diseret; kosong berarti tetap. */
  onPindah?: (lat: number, lng: number) => void;
  popup?: React.ReactNode;
}

/**
 * Satu penanda peta, lepas dari mesin yang dipakai.
 *
 * Mesinnya dibaca dari `useMesinPeta`, sumber yang sama dengan
 * `PetaUniversal` — penanda Google di dalam kanvas Leaflet (atau sebaliknya)
 * tidak tampil sama sekali dan tidak melaporkan galat apa pun, jadi keduanya
 * tidak boleh pernah memutuskan sendiri-sendiri.
 */
export function PenandaUniversal({
  posisi,
  type,
  ragam = "biasa",
  redup,
  warna,
  zIndex,
  title,
  onKlik,
  onPindah,
  popup,
}: PenandaUniversalProps) {
  const mesin = useMesinPeta();

  if (mesin === "leaflet") {
    return (
      <PenandaLeafletCadangan
        posisi={[posisi.lat, posisi.lng]}
        type={type}
        terpilih={ragam === "terpilih"}
        sementara={ragam === "sementara"}
        redup={redup}
        warna={warna}
        zIndex={zIndex}
        title={title}
        onKlik={onKlik}
        onPindah={onPindah}
        popup={popup}
      />
    );
  }

  if (onPindah) {
    return (
      <PenandaDapatDiseret
        posisi={posisi}
        type={type}
        ragam={ragam}
        zIndex={zIndex}
        title={title}
        onPindah={onPindah}
        popup={popup}
      />
    );
  }

  return (
    <PenandaNode
      posisi={posisi}
      type={type}
      ragam={ragam}
      redup={redup}
      warna={warna}
      zIndex={zIndex}
      title={title}
      onKlik={onKlik}
      popup={popup}
    />
  );
}
