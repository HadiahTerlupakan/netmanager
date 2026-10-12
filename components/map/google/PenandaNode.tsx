"use client";

import { AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { useState } from "react";

import { IkonNode, type RagamIkon } from "./ikon-node";

interface PenandaNodeProps {
  posisi: { lat: number; lng: number };
  type: string;
  ragam?: RagamIkon;
  /** Diredupkan untuk node nyata yang hanya menjadi latar peta rencana. */
  redup?: boolean;
  /** Warna pengganti warna tipe node; lihat `IkonNode`. */
  warna?: string;
  /** Urutan tumpuk; penanda rencana harus berada di atas node latar. */
  zIndex?: number;
  title?: string;
  onKlik?: () => void;
  /** Isi info window; tanpa ini penanda tidak punya popup sama sekali. */
  popup?: React.ReactNode;
}

/**
 * Satu titik jaringan di peta Google.
 *
 * `AdvancedMarker` menuntut `mapId` pada `Map`-nya — tanpa itu penanda tidak
 * tampil sama sekali dan tidak ada galat yang muncul. `PetaGoogle` selalu
 * memasangnya, dan setelan peta menolak aktif tanpa Map ID; keduanya menjaga
 * kegagalan sunyi itu tidak pernah sampai ke layar.
 *
 * Info window dikelola di sini, bukan oleh pemanggil, supaya setiap peta
 * memperlakukan popup dengan cara yang sama: satu penanda, satu popup, dan
 * mengklik penanda lain menutup yang sebelumnya.
 */
export function PenandaNode({
  posisi,
  type,
  ragam = "biasa",
  redup,
  warna,
  zIndex,
  title,
  onKlik,
  popup,
}: PenandaNodeProps) {
  const [popupTerbuka, setPopupTerbuka] = useState(false);

  return (
    <>
      <AdvancedMarker
        position={posisi}
        zIndex={zIndex}
        title={title}
        onClick={() => {
          if (popup) setPopupTerbuka(true);
          onKlik?.();
        }}
      >
        <IkonNode type={type} ragam={ragam} redup={redup} warna={warna} />
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
