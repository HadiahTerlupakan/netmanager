"use client";

import { Marker, Popup } from "react-leaflet";

import {
  createDotIcon,
  createNodeIcon,
  createTempMarkerIcon,
} from "../map-icon-factory";

interface PenandaLeafletCadanganProps {
  posisi: [number, number];
  type: string;
  terpilih?: boolean;
  sementara?: boolean;
  redup?: boolean;
  /** Warna pengganti warna tipe node; penandanya jadi bulat polos. */
  warna?: string;
  zIndex?: number;
  title?: string;
  onKlik?: () => void;
  onPindah?: (lat: number, lng: number) => void;
  popup?: React.ReactNode;
}

/**
 * Penanda Leaflet dengan ikon node yang sama seperti versi Google.
 *
 * Pasangan cadangan `PenandaUniversal`; dipilih bersama kanvasnya lewat
 * `useMesinPeta`, karena penanda Leaflet di dalam kanvas Google (atau
 * sebaliknya) tidak tampil sama sekali dan tidak melaporkan apa pun.
 */
export function PenandaLeafletCadangan({
  posisi,
  type,
  terpilih,
  sementara,
  redup,
  warna,
  zIndex,
  title,
  onKlik,
  onPindah,
  popup,
}: PenandaLeafletCadanganProps) {
  const ikon = warna
    ? createDotIcon(warna, terpilih)
    : sementara
      ? createTempMarkerIcon(type)
      : createNodeIcon(type, terpilih);

  return (
    <Marker
      position={posisi}
      icon={ikon}
      title={title}
      zIndexOffset={zIndex}
      opacity={redup ? OPASITAS_REDUP : 1}
      draggable={Boolean(onPindah)}
      eventHandlers={{
        click: () => onKlik?.(),
        dragend: (e) => {
          const tujuan = e.target.getLatLng();
          onPindah?.(tujuan.lat, tujuan.lng);
        },
      }}
    >
      {popup && <Popup>{popup}</Popup>}
    </Marker>
  );
}

/** Sama dengan versi Google (`components/map/google/ikon-node.tsx`). */
const OPASITAS_REDUP = 0.4;
