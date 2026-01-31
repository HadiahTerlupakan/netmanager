# Panduan Integrasi Fitur Network Map ke Next.js & Prisma

Dokumen ini berisi panduan langkah demi langkah untuk mengimplementasikan fitur mapping (yang di-reverse engineer dari GenieACS Panel) ke dalam project Next.js yang sudah ada.

## 1. Validasi Kesamaan Teknologi (Reverse Engineering Match)

Sesuai permintaan untuk **menyamakan persis** dengan teknologi asli, berikut adalah pemetaan modul yang ditemukan di dalam container Docker asli vs implementasi kita:

| Komponen                | Teknologi Asli (Docker Container)     | Implementasi Kita (Next.js)   | Keterangan                                                  |
| :---------------------- | :------------------------------------ | :---------------------------- | :---------------------------------------------------------- |
| **Backend Framework**   | Express.js                            | Next.js API Routes            | Logika routing disamakan (GET/POST/PUT)                     |
| **Database**            | SQLite3 (`mapping.db`)                | PostgreSQL (Prisma)           | Schema tabel disamakan strukturnya                          |
| **Frontend Map Engine** | Leaflet.js (Native)                   | Leaflet.js (Native)           | Kita menggunakan _Direct DOM manipulation_ agar sama persis |
| **Map Tiles**           | Google Maps Hybrid (`mt0.google.com`) | Google Maps Hybrid            | URL Tile Layer yang sama persis                             |
| **Marker System**       | `L.divIcon` dengan CSS Custom         | `L.divIcon` dengan CSS Custom | Style visual dibuat identik                                 |

---

## 2. Persiapan Database (Prisma Schema)

Fitur mapping asli menggunakan dua tabel sederhana: `mapping_nodes` dan `mapping_edges`. Kita mengadaptasinya ke Prisma dengan struktur kolom yang **identik secara fungsional**.

Tambahkan model berikut ke file `prisma/schema.prisma`:

```prisma
// prisma/schema.prisma

// [REVERSE ENGINEERED] Adaptasi dari tabel 'mapping_nodes'
model NetworkNode {
  id          String        @id @default(uuid())
  name        String
  type        String        // 'olt', 'odc', 'odp' (Sesuai original)
  latitude    Float
  longitude   Float
  data        Json?         // Untuk menyimpan 'slots', 'capacity' (Sesuai kolom 'data' di SQLite)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // Relasi Edge
  outgoingEdges NetworkEdge[] @relation("FromNode")
  incomingEdges NetworkEdge[] @relation("ToNode")

  @@map("network_nodes")
}

// [REVERSE ENGINEERED] Adaptasi dari tabel 'mapping_edges'
model NetworkEdge {
  id          String      @id @default(uuid())
  fromNodeId  String
  toNodeId    String
  type        String      // 'feeder', 'distribution', 'drop'
  data        Json?       // Warna kabel, jumlah core
  points      Json?       // Jalur berbelok (Polyline points)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  fromNode    NetworkNode @relation("FromNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNode      NetworkNode @relation("ToNode", fields: [toNodeId], references: [id], onDelete: Cascade)

  @@index([fromNodeId])
  @@index([toNodeId])
  @@map("network_edges")
}
```

Jalankan migrasi:

```bash
npx prisma generate
npx prisma migrate dev --name add_network_map_exact
```

---

## 3. Implementasi Backend (API Routes)

Logika backend asli (Express) melakukan CRUD sederhana. Kita porting ke Next.js API Routes.

**File: `app/api/network-map/nodes/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const nodes = await prisma.networkNode.findMany();
  return NextResponse.json(nodes);
}

export async function POST(request: Request) {
  const body = await request.json();
  const newNode = await prisma.networkNode.create({
    data: {
      name: body.name,
      type: body.type,
      latitude: body.latitude,
      longitude: body.longitude,
      data: body.data || {},
    },
  });
  return NextResponse.json(newNode);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const updatedNode = await prisma.networkNode.update({
    where: { id: body.id },
    data: { latitude: body.latitude, longitude: body.longitude },
  });
  return NextResponse.json(updatedNode);
}
```

**File: `app/api/network-map/edges/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const edges = await prisma.networkEdge.findMany({
    include: { fromNode: true, toNode: true },
  });
  return NextResponse.json(edges);
}

export async function POST(request: Request) {
  const body = await request.json();
  const newEdge = await prisma.networkEdge.create({
    data: {
      fromNodeId: body.fromNodeId,
      toNodeId: body.toNodeId,
      type: body.type,
      data: body.data || {},
    },
  });
  return NextResponse.json(newEdge);
}
```

---

## 4. Implementasi Frontend (Native Leaflet Pattern)

Untuk memastikan "sama persis" dengan aslinya yang menggunakan **Vanilla JS + Leaflet** (tanpa wrapper React yang berat), kita akan menggunakan pola **Direct Leaflet Instantiation** di dalam `useEffect`. Ini meniru cara kerja kode asli yang memanipulasi DOM peta secara langsung.

**File: `components/network-map/NetworkMapEditor.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// [REVERSE ENGINEERED] Style Marker Asli
// Menggunakan divIcon dengan CSS radius border untuk meniru tampilan asli
const createCustomIcon = (type: string) => {
  let color = "#333";
  if (type === "olt") color = "#e74c3c"; // Merah
  if (type === "odc") color = "#2ecc71"; // Hijau
  if (type === "odp") color = "#3498db"; // Biru

  return L.divIcon({
    className: "custom-pin",
    html: `<div style="
      background-color: ${color};
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7], // Center anchor
  });
};

export default function NetworkMapEditor() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});

  // State Logika
  const [mode, setMode] = useState<"view" | "add_node" | "add_edge">("view");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null); // Ref untuk akses di dalam event listener Leaflet

  // Update Ref saat State berubah (untuk event listener)
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  // --- 1. Inisialisasi Peta (Native Leaflet) ---
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // [REVERSE ENGINEERED] Setup Map Engine
    const map = L.map(mapContainerRef.current).setView([-6.2088, 106.8456], 13);
    mapInstanceRef.current = map;

    // [REVERSE ENGINEERED] Google Maps Hybrid Tile Layer
    // URL ini ditemukan langsung dari source code asli
    L.tileLayer("https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      attribution: "Google Hybrid",
    }).addTo(map);

    // Event Listener Peta (Global Click)
    map.on("click", async (e: L.LeafletMouseEvent) => {
      // Mode: View (Deselect)
      if (mode === "view") {
        // Logic handled by marker click, map click clears selection logic if needed
      }

      // Mode: Add Node
      if (mode === "add_node") {
        const name = prompt("Nama Node Baru:", "New Node");
        if (!name) return;

        // Panggil API (Logika Ajax asli diganti fetch)
        const res = await fetch("/api/network-map/nodes", {
          method: "POST",
          body: JSON.stringify({
            name,
            type: "odp", // Default
            latitude: e.latlng.lat,
            longitude: e.latlng.lng,
          }),
        });

        if (res.ok) {
          const newNode = await res.json();
          addMarkerToMap(newNode); // Render langsung
          setMode("view"); // Reset mode
        }
      }
    });

    // Load Data Awal
    loadMapData();

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Run once on mount

  // --- 2. Load Data ---
  const loadMapData = async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Fetch Nodes
    const nodes = await fetch("/api/network-map/nodes").then((r) => r.json());
    nodes.forEach((node: any) => addMarkerToMap(node));

    // Fetch Edges
    const edges = await fetch("/api/network-map/edges").then((r) => r.json());
    edges.forEach((edge: any) => addPolylineToMap(edge));
  };

  // --- 3. Render Marker (Native Leaflet Logic) ---
  const addMarkerToMap = (node: any) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const marker = L.marker([node.latitude, node.longitude], {
      icon: createCustomIcon(node.type),
      draggable: true, // [REVERSE ENGINEERED] Fitur drag node
    });

    marker.addTo(map);
    markersRef.current[node.id] = marker;

    // Bind Popup
    marker.bindPopup(`
        <b>${node.name}</b><br>
        Type: ${node.type}<br>
        <button onclick="alert('Details for ${node.id}')">View Details</button>
    `);

    // Event: Drag End (Update Posisi)
    marker.on("dragend", async (e) => {
      const newPos = e.target.getLatLng();
      await fetch("/api/network-map/nodes", {
        method: "PUT",
        body: JSON.stringify({
          id: node.id,
          latitude: newPos.lat,
          longitude: newPos.lng,
        }),
      });
    });

    // Event: Click (Connect Logic)
    marker.on("click", async () => {
      // Akses state terbaru via Ref karena kita di dalam closure Leaflet
      const currentMode = document.getElementById(
        "current-mode-indicator",
      )?.innerText;

      if (currentMode === "ADD_EDGE") {
        const sourceId = selectedNodeIdRef.current;
        if (!sourceId) {
          // Pilih Source
          setSelectedNodeId(node.id);
          alert(`Source selected: ${node.name}. Now click target.`);
        } else {
          // Pilih Target & Connect
          if (sourceId === node.id) return; // Self loop check

          await fetch("/api/network-map/edges", {
            method: "POST",
            body: JSON.stringify({
              fromNodeId: sourceId,
              toNodeId: node.id,
              type: "distribution",
            }),
          });

          // Refresh data (simple way)
          window.location.reload();
        }
      }
    });
  };

  // --- 4. Render Edge (Polyline) ---
  const addPolylineToMap = (edge: any) => {
    const map = mapInstanceRef.current;
    if (!map || !edge.fromNode || !edge.toNode) return;

    const polyline = L.polyline(
      [
        [edge.fromNode.latitude, edge.fromNode.longitude],
        [edge.toNode.latitude, edge.toNode.longitude],
      ],
      {
        color: edge.type === "feeder" ? "#e67e22" : "#3498db",
        weight: 3,
      },
    );

    polyline.addTo(map);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Hidden Indicator for Leaflet Closure Access */}
      <div id="current-mode-indicator" className="hidden">
        {mode === "add_edge" ? "ADD_EDGE" : "VIEW"}
      </div>

      <div className="bg-white p-2 border-b flex gap-2">
        <button
          onClick={() => setMode("view")}
          className="px-4 py-2 bg-gray-200 rounded"
        >
          View / Drag
        </button>
        <button
          onClick={() => setMode("add_node")}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Add Node (Click Map)
        </button>
        <button
          onClick={() => {
            setMode("add_edge");
            setSelectedNodeId(null);
          }}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Connect (Click 2 Nodes)
        </button>
        <span className="ml-auto p-2 font-bold">{mode.toUpperCase()}</span>
      </div>
      <div ref={mapContainerRef} className="flex-1 w-full bg-gray-100" />
    </div>
  );
}
```

## Kesimpulan

Dengan implementasi di atas, kita telah:

1.  Menggunakan **Native Leaflet** (`L.map`, `L.marker`) sama persis seperti kode asli, menghindari abstraksi React yang mungkin mengubah perilaku.
2.  Menggunakan **Google Hybrid Tiles** sebagai layer peta utama.
3.  Mengimplementasikan logika **Event Driven** (click, drag) yang sama dengan aplikasi GenieACS Panel tersebut.
