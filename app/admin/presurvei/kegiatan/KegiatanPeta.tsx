"use client";

import "ol/ol.css";
import type Feature from "ol/Feature";
import type Map from "ol/Map";
import type Overlay from "ol/Overlay";
import type VectorLayer from "ol/layer/Vector";
import type VectorSource from "ol/source/Vector";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { KegiatanPetaKeterangan } from "./KegiatanPetaKeterangan";
import type { TitikKegiatan } from "./titikPeta";

interface Props {
  titik: TitikKegiatan[];
  tanpaKoordinat: number;
  diLuarBatas: number;
}

/** Pusat peta sebelum ada titik yang bisa dijadikan acuan: Monas, Jakarta. */
const PUSAT_AWAL: [number, number] = [106.845599, -6.208763];
const ZOOM_AWAL = 12;
/** Batas perbesaran saat memusatkan ke titik; tanpa ini satu titik tunggal
 * akan memperbesar peta sampai kehilangan seluruh konteks sekitarnya. */
const ZOOM_MAKS_SAAT_FIT = 16;
const PADDING_FIT: [number, number, number, number] = [50, 50, 50, 50];
const DURASI_FIT_MS = 500;
const TINGGI_PETA_PX = 480;
const RADIUS_PENANDA_PX = 9;
const TEBAL_GARIS_PENANDA_PX = 2;
/** Jarak popup di atas penanda supaya ujungnya tidak menutupi titiknya. */
const JARAK_POPUP_PX = 6;
const WARNA_GARIS_PENANDA = "#ffffff";
/** Kunci properti feature tempat titik asalnya disimpan, dibaca saat diklik. */
const KUNCI_TITIK = "titik";

/**
 * Peta kunjungan sales: satu penanda per kegiatan berkoordinat.
 *
 * Wajib dimuat lewat `dynamic(..., { ssr: false })` — OpenLayers menyentuh
 * `window` saat modulnya dimuat, jadi render di server gagal dengan
 * `window is not defined`. Struktur dan pilihan kontrolnya mengikuti
 * `components/attendance/EmployeeLocationMap.tsx`, peta titik yang sudah
 * berjalan di repo ini.
 *
 * Isi popup dirender React, bukan ditulis ke `innerHTML` seperti pendahulunya:
 * alamat dan nama berasal dari masukan pemakai, dan menempelkannya sebagai HTML
 * menuntut escaping tangan yang bisa terlupa. Sebagai bonus, tautan detailnya
 * jadi `next/link` sungguhan alih-alih `<a>` yang memuat ulang halaman.
 */
export default function KegiatanPeta({
  titik,
  tanpaKoordinat,
  diLuarBatas,
}: Props) {
  const wadahPetaRef = useRef<HTMLDivElement | null>(null);
  const elemenPopupRef = useRef<HTMLDivElement | null>(null);
  const petaRef = useRef<Map | null>(null);
  const lapisanPenandaRef = useRef<VectorLayer<VectorSource> | null>(null);
  const overlayPopupRef = useRef<Overlay | null>(null);
  const [isPetaSiap, setIsPetaSiap] = useState(false);
  const [titikTerpilih, setTitikTerpilih] = useState<TitikKegiatan | null>(
    null,
  );

  // Membangun peta sekali saja. Seluruh impor OpenLayers dinamis supaya tidak
  // ada satu pun yang dieksekusi di luar browser.
  useEffect(() => {
    let bersihkan = () => {};

    (async () => {
      if (!wadahPetaRef.current) return;

      const { Map, View } = await import("ol");
      const { default: TileLayer } = await import("ol/layer/Tile");
      const { default: VectorLayer } = await import("ol/layer/Vector");
      const { default: VectorSource } = await import("ol/source/Vector");
      const { default: OSM } = await import("ol/source/OSM");
      const { default: Overlay } = await import("ol/Overlay");
      const { fromLonLat } = await import("ol/proj");
      const {
        defaults: kontrolBawaan,
        Attribution,
        FullScreen,
        Zoom,
      } = await import("ol/control");

      const lapisanPenanda = new VectorLayer({ source: new VectorSource() });
      lapisanPenandaRef.current = lapisanPenanda;

      const peta = new Map({
        target: wadahPetaRef.current,
        layers: [new TileLayer({ source: new OSM() }), lapisanPenanda],
        view: new View({ center: fromLonLat(PUSAT_AWAL), zoom: ZOOM_AWAL }),
        controls: kontrolBawaan({
          zoom: false,
          rotate: false,
          attribution: false,
        }).extend([
          new Zoom(),
          new Attribution({ collapsible: true, collapsed: true }),
          new FullScreen(),
        ]),
      });
      petaRef.current = peta;

      if (elemenPopupRef.current) {
        // `stopEvent` dibiarkan pada bawaannya (menyala): tautan "Lihat detail"
        // di dalam popup harus bisa diklik, dan dengan `false` kliknya tembus
        // ke peta dan justru menutup popupnya sendiri.
        const overlay = new Overlay({
          element: elemenPopupRef.current,
          positioning: "bottom-center",
          offset: [0, -(RADIUS_PENANDA_PX + JARAK_POPUP_PX)],
        });
        peta.addOverlay(overlay);
        overlayPopupRef.current = overlay;
      }

      peta.on("click", (evt) => {
        const fitur = peta.forEachFeatureAtPixel(evt.pixel, (satu) => satu) as
          | Feature
          | undefined;

        // `?? null` eksplisit: `strictNullChecks: false` meloloskan `undefined`
        // ke state yang kontraknya `TitikKegiatan | null`.
        const titikDiklik = (fitur?.get(KUNCI_TITIK) ??
          null) as TitikKegiatan | null;

        setTitikTerpilih(titikDiklik);
        overlayPopupRef.current?.setPosition(
          titikDiklik ? evt.coordinate : undefined,
        );
      });

      peta.on("pointermove", (evt) => {
        peta.getTargetElement().style.cursor = peta.hasFeatureAtPixel(evt.pixel)
          ? "pointer"
          : "";
      });

      bersihkan = () => {
        peta.setTarget(undefined);
      };

      setIsPetaSiap(true);
    })();

    return () => bersihkan();
  }, []);

  // Menggambar ulang penanda tiap himpunan titik berubah — yaitu tiap filter
  // diubah. Dibangun ulang dari nol, bukan disisipkan bertahap: himpunannya
  // paling banyak seratus dan datang sekaligus, jadi diffing incremental hanya
  // menambah keadaan tanpa menghemat apa pun.
  useEffect(() => {
    if (!isPetaSiap) return;

    (async () => {
      const peta = petaRef.current;
      const sumber = lapisanPenandaRef.current?.getSource();
      if (!peta || !sumber) return;

      const { default: Feature } = await import("ol/Feature");
      const { default: Point } = await import("ol/geom/Point");
      const { fromLonLat } = await import("ol/proj");
      const { Fill, Stroke, Style } = await import("ol/style");
      const { default: CircleStyle } = await import("ol/style/Circle");

      sumber.clear();

      // Popup ditutup bersama penandanya: kegiatan yang sedang dibuka bisa saja
      // tersaring keluar oleh filter baru, dan popup yang tertinggal akan
      // menggantung di atas peta yang sudah tidak memuatnya.
      setTitikTerpilih(null);
      overlayPopupRef.current?.setPosition(undefined);

      for (const item of titik) {
        const fitur = new Feature({
          // `fromLonLat` menerima [bujur, lintang] — urutan kebalikan dari cara
          // koordinat biasa dibaca orang.
          geometry: new Point(fromLonLat([item.longitude, item.latitude])),
          [KUNCI_TITIK]: item,
        });
        fitur.setId(item.id);
        fitur.setStyle(
          new Style({
            image: new CircleStyle({
              radius: RADIUS_PENANDA_PX,
              fill: new Fill({ color: item.warna }),
              stroke: new Stroke({
                color: WARNA_GARIS_PENANDA,
                width: TEBAL_GARIS_PENANDA_PX,
              }),
            }),
          }),
        );
        sumber.addFeature(fitur);
      }

      if (titik.length === 0) return;

      const jangkauan = sumber.getExtent();
      if (jangkauan[0] === Infinity) return;

      peta.getView().fit(jangkauan, {
        padding: PADDING_FIT,
        maxZoom: ZOOM_MAKS_SAAT_FIT,
        duration: DURASI_FIT_MS,
      });
    })();
  }, [titik, isPetaSiap]);

  return (
    <div className="p-4">
      <div className="relative">
        <div
          ref={wadahPetaRef}
          style={{ height: TINGGI_PETA_PX }}
          className="w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
        />

        {/* Elemen popup; posisinya diatur OpenLayers, isinya oleh React. */}
        <div ref={elemenPopupRef}>
          {titikTerpilih && (
            <div className="min-w-[200px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {titikTerpilih.label}
              </p>
              {titikTerpilih.alamat && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {titikTerpilih.alamat}
                </p>
              )}
              <Link
                href={`/admin/presurvei/kegiatan/${titikTerpilih.id}`}
                className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Lihat detail
              </Link>
            </div>
          )}
        </div>
      </div>

      <KegiatanPetaKeterangan
        tanpaKoordinat={tanpaKoordinat}
        diLuarBatas={diLuarBatas}
      />
    </div>
  );
}
