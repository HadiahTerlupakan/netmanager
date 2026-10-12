import type { ReactNode } from "react";

/**
 * Tiruan `@vis.gl/react-google-maps` untuk test jsdom.
 *
 * SDK Maps JavaScript tidak bisa dimuat di jsdom: ia menyuntikkan `<script>`
 * ke dokumen, menggambar ke canvas, dan menuntut API key yang sah. Tiruan ini
 * merender tiap komponen menjadi satu elemen DOM biasa berisi `children`-nya,
 * sehingga yang diuji tetap PERILAKU KOMPONEN KITA — penanda mana yang
 * dirender, di koordinat apa, dengan popup apa — bukan SDK Google.
 *
 * Bukan berkas test (tanpa akhiran `.test.tsx`), jadi `vitest.config` tidak
 * menjalankannya sendiri. Pemakainya wajib memasang pragma
 * `// @vitest-environment jsdom` di baris pertamanya sendiri.
 *
 * Pakai:
 *
 *   vi.mock("@vis.gl/react-google-maps", async () =>
 *     (await import("../google-maps-harness")).modulGoogleMapsPalsu(),
 *   );
 */

interface Posisi {
  lat: number;
  lng: number;
}

/**
 * Pengendali interaksi peta yang hanya bisa dipicu lewat SDK asli.
 *
 * Klik kanvas, klik garis, dan selesai-menyeret tidak punya padanan DOM yang
 * wajar di jsdom, jadi handler-nya dicatat di sini dan test memanggilnya
 * langsung — sama seperti pemakai yang mengklik peta.
 */
export const petaPalsu = {
  onKlikPeta: null as ((lat: number, lng: number) => void) | null,
  onSeretSelesai: new Map<string, (lat: number, lng: number) => void>(),

  /** Mengosongkan catatan; panggil di `beforeEach`. */
  reset() {
    this.onKlikPeta = null;
    this.onSeretSelesai.clear();
  },

  /** Meniru pemakai mengklik kanvas peta pada sebuah koordinat. */
  klikPeta(lat: number, lng: number) {
    if (!this.onKlikPeta) {
      throw new Error("Peta tidak memasang penangan klik");
    }
    this.onKlikPeta(lat, lng);
  },

  /** Meniru pemakai menyeret satu penanda ke koordinat baru. */
  seretPenanda(judul: string, lat: number, lng: number) {
    const penangan = this.onSeretSelesai.get(judul);
    if (!penangan) {
      throw new Error(`Penanda "${judul}" tidak bisa diseret`);
    }
    penangan(lat, lng);
  },
};

interface PropsMap {
  children?: ReactNode;
  mapId?: string;
  defaultCenter?: Posisi;
  defaultZoom?: number;
  mapTypeId?: string;
  className?: string;
  onClick?: (e: { detail: { latLng: Posisi | null } }) => void;
}

interface PropsPenanda {
  children?: ReactNode;
  position?: Posisi;
  title?: string;
  zIndex?: number;
  draggable?: boolean;
  onClick?: () => void;
  onDragEnd?: (e: { latLng: { lat: () => number; lng: () => number } }) => void;
}

interface PropsPolyline {
  path?: Posisi[];
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  clickable?: boolean;
  onClick?: () => void;
}

interface PropsInfoWindow {
  children?: ReactNode;
  position?: Posisi;
  onCloseClick?: () => void;
}

/** Modul tiruan; hasilnya dioper apa adanya ke `vi.mock`. */
export function modulGoogleMapsPalsu() {
  function APIProvider({ children }: { children?: ReactNode }) {
    return <div data-google-maps-provider>{children}</div>;
  }

  function Map({
    children,
    mapId,
    defaultCenter,
    defaultZoom,
    mapTypeId,
    className,
    onClick,
  }: PropsMap) {
    petaPalsu.onKlikPeta = onClick
      ? (lat, lng) => onClick({ detail: { latLng: { lat, lng } } })
      : null;

    return (
      <div
        data-peta
        data-map-id={mapId}
        data-pusat={JSON.stringify(defaultCenter ?? null)}
        data-zoom={defaultZoom}
        data-tipe={mapTypeId}
        className={className}
      >
        {children}
      </div>
    );
  }

  function AdvancedMarker({
    children,
    position,
    title,
    zIndex,
    draggable,
    onClick,
    onDragEnd,
  }: PropsPenanda) {
    if (draggable && onDragEnd && title) {
      petaPalsu.onSeretSelesai.set(title, (lat, lng) =>
        onDragEnd({ latLng: { lat: () => lat, lng: () => lng } }),
      );
    }

    return (
      <div
        data-penanda
        data-posisi={JSON.stringify(position ?? null)}
        data-judul={title}
        data-z={zIndex}
        data-dapat-diseret={draggable ? "ya" : undefined}
        onClick={onClick}
      >
        {children}
      </div>
    );
  }

  function Polyline({
    path,
    strokeColor,
    strokeWeight,
    strokeOpacity,
    clickable,
    onClick,
  }: PropsPolyline) {
    return (
      <div
        data-jalur
        data-jejak={JSON.stringify(path ?? [])}
        data-warna={strokeColor}
        data-bobot={strokeWeight}
        data-opasitas={strokeOpacity}
        data-dapat-diklik={clickable ? "ya" : undefined}
        onClick={onClick}
      />
    );
  }

  function InfoWindow({ children, position, onCloseClick }: PropsInfoWindow) {
    return (
      <div data-popup data-posisi={JSON.stringify(position ?? null)}>
        <button type="button" data-tutup-popup onClick={onCloseClick}>
          Tutup
        </button>
        {children}
      </div>
    );
  }

  function MapControl({ children }: { children?: ReactNode }) {
    return <div data-kontrol-peta>{children}</div>;
  }

  function Pin() {
    return <div data-pin />;
  }

  return {
    APIProvider,
    Map,
    AdvancedMarker,
    Polyline,
    InfoWindow,
    MapControl,
    Pin,
    useMap: (): null => null,
    useMapsLibrary: (): null => null,
    useApiIsLoaded: (): boolean => true,
  };
}

/** Penanda yang sedang dirender, terurut sesuai DOM. */
export function penandaTerender(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>("[data-penanda]")];
}

/** Jalur kabel yang sedang dirender, terurut sesuai DOM. */
export function jalurTerender(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>("[data-jalur]")];
}

/** Koordinat sebuah elemen tiruan, dibaca kembali dari atribut datanya. */
export function posisiElemen(elemen: Element): Posisi | null {
  const mentah = elemen.getAttribute("data-posisi");
  return mentah ? (JSON.parse(mentah) as Posisi | null) : null;
}
