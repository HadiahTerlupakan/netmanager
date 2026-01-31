# Dokumentasi Implementasi Fitur Mapping (Reverse Engineered)

Dokumentasi ini disusun berdasarkan analisis mendalam terhadap Docker Image `solusidigitalnet/genieacspanelapi`. Dokumen ini bertujuan untuk menjadi panduan **rekonstruksi ulang** fitur pemetaan jaringan optik (OLT/ODC/ODP) yang ada pada aplikasi tersebut.

## 1. Arsitektur Sistem

Sistem mapping ini menggunakan arsitektur **Monolithic** di mana Backend (API) dan Frontend (Static Files) disajikan oleh satu container Node.js.

```mermaid
graph TD
    User[Web Browser] -->|HTTP Request| Express[Express Server :1997]
    Express -->|Static Files| ReactApp[React Frontend (Public Dir)]
    Express -->|API Calls| APILogic[Backend Logic]
    APILogic -->|Read/Write| SQLite[(Database SQLite)]

    subgraph Frontend "React + Leaflet"
        ReactApp --> MapContainer
        MapContainer --> GoogleLayer[Google Maps Tile Layer]
        MapContainer --> Markers[Node Markers]
        MapContainer --> Polylines[Fiber Cables]
    end
```

## 2. Struktur Database (SQLite)

Fitur mapping menggunakan dua tabel utama. Berikut adalah skema SQL untuk membuatnya.

### Tabel `mapping_nodes` (Titik Perangkat)

Menyimpan lokasi perangkat seperti OLT, ODC, ODP, dan ONT.

```sql
CREATE TABLE IF NOT EXISTS mapping_nodes (
  node_id TEXT PRIMARY KEY,       -- ID Unik (e.g., 'odc-jakarta-1')
  type TEXT NOT NULL,             -- Tipe: 'olt', 'odc', 'odp', 'ont'
  name TEXT,                      -- Nama Label
  latitude REAL,                  -- Koordinat Latitude
  longitude REAL,                 -- Koordinat Longitude
  capacity INTEGER DEFAULT 0,     -- Kapasitas Port
  splitter TEXT,                  -- Info Splitter (e.g., '1:8')
  pppoe TEXT,                     -- Username PPPoE (untuk ONT)
  serialnumber TEXT,              -- SN Perangkat
  notes TEXT,                     -- Catatan Tambahan
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabel `mapping_edges` (Kabel Fiber)

Menyimpan koneksi fisik antar node.

```sql
CREATE TABLE IF NOT EXISTS mapping_edges (
  edge_id TEXT PRIMARY KEY,       -- ID Unik Koneksi
  source TEXT NOT NULL,           -- ID Node Asal (Foreign Key)
  target TEXT NOT NULL,           -- ID Node Tujuan (Foreign Key)
  fiber_type TEXT,                -- Tipe: 'odc_to_odc', 'odp_to_odp'
  distance REAL,                  -- Jarak dalam meter
  waypoints TEXT,                 -- JSON Array: [[lat,lng], [lat,lng], ...] untuk jalur belokan
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source) REFERENCES mapping_nodes(node_id),
  FOREIGN KEY(target) REFERENCES mapping_nodes(node_id)
);
```

### Tabel `map_settings` (Konfigurasi)

Menyimpan posisi default kamera peta.

```sql
CREATE TABLE IF NOT EXISTS map_settings (
  id INTEGER PRIMARY KEY,
  center_lat TEXT,
  center_lng TEXT,
  max_zoom_in TEXT,
  max_zoom_out TEXT,
  default_zoom TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Implementasi Backend (Node.js/Express)

Berikut adalah logika inti untuk endpoint API yang menangani data mapping.

**File: `routes/mapping-data.js`**

```javascript
import express from "express";
import sqlite3 from "sqlite3";
const router = express.Router();
const dbPath = "./database.sqlite"; // Sesuaikan path

// GET Nodes
router.get("/nodes", (req, res) => {
  const db = new sqlite3.Database(dbPath);
  db.all("SELECT * FROM mapping_nodes", [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });

    // Parsing JSON fields jika ada
    res.json({ success: true, data: rows });
  });
});

// GET Edges
router.get("/edges", (req, res) => {
  const db = new sqlite3.Database(dbPath);
  db.all("SELECT * FROM mapping_edges", [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });

    // Parse waypoints dari JSON string ke Array
    const edges = rows.map((row) => ({
      ...row,
      waypoints: row.waypoints ? JSON.parse(row.waypoints) : [],
    }));

    res.json({ success: true, data: edges });
  });
});

// Fitur Validasi Kapasitas (PENTING!)
// Fungsi ini mencegah user menyambungkan kabel jika port ODC/ODP penuh
const validateSlotCapacity = (sourceId, targetId, fiberType) => {
  // ... Logika query count(*) existing edges vs node.capacity ...
  // (Lihat analisis kode sebelumnya untuk detail implementasi lengkap)
};

export default router;
```

---

## 4. Implementasi Frontend (React + Leaflet)

Berikut adalah komponen React lengkap untuk menampilkan peta.

**Dependencies:**
`npm install react react-dom leaflet react-leaflet axios`

**File: `src/pages/NetworkMap.jsx`**

```jsx
import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import "leaflet/dist/leaflet.css";

// Konfigurasi Icon Custom (Penting untuk membedakan OLT/ODC/ODP)
const createIcon = (type) =>
  new L.Icon({
    iconUrl: `/assets/icons/${type}.png`, // Pastikan file gambar ada
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

const NetworkMap = () => {
  const [config, setConfig] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // 1. Load Data saat komponen di-mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsRes, nodesRes, edgesRes] = await Promise.all([
          axios.get("/api/map-settings"),
          axios.get("/api/mapping-data/nodes"),
          axios.get("/api/mapping-data/edges"),
        ]);

        setConfig(settingsRes.data.data);
        setNodes(nodesRes.data.data);
        setEdges(edgesRes.data.data);
      } catch (err) {
        console.error("Gagal memuat data map:", err);
      }
    };
    loadData();
  }, []);

  if (!config)
    return (
      <div className="flex h-screen items-center justify-center">
        Loading Map...
      </div>
    );

  return (
    <div className="relative w-full h-screen">
      {/* Map Container Full Screen */}
      <MapContainer
        center={[parseFloat(config.center_lat), parseFloat(config.center_lng)]}
        zoom={parseInt(config.default_zoom)}
        zoomControl={false} // Disable default zoom, kita pakai custom position
        style={{ height: "100%", width: "100%" }}
      >
        {/* 
                   KEY IMPLEMENTATION DETAIL:
                   Menggunakan Google Maps Hybrid Layer sebagai base map
                */}
        <TileLayer
          url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
          attribution="&copy; Google Maps"
          maxZoom={20}
        />

        <ZoomControl position="bottomright" />

        {/* Render Kabel (Edges) */}
        {edges.map((edge) => (
          <Polyline
            key={edge.edge_id}
            positions={
              [
                // Logika: Cari koordinat node Source & Target
                // Tambahkan waypoints di tengah-tengah
                // (Implementasi detail butuh fungsi helper `getPositions`)
              ]
            }
            pathOptions={{
              color: edge.fiber_type.includes("odc") ? "#ff0000" : "#0000ff", // Merah (Backbone), Biru (Distribusi)
              weight: 3,
              opacity: 0.8,
            }}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold">Kabel Fiber</h3>
                <p>Jarak: {edge.distance} m</p>
                <p>Tipe: {edge.fiber_type}</p>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Render Perangkat (Nodes) */}
        {nodes.map((node) => (
          <Marker
            key={node.node_id}
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

                  {node.serialnumber && (
                    <>
                      <span className="text-gray-500">SN:</span>
                      <span className="font-mono text-xs">
                        {node.serialnumber}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating Legend / Control Panel (Opsional) */}
      <div className="absolute top-4 right-4 bg-white p-4 rounded shadow-lg z-1000">
        <h4 className="font-bold mb-2">Legenda</h4>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 bg-red-500 rounded-full"></span> ODC
          (Backbone)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-500 rounded-full"></span> ODP
          (Distribusi)
        </div>
      </div>
    </div>
  );
};

export default NetworkMap;
```

## 5. Ringkasan Teknis

Untuk mereplikasi fitur ini 100% mirip:

1.  **Backend**: Pastikan endpoint API mengembalikan struktur data JSON yang sama persis (terutama field `waypoints` untuk kabel belok).
2.  **Database**: Gunakan skema SQLite di atas. Jangan lupa validasi kapasitas slot di sisi server.
3.  **Frontend**: Gunakan `react-leaflet` dengan `TileLayer` Google Hybrid (`mt0.google.com`).
4.  **Styling**: Gunakan Tailwind CSS untuk styling popup dan floating controls agar terlihat modern seperti aslinya.
