import { PenandaUniversal } from "./PenandaUniversal";

export type PosisiPeta = [number, number];

/** Satu penanda yang belum tersimpan, hasil klik peta atau pindah lokasi. */
export interface TitikSementara {
  /** Alat yang membuatnya; dipakai sebagai key React. */
  alat: string;
  /** Tipe node untuk ikonnya: olt, odc, odp, ont, pole, joinbox. */
  jenisIkon: string;
  /** Judul popup: "New ODC Position" atau "Editing Position". */
  label: string;
  posisi: PosisiPeta;
  pindahkan: (posisi: PosisiPeta) => void;
}

interface PenandaSementaraPetaProps {
  titik: TitikSementara[];
}

/** Enam desimal ≈ 11 cm; lebih dari itu hanya derau GPS. */
const DESIMAL_KOORDINAT = 6;

/**
 * Penanda yang masih bisa digeser sebelum disimpan.
 *
 * Dulu enam blok hampir identik — satu per alat — yang masing-masing menerima
 * posisi dan setter-nya sendiri sebagai prop, dua belas prop hanya untuk ini.
 * Kini satu daftar: alat yang punya posisi sementara menyumbang satu titik,
 * dan menambah alat baru tidak lagi berarti menyalin satu blok lagi.
 *
 * Koordinatnya ditampilkan di semua penanda, bukan hanya penanda server
 * seperti versi lama: pemakai yang menyeret penanda perlu tahu ia berhenti
 * di mana, tipe apa pun itu.
 */
export function PenandaSementaraPeta({ titik }: PenandaSementaraPetaProps) {
  return (
    <>
      {titik.map((satu) => (
        <PenandaUniversal
          key={satu.alat}
          posisi={{ lat: satu.posisi[0], lng: satu.posisi[1] }}
          type={satu.jenisIkon}
          ragam="sementara"
          title={satu.label}
          onPindah={(lat, lng) => satu.pindahkan([lat, lng])}
          popup={
            <div className="text-sm">
              <p className="mb-1 font-semibold">{satu.label}</p>
              <p className="text-xs text-gray-600">
                Drag marker to adjust position
              </p>
              <p className="mt-1 font-mono text-xs text-gray-500">
                {satu.posisi[0].toFixed(DESIMAL_KOORDINAT)},{" "}
                {satu.posisi[1].toFixed(DESIMAL_KOORDINAT)}
              </p>
            </div>
          }
        />
      ))}
    </>
  );
}
