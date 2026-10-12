"use client";

import { JalurPratinjau } from "@/components/map/JalurPratinjau";
import { JalurUniversal } from "@/components/map/JalurUniversal";
import { PenandaUniversal } from "@/components/map/PenandaUniversal";
import { PetaUniversal } from "@/components/map/PetaUniversal";
import { calculateMapDistance } from "@/components/map/map-utils";
import { Button } from "@/components/ui/Button";
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

interface PetaRencanaProps {
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

const ZOOM_AWAL = 16;
const BOBOT_JALUR_RENCANA = 5;
/** Penanda rencana harus berada di atas node nyata yang jadi latar. */
const Z_TITIK_RENCANA = 500;

/** Koordinat lengkap sebuah titik, atau null bila titiknya belum berkoordinat. */
function koordinatTitik(
  titik: TitikRencanaDTO | undefined,
): { lat: number; lng: number } | null {
  if (!titik || titik.latitude === null || titik.longitude === null)
    return null;
  return { lat: titik.latitude, lng: titik.longitude };
}

/** Panel panjang jalur yang sedang digambar, dihitung ulang tiap titik belok. */
function PanelPanjangJalur({ jalurDraf }: { jalurDraf: JalurDraf }) {
  const asal = koordinatTitik(jalurDraf.sumber);
  const terakhir = jalurDraf.waypoints.at(-1);
  const panjang =
    asal && terakhir
      ? calculateMapDistance(
          asal.lat,
          asal.lng,
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
 * menampilkan hal yang sama tanpa keadaan ganda.
 *
 * Mesin petanya tidak ditentukan di sini: `PetaUniversal`, `PenandaUniversal`,
 * dan `JalurUniversal` membacanya dari `useMesinPeta`, sehingga layar ini
 * berpindah ke Google Maps sendirinya begitu API key terisi — tanpa deploy
 * ulang dan tanpa satu pun perubahan di berkas ini.
 */
export default function PetaRencana({
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
}: PetaRencanaProps) {
  const semuaTitik = [...titikRencana, ...nodeNyata];
  const asalDraf = jalurDraf ? koordinatTitik(jalurDraf.sumber) : null;

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
      <PetaUniversal
        pusat={{ lat: pusat[0], lng: pusat[1] }}
        zoom={ZOOM_AWAL}
        onKlik={onKlikPeta}
      >
        {jalur.map((satuJalur) => {
          const asal = koordinatTitik(
            semuaTitik.find((titik) => titik.nodeId === satuJalur.source),
          );
          const tujuan = koordinatTitik(
            semuaTitik.find((titik) => titik.nodeId === satuJalur.target),
          );
          if (!asal || !tujuan) return null;

          const jejak = [
            asal,
            ...satuJalur.waypoints.map(([lat, lng]) => ({ lat, lng })),
            tujuan,
          ];
          const panjang = calculateMapDistance(
            asal.lat,
            asal.lng,
            tujuan.lat,
            tujuan.lng,
            satuJalur.waypoints,
          );

          return (
            <JalurUniversal
              key={satuJalur.edgeId}
              jejak={jejak}
              // Seluruh jalur di sini adalah jalur rencana: endpoint peta
              // planning hanya mengembalikan `isPlanned: true`, dan latar
              // node nyata tidak membawa kabelnya. Jadi tidak ada cabang
              // gaya "jalur nyata" — cabang itu tidak akan pernah terpakai.
              fiberType={satuJalur.fiberType}
              bobot={BOBOT_JALUR_RENCANA}
              putus
              popup={
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
              }
            />
          );
        })}

        {nodeNyata.map((titik) => {
          const posisi = koordinatTitik(titik);
          if (!posisi) return null;
          return (
            <PenandaUniversal
              key={titik.nodeId}
              posisi={posisi}
              type={titik.type}
              redup
              title={titik.name ?? undefined}
              onKlik={() => onKlikTitik(titik)}
              popup={
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
              }
            />
          );
        })}

        {titikRencana.map((titik) => {
          const posisi = koordinatTitik(titik);
          if (!posisi) return null;
          const terpilihSebagaiAsal = jalurDraf?.sumber.nodeId === titik.nodeId;
          return (
            <PenandaUniversal
              key={titik.nodeId}
              posisi={posisi}
              type={titik.type}
              ragam={terpilihSebagaiAsal ? "terpilih" : "biasa"}
              zIndex={Z_TITIK_RENCANA}
              title={titik.name ?? undefined}
              onKlik={() => onKlikTitik(titik)}
              popup={
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
              }
            />
          );
        })}

        {koordinatDraf && !sedangGambarJalur && (
          <PenandaUniversal
            posisi={{ lat: koordinatDraf[0], lng: koordinatDraf[1] }}
            type="odp"
            ragam="sementara"
            title="Titik baru"
          />
        )}

        <JalurPratinjau
          aktif={Boolean(jalurDraf)}
          asal={asalDraf}
          belokan={jalurDraf?.waypoints ?? []}
        />
      </PetaUniversal>

      {jalurDraf && <PanelPanjangJalur jalurDraf={jalurDraf} />}
    </div>
  );
}
