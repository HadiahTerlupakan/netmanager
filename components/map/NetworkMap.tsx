"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useApiResponse } from "@/hooks/useApiResponse";
import type { MappingNode, MappingEdge, MapSettings } from "@prisma/client";

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false },
);
const ZoomControl = dynamic(
  () => import("react-leaflet").then((mod) => mod.ZoomControl),
  { ssr: false },
);

// We need to fix the default icon issue in Leaflet with Next.js/Webpack
import L from "leaflet";

// Initialize default Icon only on client side
if (typeof window !== "undefined") {
  // @ts-expect-error: Fix Leaflet icon issue in Next.js by modifying prototype
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/images/marker-icon-2x.png",
    iconUrl: "/images/marker-icon.png",
    shadowUrl: "/images/marker-shadow.png",
  });
}

// Custom Icons (You might want to implement valid icon URLs)
const createIcon = (_type: string) => {
  return new L.Icon.Default();
};

export default function NetworkMap() {
  const { data: settingsData, fetchData: fetchSettings } =
    useApiResponse<MapSettings>();
  const { data: nodesData, fetchData: fetchNodes } =
    useApiResponse<MappingNode[]>();
  const { data: edgesData, fetchData: fetchEdges } =
    useApiResponse<MappingEdge[]>();

  useEffect(() => {
    fetchSettings("/api/map/settings");
    fetchNodes("/api/map/nodes");
    fetchEdges("/api/map/edges");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default configuration if none provided
  const config = settingsData;
  const centerPosition: [number, number] =
    config?.centerLat && config?.centerLng
      ? [parseFloat(config.centerLat), parseFloat(config.centerLng)]
      : [-6.2088, 106.8456]; // Jakarta Default

  const zoomLevel = config?.defaultZoom ? parseInt(config.defaultZoom) : 13;

  const nodes = nodesData || [];
  const edges = edgesData || [];

  return (
    <div className="relative w-full h-[calc(100vh-64px)] z-0">
      <MapContainer
        center={centerPosition}
        zoom={zoomLevel}
        zoomControl={false}
        className="w-full h-full"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          // Google Maps Hybrid
          url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
          attribution="&copy; Google Maps"
          maxZoom={20}
        />

        <ZoomControl position="bottomright" />

        {/* Edges */}
        {edges.map((edge) => {
          // Find source and target nodes
          const sourceNode = nodes.find((n) => n.nodeId === edge.source);
          const targetNode = nodes.find((n) => n.nodeId === edge.target);

          if (
            !sourceNode?.latitude ||
            !sourceNode?.longitude ||
            !targetNode?.latitude ||
            !targetNode?.longitude
          )
            return null;

          const positions: [number, number][] = [
            [sourceNode.latitude, sourceNode.longitude],
            ...(edge.waypoints ? JSON.parse(edge.waypoints) : []),
            [targetNode.latitude, targetNode.longitude],
          ];

          return (
            <Polyline
              key={edge.edgeId}
              positions={positions}
              pathOptions={{
                color: edge.fiberType?.includes("odc") ? "#ff0000" : "#0000ff",
                weight: 3,
                opacity: 0.8,
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold">Kabel Fiber</h3>
                  <p>Tipe: {edge.fiberType}</p>
                  <p>Jarak: {edge.distance} m</p>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          if (!node.latitude || !node.longitude) return null;

          return (
            <Marker
              key={node.nodeId}
              position={[node.latitude, node.longitude]}
              icon={createIcon(node.type)}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-bold text-lg border-b pb-1 mb-2">
                    {node.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500">Tipe:</span>
                    <span className="font-mono bg-gray-100 px-1 rounded">
                      {node.type.toUpperCase()}
                    </span>
                    <span className="text-gray-500">Kapasitas:</span>
                    <span>{node.capacity} Port</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Legend */}
      <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-4 rounded shadow-lg z-1000">
        <h4 className="font-bold mb-2 text-gray-900 dark:text-gray-100">
          Legenda
        </h4>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 bg-red-500 dark:bg-red-400 rounded-full"></span>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Backbone (ODC)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Distribusi (ODP)
          </span>
        </div>
      </div>
    </div>
  );
}
