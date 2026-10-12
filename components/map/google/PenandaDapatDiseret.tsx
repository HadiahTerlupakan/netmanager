"use client";

import { AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { useState } from "react";

import { IkonNode, type RagamIkon } from "./ikon-node";

interface PenandaDapatDiseretProps {
  posisi: { lat: number; lng: number };
  type: string;
  ragam?: RagamIkon;
  zIndex?: number;
  title?: string;
  onPindah: (lat: number, lng: number) => void;
  /** Isi info window; penanda sementara memakainya untuk koordinatnya. */
  popup?: React.ReactNode;
}

/**
 * Penanda yang posisinya diatur dengan menyeret.
 *
 * Dipakai pemilih koordinat dan penanda sementara di peta jaringan. Dipisah
 * dari `PenandaNode` karena keduanya berbeda tanggung jawab: yang satu
 * menampilkan titik yang sudah ada, yang ini menghasilkan koordinat baru.
 *
 * `dragend` Google mengembalikan `latLng` yang bisa null bila peta sedang
 * dibongkar di tengah seretan; posisi lama dipertahankan alih-alih
 * memanggil balik dengan NaN.
 */
export function PenandaDapatDiseret({
  posisi,
  type,
  ragam = "sementara",
  zIndex,
  title,
  onPindah,
  popup,
}: PenandaDapatDiseretProps) {
  const [popupTerbuka, setPopupTerbuka] = useState(false);

  return (
    <>
      <AdvancedMarker
        position={posisi}
        zIndex={zIndex}
        title={title}
        draggable
        onClick={() => {
          if (popup) setPopupTerbuka(true);
        }}
        onDragEnd={(e) => {
          const tujuan = e.latLng;
          if (tujuan) onPindah(tujuan.lat(), tujuan.lng());
        }}
      >
        <IkonNode type={type} ragam={ragam} />
      </AdvancedMarker>

      {popup && popupTerbuka && (
        <InfoWindow
          position={posisi}
          onCloseClick={() => setPopupTerbuka(false)}
        >
          {popup}
        </InfoWindow>
      )}
    </>
  );
}
