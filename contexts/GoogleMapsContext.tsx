"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { createContext, useContext, useEffect, useState } from "react";

import { clientLogger } from "@/lib/client-logger";

/**
 * Setelan Google Maps untuk seluruh layar peta.
 *
 * `APIProvider` dipasang SEKALI di sini, bukan di tiap komponen peta. Setiap
 * pemasangan memuat skrip Maps tersendiri, dan setiap pemuatan dihitung
 * sebagai *map load* berbayar — dengan tujuh permukaan berpeta, memasangnya
 * per komponen akan melipatgandakan tagihan tanpa menambah apa pun.
 */
interface NilaiGoogleMaps {
  /** Peta boleh dirender: key dan Map ID sudah terisi dan fiturnya aktif. */
  siap: boolean;
  /** Map ID berbasis cloud; `AdvancedMarker` tidak tampil tanpanya. */
  mapId: string;
  /** Setelan masih diambil; belum tentu belum dikonfigurasi. */
  memuat: boolean;
}

const NILAI_AWAL: NilaiGoogleMaps = { siap: false, mapId: "", memuat: true };

const GoogleMapsContext = createContext<NilaiGoogleMaps>(NILAI_AWAL);

interface SetelanPeta {
  enabled: boolean;
  apiKey: string;
  mapId: string;
}

export function GoogleMapsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [setelan, setSetelan] = useState<SetelanPeta | null>(null);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let dibatalkan = false;

    async function ambilSetelan() {
      try {
        const respons = await fetch("/api/settings/maps");
        if (!respons.ok) return;

        const badan = await respons.json();
        if (!dibatalkan) setSetelan(badan.data ?? null);
      } catch (error) {
        clientLogger.error("Gagal memuat setelan peta:", error);
      } finally {
        if (!dibatalkan) setMemuat(false);
      }
    }

    void ambilSetelan();
    return () => {
      dibatalkan = true;
    };
  }, []);

  // Endpoint-nya sudah menahan key saat fitur belum siap, jadi `apiKey` yang
  // terisi berarti setelannya lengkap. Diperiksa ulang di sini supaya
  // komponen ini tetap benar bila kelak dipakai dengan sumber lain.
  const siap = Boolean(setelan?.enabled && setelan.apiKey && setelan.mapId);
  const nilai: NilaiGoogleMaps = {
    siap,
    mapId: setelan?.mapId ?? "",
    memuat,
  };

  // Tanpa key, `APIProvider` tidak dipasang sama sekali: memasangnya dengan
  // key kosong membuat SDK Google mengeluh ke konsol di setiap halaman admin,
  // termasuk yang tidak punya peta.
  if (!siap) {
    return (
      <GoogleMapsContext.Provider value={nilai}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  return (
    <GoogleMapsContext.Provider value={nilai}>
      <APIProvider apiKey={setelan!.apiKey}>{children}</APIProvider>
    </GoogleMapsContext.Provider>
  );
}

/**
 * Kesiapan peta Google.
 *
 * Mengembalikan nilai bawaan di luar provider alih-alih melempar: komponen
 * peta dipakai juga di cerita uji dan di layar yang belum dibungkus, dan
 * "peta belum siap" adalah jawaban yang benar di sana.
 */
export function useGoogleMaps(): NilaiGoogleMaps {
  return useContext(GoogleMapsContext);
}
