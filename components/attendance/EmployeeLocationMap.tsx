"use client";

import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import type Map from "ol/Map";
import Feature from "ol/Feature";
import type VectorLayer from "ol/layer/Vector";
import type VectorSource from "ol/source/Vector";
import type Overlay from "ol/Overlay";
import type { Options as OverlayOptions } from "ol/Overlay";
import type Point from "ol/geom/Point";
import { clientLogger } from "@/lib/client-logger";

interface EmployeeLocation {
  userId: string;
  userName: string;
  userImage: string | null;
  siteName: string | null;
  departmentName: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed?: number | null;
  heading?: number | null;
  isMoving: boolean;
  batteryLevel: number | null;
  recordedAt: string;
  checkInTime: string;
}

interface EmployeeLocationMapProps {
  locations: EmployeeLocation[];
  height?: number | string;
  onEmployeeClick?: (employee: EmployeeLocation) => void;
}

export default function EmployeeLocationMap({
  locations,
  height = 500,
  onEmployeeClick,
}: EmployeeLocationMapProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const onEmployeeClickRef = useRef(onEmployeeClick);
  const [mapReady, setMapReady] = useState(false);
  const initialFitDoneRef = useRef(false); // Ref untuk track apakah initial auto-fit sudah dilakukan

  // Update the ref whenever the callback changes
  useEffect(() => {
    onEmployeeClickRef.current = onEmployeeClick;
  }, [onEmployeeClick]);

  // Initialize map once
  useEffect(() => {
    let cleanup = () => {};

    (async () => {
      if (!mapEl.current) return;

      const { Map, View } = await import("ol");
      const { default: OSM } = await import("ol/source/OSM");
      const { default: TileLayer } = await import("ol/layer/Tile");
      const { default: VectorLayer } = await import("ol/layer/Vector");
      const { default: VectorSource } = await import("ol/source/Vector");
      const { fromLonLat } = await import("ol/proj");
      const {
        defaults: defaultControls,
        Zoom,
        Attribution,
        FullScreen,
      } = await import("ol/control");
      const { default: Overlay } = await import("ol/Overlay");
      const { default: _Feature } = await import("ol/Feature");

      // Default center (Jakarta)
      const defaultCenter: [number, number] = [106.845599, -6.208763];
      const center3857 = fromLonLat(defaultCenter);

      const tile = new TileLayer({ source: new OSM() });
      const markerSource = new VectorSource();
      const markerLayer = new VectorLayer({
        source: markerSource,
        zIndex: 10,
      });
      markerLayerRef.current = markerLayer;

      const map = new Map({
        target: mapEl.current,
        layers: [tile, markerLayer],
        view: new View({
          center: center3857,
          zoom: 12,
        }),
        controls: defaultControls({
          zoom: false,
          rotate: false,
          attribution: false,
        }).extend([
          new Zoom(),
          new Attribution({ collapsible: true, collapsed: true }),
          new FullScreen(),
        ]),
      });
      mapRef.current = map;

      // Create popup overlay
      if (popupRef.current) {
        const overlay = new Overlay({
          element: popupRef.current,
          positioning: "bottom-center",
          offset: [0, -15],
          stopEvent: false,
        } as OverlayOptions);
        map.addOverlay(overlay);
        overlayRef.current = overlay;
      }

      // Hover interaction
      map.on("pointermove", (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f) as
          | Feature
          | undefined;

        if (feature && overlayRef.current && popupRef.current) {
          const data = feature.get("employeeData") as EmployeeLocation;
          if (data) {
            // Helper function for XSS prevention
            const escapeHtml = (unsafe: string) => {
              return String(unsafe)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            };

            popupRef.current.innerHTML = `
                            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 min-w-[180px] border border-gray-200 dark:border-gray-700">
                                <div class="font-semibold text-gray-800 dark:text-white text-sm">${escapeHtml(data.userName)}</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(data.departmentName || "-")}</div>
                                <div class="text-xs text-blue-600 dark:text-blue-400 mt-1">${escapeHtml(data.siteName || "Unknown")}</div>
                                ${data.isMoving ? '<div class="text-xs text-green-600 mt-1">📍 Moving</div>' : ""}
                            </div>
                        `;
            overlayRef.current.setPosition(evt.coordinate);
            popupRef.current.style.display = "block";
          }
        } else if (overlayRef.current && popupRef.current) {
          popupRef.current.style.display = "none";
        }

        // Change cursor
        map.getTargetElement().style.cursor = feature ? "pointer" : "";
      });

      // Click interaction
      map.on("click", (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f) as
          | Feature
          | undefined;
        if (feature && onEmployeeClickRef.current) {
          const data = feature.get("employeeData") as EmployeeLocation;
          if (data) {
            onEmployeeClickRef.current(data);
          }
        }
      });

      cleanup = () => {
        try {
          map.setTarget(undefined);
        } catch {}
      };

      // Mark map as ready after initialization
      setMapReady(true);
    })();

    return () => cleanup();
  }, []); // Only run once

  // Update markers when locations change OR map becomes ready
  useEffect(() => {
    if (!mapReady) return; // Wait for map to be ready
    clientLogger.info(
      "[EmployeeLocationMap] Updating markers, count:",
      locations.length,
    );
    (async () => {
      if (!markerLayerRef.current || !mapRef.current) return;

      const { default: _Feature } = await import("ol/Feature");
      const { default: Point } = await import("ol/geom/Point");
      const { fromLonLat } = await import("ol/proj");
      const { Style, Fill, Stroke, Text } = await import("ol/style");
      const { default: CircleStyle } = await import("ol/style/Circle");

      const source = markerLayerRef.current.getSource();
      if (!source) return;

      // Gunakan Set untuk mendeteksi user mana yang dihapus
      const activeUserIds = new Set<string>();

      // Add or update markers for each employee (Incremental Update)
      locations.forEach((loc) => {
        activeUserIds.add(loc.userId);

        const coord = fromLonLat([loc.longitude, loc.latitude]);
        const initial = loc.userName.charAt(0).toUpperCase();
        const color = loc.isMoving ? "#22c55e" : "#2563eb";

        const style = new Style({
          image: new CircleStyle({
            radius: 16,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: "#ffffff", width: 3 }),
          }),
          text: new Text({
            text: initial,
            font: "bold 12px sans-serif",
            fill: new Fill({ color: "#ffffff" }),
            offsetY: 1,
          }),
        });

        let feature = source.getFeatureById(loc.userId);

        if (!feature) {
          // Feature baru
          feature = new _Feature({
            geometry: new Point(coord),
            employeeData: loc,
          });
          feature.setId(loc.userId); // Penting untuk lookup incremental update
          feature.setStyle(style);
          source.addFeature(feature);
        } else {
          // Update feature yang sudah ada
          feature.set("employeeData", loc);
          const point = feature.getGeometry() as Point;
          point.setCoordinates(coord);
          feature.setStyle(style);
        }
      });

      // Hapus feature user yang sudah tidak ada di data lokasi
      source.getFeatures().forEach((feature) => {
        const id = feature.getId() as string;
        if (id && !activeUserIds.has(id)) {
          source.removeFeature(feature);
        }
      });

      // Fit view to show all markers HANYA pada saat load pertama
      if (!initialFitDoneRef.current && locations.length > 0) {
        const extent = source.getExtent();
        if (extent && extent[0] !== Infinity && mapRef.current) {
          mapRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 16,
            duration: 500,
          });
          initialFitDoneRef.current = true;
        }
      }
    })();
  }, [locations, mapReady]); // Removed onEmployeeClick from deps to avoid re-renders

  // Manual Fit to all markers function
  const fitToAll = () => {
    if (!markerLayerRef.current || !mapRef.current) return;
    const source = markerLayerRef.current.getSource();
    if (!source) return;

    const extent = source.getExtent();
    if (extent && extent[0] !== Infinity && mapRef.current) {
      mapRef.current.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        maxZoom: 16,
        duration: 500,
      });
    }
  };

  return (
    <div className="relative">
      <div
        ref={mapEl}
        style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }}
        className="border border-gray-200 dark:border-gray-800"
      />
      {/* Hidden popup element */}
      <div
        ref={popupRef}
        className="absolute z-50"
        style={{ display: "none" }}
      />

      {/* Legend and Actions */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
            Keterangan
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-500"></span>
            <span>Diam</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mt-1">
            <span className="w-3 h-3 rounded-full bg-green-500 dark:bg-green-400"></span>
            <span>Bergerak</span>
          </div>
        </div>

        <button
          onClick={fitToAll}
          className="bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800 backdrop-blur-sm text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg p-2 shadow-lg border border-gray-200 dark:border-gray-700 transition-colors flex items-center justify-center gap-1"
        >
          📍 Pusatkan Peta
        </button>
      </div>

      {/* Employee count badge */}
      <div className="absolute top-4 right-4 bg-blue-600 dark:bg-blue-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg">
        {locations.length} Karyawan Aktif
      </div>
    </div>
  );
}
