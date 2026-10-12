"use client";

import { InfoWindow, Polyline } from "@vis.gl/react-google-maps";
import { useState } from "react";

import { getFiberColor } from "../map-utils";

export interface TitikJalur {
  lat: number;
  lng: number;
}

interface JalurKabelProps {
  /** Sumber → titik belok → tujuan, sudah lengkap. */
  jejak: TitikJalur[];
  fiberType?: string | null;
  bobot?: number;
  /** Garis putus-putus untuk jalur yang masih digambar. */
  pratinjau?: boolean;
  /** Isi info window saat garis diklik; tanpa ini garis tidak bisa diklik. */
  popup?: React.ReactNode;
}

const BOBOT_BAWAAN = 5;
const BOBOT_PRATINJAU = 3;

/**
 * Satu jalur kabel di peta Google.
 *
 * Warnanya dari `getFiberColor`, daftar yang sama dengan peta operasional dan
 * mobile — jenis kabel harus terbaca sama di mana pun ia muncul.
 *
 * Info window diletakkan di titik tengah jejak, bukan di tempat klik: Google
 * tidak memberi posisi klik pada `Polyline` dengan bentuk yang stabil, dan
 * popup yang melompat-lompat mengikuti klik lebih membingungkan daripada
 * popup yang selalu muncul di tempat yang sama.
 */
export function JalurKabel({
  jejak,
  fiberType,
  bobot,
  pratinjau,
  popup,
}: JalurKabelProps) {
  const [popupTerbuka, setPopupTerbuka] = useState(false);

  if (jejak.length < 2) return null;

  const warna = getFiberColor(fiberType);
  const tengah = jejak[Math.floor(jejak.length / 2)];

  return (
    <>
      <Polyline
        path={jejak}
        strokeColor={warna}
        strokeOpacity={pratinjau ? 0.7 : 1}
        strokeWeight={bobot ?? (pratinjau ? BOBOT_PRATINJAU : BOBOT_BAWAAN)}
        clickable={Boolean(popup)}
        onClick={() => {
          if (popup) setPopupTerbuka(true);
        }}
      />

      {popup && popupTerbuka && (
        <InfoWindow
          position={tengah}
          onCloseClick={() => setPopupTerbuka(false)}
        >
          {popup}
        </InfoWindow>
      )}
    </>
  );
}
