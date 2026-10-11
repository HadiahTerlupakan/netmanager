"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMapEvents,
} from "react-leaflet";

import { Button } from "@/components/ui/Button";
import { MapDrawingOverlay } from "@/components/map/MapDrawingOverlay";
import { MAP_CONSTANTS, MAP_TILE_URL } from "@/components/map/map-constants";
import {
  createNodeIcon,
  createTempMarkerIcon,
} from "@/components/map/map-icon-factory";
import {
  calculateMapDistance,
  getFiberColor,
} from "@/components/map/map-utils";
import type {
  JalurRencanaDTO,
  TitikRencanaDTO,
} from "@/modules/planning/client";

import { KontrolFotoTitik, PopupTitikRencana } from "./PopupTitikRencana";

/** Jalur yang sedang digambar: titik asal plus titik belok yang sudah diklik. */
export interface JalurDraf {
  sumber: TitikRencanaDTO;
  waypoints: Array<[number, number]>;
}

interface PetaRencanaLeafletProps {
  /** Planning yang petanya digambar; penentu titik nyata mana yang berasal darinya. */
  planningId: string;
  titikRencana: TitikRencanaDTO[];
  /** Node jaringan yang sudah nyata; dirender redup sebagai konteks. */
  nodeNyata: TitikRencanaDTO[];
  jalur: JalurRencanaDTO[];
  pusat: [number, number];
  /** Penanda sementara dari koordinat yang sedang diisi di form. */
  koordinatDraf: [number, number] | null;
  jalurDraf: JalurDraf | null;
  sedangGambarJalur: boolean;
  dapatDiubah: boolean;
  /** Izin `planning:update` saja; unggah foto tidak terkunci status rencana. */
  dapatUnggahFoto: boolean;
  /** `true` selama permintaan hapus untuk id itu berjalan; tombolnya dinonaktifkan. */
  isSedangDihapus: (id: string) => boolean;
  /** `true` selama permintaan ubah titik itu berjalan. */
  isSedangDiubah: (nodeId: string) => boolean;
  /** `true` selama unggah foto titik itu berjalan. */
  isSedangUnggahFoto: (nodeId: string) => boolean;
  onKlikPeta: (latitude: number, longitude: number) => void;
  onKlikTitik: (titik: TitikRencanaDTO) => void;
  onUbahTitik: (titik: TitikRencanaDTO) => void;
  onHapusTitik: (titik: TitikRencanaDTO) => void;
  onUnggahFotoTitik: (nodeId: string, file: File) => void;
  onHapusJalur: (jalur: JalurRencanaDTO) => void;
}

/** Opasitas penanda node nyata: terlihat sebagai latar, tidak bersaing dengan rencana. */
const OPASITAS_NODE_NYATA = 0.4;
const ZOOM_AWAL = 16;
const BOBOT_JALUR_RENCANA = 5;

// Leaflet mencari berkas ikonnya secara relatif terhadap bundel; samakan
// dengan peta operasional (components/map/NetworkMapInteractive.tsx).
if (typeof window !== "undefined") {
  // @ts-expect-error: properti internal Leaflet, dihapus seperti di peta operasional
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/images/marker-icon-2x.png",
    iconUrl: "/images/marker-icon.png",
    shadowUrl: "/images/marker-shadow.png",
  });
}

/** Koordinat lengkap sebuah titik, atau null bila titiknya belum berkoordinat. */
function koordinatTitik(
  titik: TitikRencanaDTO | undefined,
): [number, number] | null {
  if (!titik || titik.latitude === null || titik.longitude === null)
    return null;
  return [titik.latitude, titik.longitude];
}

/** Meneruskan klik pada kanvas peta; Leaflet tidak punya prop untuk ini. */
function PenangkapKlikPeta({
  onKlikPeta,
}: {
  onKlikPeta: (latitude: number, longitude: number) => void;
}): null {
  useMapEvents({
    click: (peristiwa) =>
      onKlikPeta(peristiwa.latlng.lat, peristiwa.latlng.lng),
  });
  return null;
}

/** Panel panjang jalur yang sedang digambar, dihitung ulang tiap titik belok. */
function PanelPanjangJalur({ jalurDraf }: { jalurDraf: JalurDraf }) {
  const asal = koordinatTitik(jalurDraf.sumber);
  const terakhir = jalurDraf.waypoints.at(-1);
  const panjang =
    asal && terakhir
      ? calculateMapDistance(
          asal[0],
          asal[1],
          terakhir[0],
          terakhir[1],
          jalurDraf.waypoints.slice(0, -1),
        )
      : 0;

  return (
    <div className="absolute top-3 left-3 z-1000 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800/95">
      <p className="font-semibold text-gray-900 dark:text-white">
        Menggambar jalur
      </p>
      <p className="mt-1 text-gray-600 dark:text-gray-300">
        Dari {jalurDraf.sumber.name ?? "titik asal"} ·{" "}
        {jalurDraf.waypoints.length} titik belok · {panjang.toFixed(1)} m
      </p>
      <p className="mt-1 text-indigo-600 dark:text-indigo-400">
        Klik peta untuk titik belok, klik titik tujuan untuk menyelesaikan.
      </p>
    </div>
  );
}

/**
 * Kanvas peta perencanaan OSP.
 *
 * Komponen ini tidak menyimpan keadaan: mode, jalur yang sedang digambar, dan
 * koordinat form dikendalikan induknya, supaya form dan panel bisa
 * menampilkan hal yang sama tanpa keadaan ganda. Hanya dimuat lewat
 * `dynamic(..., { ssr: false })` karena Leaflet menyentuh `window`.
 */
export default function PetaRencanaLeaflet({
  planningId,
  titikRencana,
  nodeNyata,
  jalur,
  pusat,
  koordinatDraf,
  jalurDraf,
  sedangGambarJalur,
  dapatDiubah,
  dapatUnggahFoto,
  isSedangDihapus,
  isSedangDiubah,
  isSedangUnggahFoto,
  onKlikPeta,
  onKlikTitik,
  onUbahTitik,
  onHapusTitik,
  onUnggahFotoTitik,
  onHapusJalur,
}: PetaRencanaLeafletProps) {
  const semuaTitik = [...titikRencana, ...nodeNyata];

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
      <MapContainer
        center={pusat}
        zoom={ZOOM_AWAL}
        minZoom={MAP_CONSTANTS.ZOOM.MIN}
        maxZoom={MAP_CONSTANTS.ZOOM.MAX}
        zoomControl={false}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={MAP_TILE_URL.satellite}
          attribution="© Google Maps"
          maxZoom={MAP_CONSTANTS.ZOOM.MAX}
          minZoom={MAP_CONSTANTS.ZOOM.MIN}
        />
        <ZoomControl position="topleft" />
        <PenangkapKlikPeta onKlikPeta={onKlikPeta} />

        {jalur.map((satuJalur) => {
          const asal = koordinatTitik(
            semuaTitik.find((titik) => titik.nodeId === satuJalur.source),
          );
          const tujuan = koordinatTitik(
            semuaTitik.find((titik) => titik.nodeId === satuJalur.target),
          );
          if (!asal || !tujuan) return null;

          const jejak: Array<[number, number]> = [
            asal,
            ...satuJalur.waypoints,
            tujuan,
          ];
          const panjang = calculateMapDistance(
            asal[0],
            asal[1],
            tujuan[0],
            tujuan[1],
            satuJalur.waypoints,
          );

          return (
            <Polyline
              key={satuJalur.edgeId}
              positions={jejak}
              // Seluruh jalur di sini adalah jalur rencana: endpoint peta
              // planning hanya mengembalikan `isPlanned: true`, dan latar
              // node nyata tidak membawa kabelnya. Jadi tidak ada cabang
              // gaya "jalur nyata" — cabang itu tidak akan pernah terpakai.
              pathOptions={{
                color: getFiberColor(satuJalur.fiberType),
                weight: BOBOT_JALUR_RENCANA,
                opacity: 0.9,
                dashArray: "10, 10",
              }}
            >
              <Popup>
                <div className="min-w-[180px] space-y-1 text-sm">
                  <p className="font-semibold">
                    Jalur {satuJalur.fiberType ?? "tanpa jenis"}
                  </p>
                  <p>Panjang: {panjang.toFixed(1)} m</p>
                  {dapatDiubah && (
                    <Button
                      variant="destructive"
                      size="sm"
                      loading={isSedangDihapus(satuJalur.edgeId)}
                      disabled={isSedangDihapus(satuJalur.edgeId)}
                      onClick={() => onHapusJalur(satuJalur)}
                    >
                      Hapus jalur
                    </Button>
                  )}
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {nodeNyata.map((titik) => {
          const posisi = koordinatTitik(titik);
          if (!posisi) return null;
          return (
            <Marker
              key={titik.nodeId}
              position={posisi}
              opacity={OPASITAS_NODE_NYATA}
              icon={createNodeIcon(titik.type)}
              eventHandlers={{ click: () => onKlikTitik(titik) }}
            >
              <Popup>
                <div className="min-w-[180px] space-y-2 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {titik.name ?? "Tanpa nama"}
                    </p>
                    <p className="text-gray-500">
                      {titik.type.toUpperCase()} · jaringan terpasang
                      {titik.planningId === planningId
                        ? " · terbit dari rencana ini"
                        : ""}
                    </p>
                  </div>
                  {/* Titik yang terbit dari rencana ini tetap boleh menerima
                      foto: justru setelah dibangun fotonya ada. Titik milik
                      rencana lain atau yang bukan dari rencana akan ditolak
                      server, jadi kontrolnya tidak ditawarkan. */}
                  {dapatUnggahFoto && titik.planningId === planningId && (
                    <KontrolFotoTitik
                      titik={titik}
                      sedangUnggahFoto={isSedangUnggahFoto(titik.nodeId)}
                      onUnggahFoto={onUnggahFotoTitik}
                    />
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {titikRencana.map((titik) => {
          const posisi = koordinatTitik(titik);
          if (!posisi) return null;
          const terpilihSebagaiAsal = jalurDraf?.sumber.nodeId === titik.nodeId;
          return (
            <Marker
              key={titik.nodeId}
              position={posisi}
              icon={createNodeIcon(titik.type, terpilihSebagaiAsal)}
              eventHandlers={{ click: () => onKlikTitik(titik) }}
            >
              <Popup>
                <PopupTitikRencana
                  titik={titik}
                  dapatDiubah={dapatDiubah}
                  dapatUnggahFoto={dapatUnggahFoto}
                  sedangDihapus={isSedangDihapus(titik.nodeId)}
                  sedangDiubah={isSedangDiubah(titik.nodeId)}
                  sedangUnggahFoto={isSedangUnggahFoto(titik.nodeId)}
                  onUbah={onUbahTitik}
                  onHapus={onHapusTitik}
                  onUnggahFoto={onUnggahFotoTitik}
                />
              </Popup>
            </Marker>
          );
        })}

        {koordinatDraf && !sedangGambarJalur && (
          <Marker position={koordinatDraf} icon={createTempMarkerIcon("odp")} />
        )}

        <MapDrawingOverlay
          fiberLineMode={jalurDraf ? "drawing" : "idle"}
          fiberSourceNode={
            jalurDraf && koordinatTitik(jalurDraf.sumber)
              ? {
                  latitude: jalurDraf.sumber.latitude!,
                  longitude: jalurDraf.sumber.longitude!,
                }
              : null
          }
          fiberWaypoints={jalurDraf?.waypoints ?? []}
        />
      </MapContainer>

      {jalurDraf && <PanelPanjangJalur jalurDraf={jalurDraf} />}
    </div>
  );
}
