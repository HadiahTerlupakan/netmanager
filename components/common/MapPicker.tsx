"use client";

import React, { useRef, useEffect, useState } from "react";
// Tanpa ini kontrol zoom dan atribusi OpenLayers dirender sebagai teks mentah
// ("+" dan "−" polos) dan peta tampak rusak. Tiga komponen peta lain di repo
// ini sudah mengimpornya; `MapPicker` terlewat, sehingga peta di form
// pelanggan, form planning, dan form site sama-sama tampil tanpa gaya.
import "ol/ol.css";
import type Map from "ol/Map";
import type VectorLayer from "ol/layer/Vector";
import type VectorSource from "ol/source/Vector";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";

// Komponen peta berbasis OpenLayers. Pastikan memasang dependency: npm i ol
// Minimal init: tile OSM, click untuk set koordinat, serta marker sederhana.

type MapPickerProps = {
  lat?: number | null;
  lon?: number | null;
  height?: number | undefined;
  onChange: (lat: number, lon: number) => void;
};

export default function MapPicker({
  lat,
  lon,
  height = 360,
  onChange,
}: MapPickerProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cleanup = () => {};
    let isMounted = true;
    (async () => {
      const { Map, View } = await import("ol");
      const { default: OSM } = await import("ol/source/OSM");
      const { default: TileLayer } = await import("ol/layer/Tile");
      const { default: VectorLayer } = await import("ol/layer/Vector");
      const { default: VectorSource } = await import("ol/source/Vector");
      const { fromLonLat, toLonLat } = await import("ol/proj");
      const { default: Feature } = await import("ol/Feature");
      const { default: Point } = await import("ol/geom/Point");
      const { Style, Fill, Stroke } = await import("ol/style");
      const { default: CircleStyle } = await import("ol/style/Circle");
      const {
        defaults: defaultControls,
        Zoom,
        Attribution,
      } = await import("ol/control");

      if (!isMounted || !mapEl.current) return;

      const centerLonLat: [number, number] = [
        typeof lon === "number" ? lon : 106.816666,
        typeof lat === "number" ? lat : -6.2,
      ];
      const center3857 = fromLonLat(centerLonLat);

      const tile = new TileLayer({ source: new OSM() });
      const markerSource = new VectorSource();
      const marker = new VectorLayer({ source: markerSource });
      markerLayerRef.current = marker;

      const map = new Map({
        target: mapEl.current as HTMLDivElement,
        layers: [tile, marker],
        view: new View({ center: center3857, zoom: 14 }),
        controls: defaultControls({
          zoom: false,
          rotate: false,
          attribution: false,
        }).extend([
          new Zoom(),
          new Attribution({ collapsible: true, collapsed: true }),
        ]),
      });
      mapRef.current = map;

      // OpenLayers menghitung ukuran kanvas sekali saat dibuat. Di dalam modal,
      // kontainer sering belum punya ukuran final pada saat itu -- akibatnya
      // peta tampil kosong sampai ada event resize. Terverifikasi di produksi:
      // memicu `window.resize` secara manual membuat peta langsung muncul.
      //
      // ResizeObserver menutup semua kasusnya sekaligus: modal dibuka, tab
      // berganti, panel melebar, atau jendela diubah ukurannya.
      const resizeObserver = new ResizeObserver(() => {
        mapRef.current?.updateSize();
      });
      resizeObserver.observe(mapEl.current as HTMLDivElement);

      if (typeof lat === "number" && typeof lon === "number") {
        const f = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
        f.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: "#2563eb" }),
              stroke: new Stroke({ color: "#ffffff", width: 2 }),
            }),
          }),
        );
        markerSource.clear();
        markerSource.addFeature(f);
      }

      const clickHandler = (evt: { coordinate: [number, number] }) => {
        if (!isMounted) return;
        const coord3857 = evt.coordinate;
        const [lonC, latC] = toLonLat(coord3857);
        if (typeof latC !== "number" || typeof lonC !== "number") return;
        const f = new Feature({ geometry: new Point(coord3857) });
        f.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: "#2563eb" }),
              stroke: new Stroke({ color: "#ffffff", width: 2 }),
            }),
          }),
        );
        markerSource.clear();
        markerSource.addFeature(f);
        try {
          const view = map.getView();
          view.animate({
            center: coord3857,
            zoom: Math.max(17, view.getZoom() || 0),
            duration: 400,
          });
        } catch {}
        onChangeRef.current(Number(latC.toFixed(6)), Number(lonC.toFixed(6)));
      };

      map.on("click", clickHandler as never);
      const externalSetHandler = (
        e: CustomEvent<{ lat?: number; lon?: number }>,
      ) => {
        if (!isMounted) return;
        try {
          const { lat: la, lon: lo } = e.detail || {};
          if (typeof la === "number" && typeof lo === "number") {
            const f = new Feature({
              geometry: new Point(fromLonLat([lo, la])),
            });
            f.setStyle(
              new Style({
                image: new CircleStyle({
                  radius: 6,
                  fill: new Fill({ color: "#2563eb" }),
                  stroke: new Stroke({ color: "#ffffff", width: 2 }),
                }),
              }),
            );
            markerSource.clear();
            markerSource.addFeature(f);
            const view = map.getView();
            const center = fromLonLat([lo, la]);
            view.animate({
              center,
              zoom: Math.max(17, view.getZoom() || 0),
              duration: 400,
            });
          }
        } catch {}
      };
      window.addEventListener(
        "mappicker-set",
        externalSetHandler as EventListener,
      );

      cleanup = () => {
        isMounted = false;
        try {
          window.removeEventListener(
            "mappicker-set",
            externalSetHandler as EventListener,
          );
          resizeObserver.disconnect();
          if (mapRef.current) {
            mapRef.current.un("click", clickHandler as never);
            mapRef.current.setTarget(undefined);
            mapRef.current.dispose();
            mapRef.current = null;
          }
        } catch (_e) {
          // Ignore cleanup errors
        }
      };
    })();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [lat, lon]);

  // Update marker jika lat/lon berubah dari luar (misal hasil geolocate)
  useEffect(() => {
    (async () => {
      if (!markerLayerRef.current || !mapRef.current) return;
      const { default: Feature } = await import("ol/Feature");
      const { default: Point } = await import("ol/geom/Point");
      const { fromLonLat } = await import("ol/proj");
      const { Style, Fill, Stroke } = await import("ol/style");
      const { default: CircleStyle } = await import("ol/style/Circle");
      const source = markerLayerRef.current.getSource();
      if (!source) return;
      if (typeof lat === "number" && typeof lon === "number") {
        const f = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
        f.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: "#2563eb" }),
              stroke: new Stroke({ color: "#ffffff", width: 2 }),
            }),
          }),
        );
        source.clear();
        source.addFeature(f);
        try {
          const view = mapRef.current.getView();
          const center = fromLonLat([lon, lat]);
          view.animate({
            center,
            zoom: Math.max(17, view.getZoom() || 0),
            duration: 400,
          });
        } catch {}
      }
    })();
  }, [lat, lon]);

  return (
    <div
      ref={mapEl}
      style={{ height, width: "100%", borderRadius: 8, overflow: "hidden" }}
    />
  );
}

export function MapPickerWithSearch(props: MapPickerProps) {
  const [lat, setLat] = useState<number | null>(props.lat ?? null);
  const [lon, setLon] = useState<number | null>(props.lon ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ displayName: string; lat: number; lon: number }>
  >([]);

  // Geocode search via useMutation untuk konsisten loading state via
  // isPending dan auto-handle race condition (TanStack Query auto-cancel
  // mutation lama saat trigger baru).
  const searchMutation = useMutation<
    Array<{ displayName: string; lat: number; lon: number }>,
    Error,
    string
  >({
    mutationFn: async (q: string) => {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      const json: {
        results?: Array<{ displayName: string; lat: number; lon: number }>;
      } = await res.json().catch(() => ({}));
      return json.results ?? [];
    },
    onSuccess: (data) => setResults(data),
  });
  const searching = searchMutation.isPending;

  const handleSearch = () => {
    if (!query.trim()) return;
    searchMutation.mutate(query);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari alamat atau tempat"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        />
        <Button
          type="button"
          onClick={handleSearch}
          variant="outline"
          size="sm"
        >
          {searching ? "Mencari…" : "Cari"}
        </Button>
      </div>
      {results.length > 0 && (
        <div className="max-h-40 overflow-auto rounded-md border border-gray-200 dark:border-gray-800">
          {results.map((r, i) => (
            <Button
              key={i}
              type="button"
              onClick={() => {
                setLat(r.lat);
                setLon(r.lon);
                setResults([]);
                try {
                  window.dispatchEvent(
                    new CustomEvent("mappicker-set", {
                      detail: { lat: r.lat, lon: r.lon },
                    }),
                  );
                } catch (_e) {}
                props.onChange(r.lat, r.lon);
              }}
              variant="ghost"
              className="w-full justify-start"
              size="sm"
            >
              {r.displayName}
            </Button>
          ))}
        </div>
      )}
      <MapPicker
        lat={lat}
        lon={lon}
        height={props.height}
        onChange={(la, lo) => {
          setLat(la);
          setLon(lo);
          props.onChange(la, lo);
        }}
      />
    </div>
  );
}
