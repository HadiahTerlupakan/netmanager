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
  /** Warna pengganti warna jenis kabel, untuk garis non-kabel. */
  warna?: string;
  bobot?: number;
  /** Garis putus-putus: jalur rencana, atau jalur yang sedang digambar. */
  putus?: boolean;
  /** Garis tipis separuh tembus untuk jalur yang masih digambar. */
  pratinjau?: boolean;
  opasitas?: number;
  /** Isi info window saat garis diklik; tanpa ini garis tidak bisa diklik. */
  popup?: React.ReactNode;
}

const BOBOT_BAWAAN = 5;
const BOBOT_PRATINJAU = 3;

/**
 * Pola garis putus-putus.
 *
 * Google tidak punya `dashArray`: garisnya dibuat tembus pandang, lalu
 * sederet simbol garis pendek diulang sepanjang jejaknya. `path` ditulis
 * sebagai string SVG, bukan `google.maps.SymbolPath`, supaya berkas ini tidak
 * menyentuh global `google` saat dirender — di jsdom global itu tidak ada.
 */
const SIMBOL_PUTUS = [
  {
    icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
    offset: "0",
    repeat: "20px",
  },
];

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
  warna,
  bobot,
  putus,
  pratinjau,
  opasitas,
  popup,
}: JalurKabelProps) {
  const [popupTerbuka, setPopupTerbuka] = useState(false);

  if (jejak.length < 2) return null;

  const tengah = jejak[Math.floor(jejak.length / 2)];
  const opasitasGaris = opasitas ?? (pratinjau ? 0.7 : 1);

  return (
    <>
      <Polyline
        path={jejak}
        strokeColor={warna ?? getFiberColor(fiberType)}
        // Garis putus dibentuk oleh simbolnya, jadi garis dasarnya sendiri
        // harus tak terlihat — bukan sekadar diredupkan.
        strokeOpacity={putus ? 0 : opasitasGaris}
        strokeWeight={bobot ?? (pratinjau ? BOBOT_PRATINJAU : BOBOT_BAWAAN)}
        icons={putus ? SIMBOL_PUTUS : undefined}
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
