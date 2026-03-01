"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import Image from "next/image";
import { Button } from '@/components/ui/Button'
import ImageUpload from "@/components/common/ImageUpload";
import type { MappingNode as PrismaMappingNode, MappingEdge, MapSettings } from "@prisma/client";
import L from "leaflet";
import { useToast } from "@/components/ui/Toast";
import { calculateHaversineDistance } from "@/lib/geo-utils";
import {
  HiMagnifyingGlass,
  HiServer,
  HiCube,
  HiSquare3Stack3D,
  HiCpuChip,
  HiMap,
  HiCog6Tooth,
  HiListBullet,
  HiXMark,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";

// Dynamically import Leaflet components
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);
const ZoomControl = dynamic(
  () => import("react-leaflet").then((mod) => mod.ZoomControl),
  { ssr: false }
);

// Fix Leaflet icon issue
if (typeof window !== "undefined") {
  // @ts-expect-error: Fix Leaflet icon issue
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/images/marker-icon-2x.png",
    iconUrl: "/images/marker-icon.png",
    shadowUrl: "/images/marker-shadow.png",
  });
}

// ============================================
// UTILITY FUNCTIONS - EXACT FROM GENIEACS
// ============================================

// Calculate distance using Haversine formula
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  waypoints: [number, number][] = []
): number => {
  const allPoints: [number, number][] = [[lat1, lng1], ...waypoints, [lat2, lng2]];
  let total = 0;
  for (let i = 0; i < allPoints.length - 1; i++) {
    total += calculateHaversineDistance(allPoints[i][0], allPoints[i][1], allPoints[i + 1][0], allPoints[i + 1][1]);
  }
  return Math.round(total * 10) / 10;
};

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================
// NODE ICONS - EXACT FROM GENIEACS (sk object)
// ============================================

const FIBER_CORE_COLORS = [
  { value: "Biru", label: "Biru / Blue", color: "#2563eb" },
  { value: "Orange", label: "Orange", color: "#f97316" },
  { value: "Hijau", label: "Hijau / Green", color: "#22c55e" },
  { value: "Coklat", label: "Coklat / Brown", color: "#92400e" },
  { value: "Abu-abu", label: "Abu-abu / Slate", color: "#6b7280" },
  { value: "Putih", label: "Putih / White", color: "#ffffff", border: true },
  { value: "Merah", label: "Merah / Red", color: "#ef4444" },
  { value: "Hitam", label: "Hitam / Black", color: "#000000" },
  { value: "Kuning", label: "Kuning / Yellow", color: "#eab308" },
  { value: "Ungu", label: "Ungu / Violet", color: "#a855f7" },
  { value: "Pink", label: "Pink / Rose", color: "#ec4899" },
  { value: "Tosca", label: "Tosca / Aqua", color: "#14b8a6" },
];

const nodeIcons = {
  server: {
    color: "#9333ea",
    svg: '<path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  olt: {
    color: "#9333ea",
    svg: '<path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  odc: {
    color: "#2563eb",
    svg: '<path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  odp: {
    color: "#06b6d4",
    svg: '<path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  ont: {
    color: "#ea580c",
    svg: '<path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  pole: {
    color: "#6b7280", // Gray
    svg: '<path d="M12 3v18M8 6h8M8 10h8M8 14h8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  joinbox: {
    color: "#d97706", // Amber-600
    svg: '<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  }
};

const createNodeIcon = (type: string, isSelected = false) => {
  const config = nodeIcons[type as keyof typeof nodeIcons] || nodeIcons.odp;
  const size = isSelected ? 36 : 30;
  const border = isSelected ? "3px solid #facc15" : "2px solid white";

  return L.divIcon({
    className: "custom-node-icon",
    html: `
      <div style="
        background-color: ${config.color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: ${border};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          ${config.svg}
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -15],
  });
};

// Temporary marker icon (for adding new node)
const createTempMarkerIcon = (type: string) => {
  const config = nodeIcons[type as keyof typeof nodeIcons] || nodeIcons.odp;
  return L.divIcon({
    className: "temp-node-icon",
    html: `
      <div style="
        background-color: ${config.color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px dashed white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        cursor: move;
        animation: pulse 1.5s ease-in-out infinite;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          ${config.svg}
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

// ============================================
// FIBER LINE COLORS - EXACT FROM GENIEACS
// ============================================

const getFiberColor = (fiberType?: string | null) => {
  switch (fiberType) {
    case "feeder":
    case "odc_to_odc":
    case "odc_to_odc_ratio":
      return "#c084fc";
    case "distribution":
    case "odp_to_odp":
      return "#60a5fa";
    case "drop":
    case "odp_to_odp_ratio":
      return "#4ade80";
    default:
      return "#9ca3af";
  }
};

// ============================================
// TYPES - MATCHING GENIEACS
// ============================================

type NodeMetadata = {
  poleSize?: string;
  hasSlack?: boolean;
  closureType?: string;
  [key: string]: unknown;
};

type MappingNode = PrismaMappingNode & {
  attenuationIn?: number | null;
  attenuationOut?: number | null;
  inputCoreColor?: string | null;
  photo?: string | null;
  metadata?: NodeMetadata | null;
};

type ActiveTab = "map" | "list" | "settings";
type NodeActionMode = "idle" | "adding" | "editing";
type FiberLineMode = "idle" | "drawing";

interface ConnectedDevices {
  connectedTo: string[];
  connectedFrom: string[];
  usedSlots: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function NetworkMapInteractive() {
  const { showToast } = useToast();

  // Data state
  const [nodes, setNodes] = useState<MappingNode[]>([]);
  const [edges, setEdges] = useState<MappingEdge[]>([]);
  const [settings, setSettings] = useState<MapSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>("map");
  const [mapStyle, setMapStyle] = useState<"satellite" | "plain">("satellite");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Statistics
  const [statistics, setStatistics] = useState({
    totalNodes: 0,
    totalEdges: 0,
    nodesByType: {} as Record<string, number>,
  });

  // ============================================
  // NODE ACTION MODES - EXACT FROM GENIEACS
  // ============================================

  const [serverActionMode, setServerActionMode] = useState<NodeActionMode>("idle");
  const [odcActionMode, setOdcActionMode] = useState<NodeActionMode>("idle");
  const [odpActionMode, setOdpActionMode] = useState<NodeActionMode>("idle");
  const [ontActionMode, setOntActionMode] = useState<NodeActionMode>("idle");
  const [poleActionMode, setPoleActionMode] = useState<NodeActionMode>("idle");
  const [joinboxActionMode, setJoinboxActionMode] = useState<NodeActionMode>("idle");

  // Temp positions for adding/editing
  const [serverTempPosition, setServerTempPosition] = useState<[number, number] | null>(null);
  const [odcTempPosition, setOdcTempPosition] = useState<[number, number] | null>(null);
  const [odpTempPosition, setOdpTempPosition] = useState<[number, number] | null>(null);
  const [ontTempPosition, setOntTempPosition] = useState<[number, number] | null>(null);
  const [poleTempPosition, setPoleTempPosition] = useState<[number, number] | null>(null);
  const [joinboxTempPosition, setJoinboxTempPosition] = useState<[number, number] | null>(null);

  // Selected nodes for editing
  const [selectedServerNode, setSelectedServerNode] = useState<MappingNode | null>(null);
  const [selectedOdcNode, setSelectedOdcNode] = useState<MappingNode | null>(null);
  const [selectedOdpNode, setSelectedOdpNode] = useState<MappingNode | null>(null);
  const [selectedOntNode, setSelectedOntNode] = useState<MappingNode | null>(null);
  const [selectedPoleNode, setSelectedPoleNode] = useState<MappingNode | null>(null);
  const [selectedJoinboxNode, setSelectedJoinboxNode] = useState<MappingNode | null>(null);

  // ============================================
  // FIBER LINE MODE - EXACT FROM GENIEACS
  // ============================================

  const [fiberLineMode, setFiberLineMode] = useState<FiberLineMode>("idle");
  const [fiberSourceNode, setFiberSourceNode] = useState<MappingNode | null>(null);
  const [fiberWaypoints, setFiberWaypoints] = useState<[number, number][]>([]);

  // Modal states
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [nodeFormType, setNodeFormType] = useState<string>("odp");
  const [nodeFormData, setNodeFormData] = useState<Partial<MappingNode>>({});
  const [editingNode, setEditingNode] = useState<MappingNode | null>(null);

  const [showFiberForm, setShowFiberForm] = useState(false);
  const [fiberFormData, setFiberFormData] = useState<{
    source: string;
    target: string;
    fiberType: string;
    waypoints: [number, number][];
  } | null>(null);

  const [isManualAdd, setIsManualAdd] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'node' | 'edge', id: string } | null>(null);

  const mapRef = useRef<L.Map | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, edgesRes, settingsRes, statsRes] = await Promise.all([
        fetch("/api/map/nodes"),
        fetch("/api/map/edges"),
        fetch("/api/map/settings"),
        fetch("/api/map/statistics"),
      ]);

      if (nodesRes.ok) {
        const data = await nodesRes.json();
        setNodes(data.data || []);
      }
      if (edgesRes.ok) {
        const data = await edgesRes.json();
        setEdges(data.data || []);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.data);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data.data || { totalNodes: 0, totalEdges: 0, nodesByType: {} });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add CSS for animations
  useEffect(() => {
    if (typeof document !== "undefined" && !document.getElementById("map-animation-styles")) {
      const style = document.createElement("style");
      style.id = "map-animation-styles";
      style.innerHTML = `
        .animated-polyline {
          stroke-dashoffset: 1000;
          animation: dash 30s linear infinite;
        }
        @keyframes dash {
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // ============================================
  // GET CONNECTED DEVICES - EXACT FROM GENIEACS
  // ============================================

  const getConnectedDevices = useCallback((nodeId: string): ConnectedDevices => {
    const connectedTo = edges
      .filter(e => e.source === nodeId)
      .map(e => e.target);
    const connectedFrom = edges
      .filter(e => e.target === nodeId)
      .map(e => e.source);
    return {
      connectedTo,
      connectedFrom,
      usedSlots: connectedTo.length,
    };
  }, [edges]);

  // ============================================
  // MAP CLICK HANDLER - EXACT LOGIC FROM GENIEACS
  // ============================================

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];

    // If adding a node, set temp position
    if (serverActionMode === "adding") {
      setServerTempPosition(latlng);
      return;
    }
    if (odcActionMode === "adding") {
      setOdcTempPosition(latlng);
      return;
    }
    if (odpActionMode === "adding") {
      setOdpTempPosition(latlng);
      return;
    }
    if (ontActionMode === "adding") {
      setOntTempPosition(latlng);
      return;
    }
    if (poleActionMode === "adding") {
      setPoleTempPosition(latlng);
      return;
    }
    if (joinboxActionMode === "adding") {
      setJoinboxTempPosition(latlng);
      return;
    }

    // If drawing fiber line, add waypoint
    if (fiberLineMode === "drawing" && fiberSourceNode) {
      setFiberWaypoints(prev => [...prev, latlng]);
    }
  }, [serverActionMode, odcActionMode, odpActionMode, ontActionMode, poleActionMode, joinboxActionMode, fiberLineMode, fiberSourceNode]);

  // ============================================
  // NODE CLICK HANDLER - EXACT LOGIC FROM GENIEACS
  // ============================================

  const handleNodeClick = useCallback((node: MappingNode, markerRef: L.Marker | null) => {
    // If fiber line mode is drawing, handle fiber connection
    if (fiberLineMode === "drawing") {
      if (markerRef) {
        markerRef.closePopup(); // Close popup when in drawing mode - EXACT from GenieACS
      }

      if (!fiberSourceNode) {
        // First click - set source
        setFiberSourceNode(node);
        showToast("info", `Source: ${node.name}. Click on map to add waypoints, then click target node.`);
      } else if (fiberSourceNode.nodeId !== node.nodeId) {
        // Second click - complete fiber line
        setFiberFormData({
          source: fiberSourceNode.nodeId,
          target: node.nodeId,
          fiberType: determineFiberType(fiberSourceNode.type, node.type),
          waypoints: fiberWaypoints,
        });
        setShowFiberForm(true);
      }
      return;
    }

    // Normal click - popup will show automatically
  }, [fiberLineMode, fiberSourceNode, fiberWaypoints, showToast]);

  // Determine fiber type based on source and target node types - FROM GENIEACS
  const determineFiberType = (sourceType: string, targetType: string): string => {
    // 1. Feeder: Involves Server/OLT
    if (
      sourceType === "server" || sourceType === "olt" ||
      targetType === "server" || targetType === "olt"
    ) {
      return "feeder";
    }

    // 2. Drop: Involves ONT
    if (sourceType === "ont" || targetType === "ont") {
      return "drop";
    }

    // 3. ODP to ODP (Cascading)
    if (sourceType === "odp" && targetType === "odp") {
      return "odp_to_odp";
    }

    // 4. Pole/Joinbox special cases
    // If connecting ODP to Pole/Joinbox, it could be Drop or Distribution.
    // We'll default to Distribution to keep the map clean (Blue lines),
    // unless explicitly connecting to an ONT (Green lines).

    // Default to Distribution for everything else (ODC->ODP, ODC->Pole, Pole->Pole, Joinbox, etc.)
    return "distribution";
  };

  // ============================================
  // NODE POSITION HANDLERS - EXACT FROM GENIEACS
  // ============================================

  // Server handlers
  const handleServerPositionSave = async () => {
    if (!serverTempPosition) return;

    if (serverActionMode === "adding") {
      setNodeFormType("olt");
      setNodeFormData({
        type: "olt",
        latitude: serverTempPosition[0],
        longitude: serverTempPosition[1],
        capacity: 16,
      });
      setShowNodeForm(true);
    } else if (serverActionMode === "editing" && selectedServerNode) {
      await updateNodePosition(selectedServerNode.nodeId, serverTempPosition);
    }

    setServerActionMode("idle");
    setServerTempPosition(null);
    setSelectedServerNode(null);
  };

  const handleServerPositionCancel = () => {
    setServerActionMode("idle");
    setServerTempPosition(null);
    setSelectedServerNode(null);
  };

  // ODC handlers
  const handleOdcPositionSave = async () => {
    if (!odcTempPosition) return;

    if (odcActionMode === "adding") {
      setNodeFormType("odc");
      setNodeFormData({
        type: "odc",
        latitude: odcTempPosition[0],
        longitude: odcTempPosition[1],
        capacity: 8,
      });
      setShowNodeForm(true);
    } else if (odcActionMode === "editing" && selectedOdcNode) {
      await updateNodePosition(selectedOdcNode.nodeId, odcTempPosition);
    }

    setOdcActionMode("idle");
    setOdcTempPosition(null);
    setSelectedOdcNode(null);
  };

  const handleOdcPositionCancel = () => {
    setOdcActionMode("idle");
    setOdcTempPosition(null);
    setSelectedOdcNode(null);
  };

  // ODP handlers
  const handleOdpPositionSave = async () => {
    if (!odpTempPosition) return;

    if (odpActionMode === "adding") {
      setNodeFormType("odp");
      setNodeFormData({
        type: "odp",
        latitude: odpTempPosition[0],
        longitude: odpTempPosition[1],
        capacity: 8,
      });
      setShowNodeForm(true);
    } else if (odpActionMode === "editing" && selectedOdpNode) {
      await updateNodePosition(selectedOdpNode.nodeId, odpTempPosition);
    }

    setOdpActionMode("idle");
    setOdpTempPosition(null);
    setSelectedOdpNode(null);
  };

  const handleOdpPositionCancel = () => {
    setOdpActionMode("idle");
    setOdpTempPosition(null);
    setSelectedOdpNode(null);
  };

  // ONT handlers
  const handleOntPositionSave = async () => {
    if (!ontTempPosition) return;

    if (ontActionMode === "adding") {
      setNodeFormType("ont");
      setNodeFormData({
        type: "ont",
        latitude: ontTempPosition[0],
        longitude: ontTempPosition[1],
        capacity: 1,
      });
      setShowNodeForm(true);
    } else if (ontActionMode === "editing" && selectedOntNode) {
      await updateNodePosition(selectedOntNode.nodeId, ontTempPosition);
    }

    setOntActionMode("idle");
    setOntTempPosition(null);
    setSelectedOntNode(null);
  };

  const handleOntPositionCancel = () => {
    setOntActionMode("idle");
    setOntTempPosition(null);
    setSelectedOntNode(null);
  };

  // Pole handlers
  const handlePolePositionSave = async () => {
    if (!poleTempPosition) return;

    if (poleActionMode === "adding") {
      setNodeFormType("pole");
      setNodeFormData({
        type: "pole",
        latitude: poleTempPosition[0],
        longitude: poleTempPosition[1],
        capacity: 0, // Poles typically don't have port capacity like ODP
      });
      setShowNodeForm(true);
    } else if (poleActionMode === "editing" && selectedPoleNode) {
      await updateNodePosition(selectedPoleNode.nodeId, poleTempPosition);
    }

    setPoleActionMode("idle");
    setPoleTempPosition(null);
    setSelectedPoleNode(null);
  };

  const handlePolePositionCancel = () => {
    setPoleActionMode("idle");
    setPoleTempPosition(null);
    setSelectedPoleNode(null);
  };

  // Joinbox handlers
  const handleJoinboxPositionSave = async () => {
    if (!joinboxTempPosition) return;

    if (joinboxActionMode === "adding") {
      setNodeFormType("joinbox");
      setNodeFormData({
        type: "joinbox",
        latitude: joinboxTempPosition[0],
        longitude: joinboxTempPosition[1],
        capacity: 24, // Default capacity
      });
      setShowNodeForm(true);
    } else if (joinboxActionMode === "editing" && selectedJoinboxNode) {
      await updateNodePosition(selectedJoinboxNode.nodeId, joinboxTempPosition);
    }

    setJoinboxActionMode("idle");
    setJoinboxTempPosition(null);
    setSelectedJoinboxNode(null);
  };

  const handleJoinboxPositionCancel = () => {
    setJoinboxActionMode("idle");
    setJoinboxTempPosition(null);
    setSelectedJoinboxNode(null);
  };

  // ============================================
  // FIBER LINE HANDLERS - EXACT FROM GENIEACS
  // ============================================

  const handleFiberLineCancel = () => {
    setFiberLineMode("idle");
    setFiberSourceNode(null);
    setFiberWaypoints([]);
  };

  const handleFiberLineComplete = async (formData: { name: string; fiberType: string; notes: string }) => {
    if (!fiberFormData) return;

    try {
      const sourceNode = nodes.find(n => n.nodeId === fiberFormData.source);
      const targetNode = nodes.find(n => n.nodeId === fiberFormData.target);

      if (!sourceNode || !targetNode) return;

      // Calculate distance
      const distance = calculateDistance(
        sourceNode.latitude!,
        sourceNode.longitude!,
        targetNode.latitude!,
        targetNode.longitude!,
        fiberFormData.waypoints
      );

      const res = await fetch("/api/map/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edgeId: generateId(),
          source: fiberFormData.source,
          target: fiberFormData.target,
          name: formData.name,
          fiberType: formData.fiberType,
          distance,
          waypoints: JSON.stringify(fiberFormData.waypoints),
          notes: formData.notes,
        }),
      });

      if (res.ok) {
        showToast("success", "Fiber line added");
        fetchData();
      } else {
        const error = await res.json();
        showToast("error", error.error || "Gagal menambah jalur fiber");
      }
    } catch (error) {
      console.error(error);
      showToast("error", "Gagal menambah jalur fiber");
    }

    setShowFiberForm(false);
    setFiberFormData(null);
    setFiberLineMode("idle");
    setFiberSourceNode(null);
    setFiberWaypoints([]);
  };

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  const updateNodePosition = async (nodeId: string, position: [number, number]) => {
    try {
      const res = await fetch(`/api/map/nodes/${nodeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position[0],
          longitude: position[1],
        }),
      });

      if (res.ok) {
        showToast("success", "Position updated");
        fetchData();
      }
    } catch (error) {
      console.error(error);
      showToast("error", "Gagal mengupdate posisi");
    }
  };

  const saveNode = async () => {
    try {
      const data = {
        ...nodeFormData,
        nodeId: editingNode?.nodeId || generateId(),
      };

      const url = editingNode ? `/api/map/nodes/${editingNode.nodeId}` : "/api/map/nodes";
      const method = editingNode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        showToast("success", editingNode ? "Node updated" : "Node added");
        fetchData();
        setShowNodeForm(false);
        setNodeFormData({});
        setEditingNode(null);

        // Reset action modes
        setServerActionMode("idle");
        setOdcActionMode("idle");
        setOdpActionMode("idle");
        setOntActionMode("idle");
        setPoleActionMode("idle");
        setJoinboxActionMode("idle");
        setServerTempPosition(null);
        setOdcTempPosition(null);
        setOdpTempPosition(null);
        setOntTempPosition(null);
        setPoleTempPosition(null);
        setJoinboxTempPosition(null);
      } else {
        const error = await res.json();
        showToast("error", error.error || "Gagal menyimpan node");
      }
    } catch (error) {
      console.error(error);
      showToast("error", "Gagal menyimpan node");
    }
  };

  const deleteNode = (nodeId: string) => {
    setDeleteConfirmation({ type: 'node', id: nodeId });
  };

  const deleteEdge = (edgeId: string) => {
    setDeleteConfirmation({ type: 'edge', id: edgeId });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    const { type, id } = deleteConfirmation;
    const endpoint = type === 'node' ? `/api/map/nodes/${id}` : `/api/map/edges/${id}`;
    const label = type === 'node' ? 'Node' : 'Fiber line';

    try {
      const res = await fetch(endpoint, { method: "DELETE" });

      if (res.ok) {
        showToast("success", `${label} deleted successfully`);
        fetchData();
        setDeleteConfirmation(null);
      } else {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error(`DELETE ${type} failed:`, error);

        if (res.status === 403) {
          showToast("error", "Permission denied: You cannot delete this item");
        } else if (res.status === 404) {
          showToast("error", `${label} not found (might be already deleted)`);
        } else {
          showToast("error", error.error || `Failed to delete ${label}`);
        }
      }
    } catch (error) {
      console.error(`DELETE ${type} exception:`, error);
      showToast("error", `Failed to delete ${label}: Network error`);
    }
  };

  const onEditNodeLocation = (node: MappingNode) => {
    const position: [number, number] = [node.latitude!, node.longitude!];

    switch (node.type) {
      case "server":
      case "olt":
        setSelectedServerNode(node);
        setServerTempPosition(position);
        setServerActionMode("editing");
        break;
      case "odc":
        setSelectedOdcNode(node);
        setOdcTempPosition(position);
        setOdcActionMode("editing");
        break;
      case "odp":
        setSelectedOdpNode(node);
        setOdpTempPosition(position);
        setOdpActionMode("editing");
        break;
      case "ont":
        setSelectedOntNode(node);
        setOntTempPosition(position);
        setOntActionMode("editing");
        break;
      case "pole":
        setSelectedPoleNode(node);
        setPoleTempPosition(position);
        setPoleActionMode("editing");
        break;
      case "joinbox":
        setSelectedJoinboxNode(node);
        setJoinboxTempPosition(position);
        setJoinboxActionMode("editing");
        break;
    }
  };

  const onEditNode = (node: MappingNode) => {
    setEditingNode(node);
    setNodeFormType(node.type);
    setNodeFormData({
      type: node.type,
      name: node.name,
      latitude: node.latitude,
      longitude: node.longitude,
      capacity: node.capacity,
      splitter: node.splitter,
      pppoe: node.pppoe,
      serialNumber: node.serialNumber,
      notes: node.notes,
      attenuationIn: node.attenuationIn,
      attenuationOut: node.attenuationOut,
      inputCoreColor: node.inputCoreColor,
      photo: node.photo,
      metadata: node.metadata,
    });
    setShowNodeForm(true);
  };

  // ============================================
  // TOOLBAR BUTTON HANDLERS
  // ============================================

  const handleToolbarClick = (tool: string) => {
    // Cancel any active mode first
    handleServerPositionCancel();
    handleOdcPositionCancel();
    handleOdpPositionCancel();
    handleOntPositionCancel();
    handlePolePositionCancel();
    handleJoinboxPositionCancel();
    handleFiberLineCancel();
    setIsManualAdd(false);

    switch (tool) {
      case "server":
        setServerActionMode("adding");
        showToast("info", "Click on map to place Server/OLT");
        break;
      case "odc":
        setOdcActionMode("adding");
        showToast("info", "Click on map to place ODC");
        break;
      case "odp":
        setOdpActionMode("adding");
        showToast("info", "Click on map to place ODP");
        break;
      case "ont":
        setOntActionMode("adding");
        showToast("info", "Click on map to place ONT");
        break;
      case "pole":
        setPoleActionMode("adding");
        showToast("info", "Click on map to place Pole");
        break;
      case "joinbox":
        setJoinboxActionMode("adding");
        showToast("info", "Click on map to place Joinbox");
        break;
      case "fiber":
        setFiberLineMode("drawing");
        showToast("info", "Click on source node to start drawing fiber line");
        break;
    }
  };

  const handleManualAdd = (type: string) => {
    setNodeFormType(type);
    setNodeFormData({
      type: type,
      latitude: 0,
      longitude: 0,
      capacity: type === "ont" ? 1 : type === "olt" ? 16 : 8,
    });
    setIsManualAdd(true);
    setShowNodeForm(true);
  };

  const isAnyModeActive =
    serverActionMode !== "idle" ||
    odcActionMode !== "idle" ||
    odpActionMode !== "idle" ||
    ontActionMode !== "idle" ||
    poleActionMode !== "idle" ||
    joinboxActionMode !== "idle" ||
    fiberLineMode !== "idle";

  // ============================================
  // MAP CONFIG
  // ============================================

  const centerPosition: [number, number] = settings?.centerLat && settings?.centerLng
    ? [parseFloat(settings.centerLat), parseFloat(settings.centerLng)]
    : [-6.2088, 106.8456];

  const zoomLevel = settings?.defaultZoom ? parseInt(settings.defaultZoom) : 13;
  const maxZoomIn = settings?.maxZoomIn ? parseInt(settings.maxZoomIn) : 22;
  const minZoomOut = settings?.maxZoomOut ? parseInt(settings.maxZoomOut) : 5;

  const tileUrl = mapStyle === "satellite"
    ? "https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
    : "https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}";

  const filteredNodes = searchQuery
    ? nodes.filter(n =>
      n.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : nodes;

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const toolButtonClass = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active
      ? "bg-blue-600 text-white shadow-md"
      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
    }`;

  return (
    <div className="flex flex-col h-[calc(100vh-150px)] bg-gray-100 dark:bg-gray-900">
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 relative z-10 overflow-visible">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden md:block">
              Topology Map
            </h1>
            {/* Left: Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <Button variant="ghost" onClick={() => setActiveTab("map")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "map"
                  ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
              >
                <HiMap className="w-4 h-4" />
                Map
              </Button>
              <Button variant="ghost" onClick={() => setActiveTab("list")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "list"
                  ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
              >
                <HiListBullet className="w-4 h-4" />
                List
              </Button>
              <Button variant="ghost" onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "settings"
                  ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
              >
                <HiCog6Tooth className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </div>

          {/* Right: Tools */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative z-20">
              <Button onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                className={toolButtonClass(showSearchDropdown)}
              >
                <HiMagnifyingGlass className="w-4 h-4" />
                Search
              </Button>
              {showSearchDropdown && (
                <div
                  className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
                >
                  <div className="p-3">
                    <input
                      type="text"
                      placeholder="Search nodes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                  {searchQuery && (
                    <div className="max-h-64 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
                      {filteredNodes.slice(0, 10).map((node) => (
                        <Button key={node.nodeId}
                          onClick={() => {
                            if (mapRef.current && node.latitude && node.longitude) {
                              mapRef.current.setView([node.latitude, node.longitude], 18);
                            }
                            setShowSearchDropdown(false);
                            setSearchQuery("");
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: nodeIcons[node.type as keyof typeof nodeIcons]?.color || "#6b7280" }}
                          />
                          <span className="text-gray-900 dark:text-white flex-1">{node.name}</span>
                          <span className="text-gray-500 text-xs">{node.type.toUpperCase()}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

            {/* Node Tools */}
            <Button onClick={() => handleToolbarClick("server")}
              className={toolButtonClass(serverActionMode !== "idle")}
            >
              <HiServer className="w-4 h-4" />
              Server
            </Button>
            <Button onClick={() => handleToolbarClick("odc")}
              className={toolButtonClass(odcActionMode !== "idle")}
            >
              <HiCube className="w-4 h-4" />
              ODC
            </Button>
            <Button onClick={() => handleToolbarClick("odp")}
              className={toolButtonClass(odpActionMode !== "idle")}
            >
              <HiSquare3Stack3D className="w-4 h-4" />
              ODP
            </Button>
            <Button onClick={() => handleToolbarClick("ont")}
              className={toolButtonClass(ontActionMode !== "idle")}
            >
              <HiCpuChip className="w-4 h-4" />
              ONT
            </Button>
            <Button onClick={() => handleToolbarClick("pole")}
              className={toolButtonClass(poleActionMode !== "idle")}
            >
              {/* Using HiMap for Pole as a generic icon, or can use SVG */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18M8 6h8M8 10h8M8 14h8" />
              </svg>
              Pole
            </Button>
            <Button onClick={() => handleToolbarClick("joinbox")}
              className={toolButtonClass(joinboxActionMode !== "idle")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Joinbox
            </Button>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

            {/* Fiber Line Tool */}
            <Button onClick={() => handleToolbarClick("fiber")}
              className={toolButtonClass(fiberLineMode !== "idle")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Fiber Line
            </Button>
          </div>
        </div>
      </div>

      {/* Mode Indicator Bar */}
      {isAnyModeActive && (
        <div className="bg-blue-500 text-white px-4 py-2 flex items-center justify-between">
          <span className="text-sm">
            {serverActionMode === "adding" && "Click on map to place Server/OLT, then click Save"}
            {serverActionMode === "editing" && "Drag marker to new position, then click Save"}
            {odcActionMode === "adding" && "Click on map to place ODC, then click Save"}
            {odcActionMode === "editing" && "Drag marker to new position, then click Save"}
            {odpActionMode === "adding" && "Click on map to place ODP, then click Save"}
            {odpActionMode === "editing" && "Drag marker to new position, then click Save"}
            {ontActionMode === "adding" && "Click on map to place ONT, then click Save"}
            {ontActionMode === "editing" && "Drag marker to new position, then click Save"}
            {poleActionMode === "adding" && "Click on map to place Pole, then click Save"}
            {poleActionMode === "editing" && "Drag marker to new position, then click Save"}
            {joinboxActionMode === "adding" && "Click on map to place Joinbox, then click Save"}
            {joinboxActionMode === "editing" && "Drag marker to new position, then click Save"}
            {fiberLineMode === "drawing" && !fiberSourceNode && "Click on source node to start"}
            {fiberLineMode === "drawing" && fiberSourceNode && `From: ${fiberSourceNode.name}. Click map for waypoints, click target node to finish. (${fiberWaypoints.length} waypoints)`}
          </span>
          <div className="flex items-center gap-2">
            {(serverTempPosition || odcTempPosition || odpTempPosition || ontTempPosition || poleTempPosition || joinboxTempPosition) && (
              <Button onClick={() => {
                if (serverActionMode !== "idle") handleServerPositionSave();
                if (odcActionMode !== "idle") handleOdcPositionSave();
                if (odpActionMode !== "idle") handleOdpPositionSave();
                if (ontActionMode !== "idle") handleOntPositionSave();
                if (poleActionMode !== "idle") handlePolePositionSave();
                if (joinboxActionMode !== "idle") handleJoinboxPositionSave();
              }}
                className="px-3 py-1 bg-green-500 hover:bg-green-600 rounded text-sm font-medium"
              >
                Save
              </Button>
            )}
            <Button onClick={() => {
              handleServerPositionCancel();
              handleOdcPositionCancel();
              handleOdpPositionCancel();
              handleOntPositionCancel();
              handlePolePositionCancel();
              handleJoinboxPositionCancel();
              handleFiberLineCancel();
            }}
              className="p-1 hover:bg-blue-600 rounded"
            >
              <HiXMark className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeTab === "map" && (
          <>
            <div className="flex-1 relative z-[0]">
              <MapContainer
                key={`map-${activeTab}-${mapStyle}`} // Add unique key to force remount on tab/style change
                center={centerPosition}
                zoom={zoomLevel}
                minZoom={minZoomOut}
                maxZoom={maxZoomIn}
                zoomControl={false}
                className="w-full h-full"
                style={{ height: "100%", width: "100%" }}
                ref={(map) => {
                  if (map) {
                    mapRef.current = map;
                    // Use a timeout to ensure map is fully initialized before attaching events
                    // This helps prevent "Map container is being reused" issues in some cases
                    setTimeout(() => {
                      map.off("click");
                      map.on("click", handleMapClick);
                    }, 0);
                  }
                }}
              >
                <TileLayer url={tileUrl} attribution="© Google Maps" maxZoom={maxZoomIn} minZoom={minZoomOut} />
                <ZoomControl position="topleft" />

                {/* Fiber Lines */}
                {edges.map((edge) => {
                  const sourceNode = nodes.find((n) => n.nodeId === edge.source);
                  const targetNode = nodes.find((n) => n.nodeId === edge.target);

                  if (!sourceNode?.latitude || !sourceNode?.longitude || !targetNode?.latitude || !targetNode?.longitude)
                    return null;

                  const waypoints = edge.waypoints ? JSON.parse(edge.waypoints) : [];
                  const positions: [number, number][] = [
                    [sourceNode.latitude, sourceNode.longitude],
                    ...waypoints,
                    [targetNode.latitude, targetNode.longitude],
                  ];

                  const totalDistance = calculateDistance(
                    sourceNode.latitude,
                    sourceNode.longitude,
                    targetNode.latitude,
                    targetNode.longitude,
                    waypoints
                  );

                  return (
                    <Polyline
                      key={edge.edgeId}
                      positions={positions}
                      pathOptions={{
                        color: getFiberColor(edge.fiberType),
                        weight: 6,
                        opacity: 0.9,
                        dashArray: "10, 15",
                        className: "animated-polyline",
                      }}
                    >
                      <Popup>
                        <div className="min-w-[220px]">
                          <h3 className="font-bold text-base border-b pb-2 mb-3">Fiber Line</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">From:</span>
                              <span className="font-medium">{sourceNode.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">To:</span>
                              <span className="font-medium">{targetNode.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Distance:</span>
                              <span className="font-medium">{totalDistance.toFixed(1)} m</span>
                            </div>
                          </div>
                          <Button onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log("Delete button clicked for edge:", edge.edgeId);
                            deleteEdge(edge.edgeId);
                          }}
                            onMouseDown={(e) => {
                              // Prevent map drag/click propagation
                              e.stopPropagation();
                            }}
                            className="w-full mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center gap-2 text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Fiber Line
                          </Button>
                        </div>
                      </Popup>
                    </Polyline>
                  );
                })}

                {/* Drawing preview line */}
                {fiberLineMode === "drawing" && fiberSourceNode && fiberWaypoints.length > 0 && (
                  <Polyline
                    positions={[
                      [fiberSourceNode.latitude!, fiberSourceNode.longitude!],
                      ...fiberWaypoints,
                    ]}
                    pathOptions={{
                      color: "#facc15",
                      weight: 4,
                      dashArray: "10, 10",
                      opacity: 0.8,
                    }}
                  />
                )}

                {/* Temp Markers for Adding/Editing */}
                {serverTempPosition && (
                  <Marker
                    position={serverTempPosition}
                    icon={createTempMarkerIcon("olt")}
                    draggable
                    eventHandlers={{
                      dragend: (e) => setServerTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold mb-1">{serverActionMode === "adding" ? "New Server Position" : "Editing Position"}</p>
                        <p className="text-xs text-gray-600">Drag marker to adjust position</p>
                        <p className="text-xs text-gray-500 font-mono mt-1">
                          {serverTempPosition[0].toFixed(6)}, {serverTempPosition[1].toFixed(6)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {odcTempPosition && (
                  <Marker
                    position={odcTempPosition}
                    icon={createTempMarkerIcon("odc")}
                    draggable
                    eventHandlers={{
                      dragend: (e) => setOdcTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold mb-1">{odcActionMode === "adding" ? "New ODC Position" : "Editing Position"}</p>
                        <p className="text-xs text-gray-600">Drag marker to adjust position</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {odpTempPosition && (
                  <Marker
                    position={odpTempPosition}
                    icon={createTempMarkerIcon("odp")}
                    draggable
                    eventHandlers={{
                      dragend: (e) => setOdpTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold mb-1">{odpActionMode === "adding" ? "New ODP Position" : "Editing Position"}</p>
                        <p className="text-xs text-gray-600">Drag marker to adjust position</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {ontTempPosition && (
                  <Marker
                    position={ontTempPosition}
                    icon={createTempMarkerIcon("ont")}
                    draggable
                    eventHandlers={{
                      dragend: (e) => setOntTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold mb-1">{ontActionMode === "adding" ? "New ONT Position" : "Editing Position"}</p>
                        <p className="text-xs text-gray-600">Drag marker to adjust position</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {poleTempPosition && (
                  <Marker
                    position={poleTempPosition}
                    icon={createTempMarkerIcon("pole")}
                    draggable
                    eventHandlers={{
                      dragend: (e) => setPoleTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold mb-1">{poleActionMode === "adding" ? "New Pole Position" : "Editing Position"}</p>
                        <p className="text-xs text-gray-600">Drag marker to adjust position</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {joinboxTempPosition && (
                  <Marker
                    position={joinboxTempPosition}
                    icon={createTempMarkerIcon("joinbox")}
                    draggable
                    eventHandlers={{
                      dragend: (e) => setJoinboxTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold mb-1">{joinboxActionMode === "adding" ? "New Joinbox Position" : "Editing Position"}</p>
                        <p className="text-xs text-gray-600">Drag marker to adjust position</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Existing Nodes */}
                {nodes.map((node) => {
                  if (!node.latitude || !node.longitude) return null;

                  // Don't show if we're editing this node
                  if (
                    (serverActionMode === "editing" && selectedServerNode?.nodeId === node.nodeId) ||
                    (odcActionMode === "editing" && selectedOdcNode?.nodeId === node.nodeId) ||
                    (odpActionMode === "editing" && selectedOdpNode?.nodeId === node.nodeId) ||
                    (ontActionMode === "editing" && selectedOntNode?.nodeId === node.nodeId) ||
                    (poleActionMode === "editing" && selectedPoleNode?.nodeId === node.nodeId) ||
                    (joinboxActionMode === "editing" && selectedJoinboxNode?.nodeId === node.nodeId)
                  )
                    return null;

                  const isSelected = node.nodeId === fiberSourceNode?.nodeId;
                  const connected = getConnectedDevices(node.nodeId);

                  // Get connected node names
                  const connectedFromNodes = Array.from(new Set(connected.connectedFrom)).map(id => nodes.find(n => n.nodeId === id)).filter(Boolean);
                  const connectedToNodes = Array.from(new Set(connected.connectedTo)).map(id => nodes.find(n => n.nodeId === id)).filter(Boolean);

                  // Calculate slot usage based on splitter
                  const getSplitterCapacity = (splitter: string | null) => {
                    if (!splitter) return 8;
                    const match = splitter.match(/1:(\d+)/);
                    return match ? parseInt(match[1]) : 8;
                  };

                  const capacity = node.splitter ? getSplitterCapacity(node.splitter) : (node.capacity || 8);
                  const usedSlots = connected.usedSlots;
                  const availableSlots = Math.max(0, capacity - usedSlots);
                  const usagePercent = (usedSlots / capacity) * 100;

                  // Get badge info based on node type
                  const getBadgeInfo = (type: string) => {
                    switch (type) {
                      case "server":
                      case "olt":
                        return { label: "Server/OLT", color: "bg-purple-500" };
                      case "odc":
                        return { label: "ODC Cabinet", color: "bg-blue-500" };
                      case "odp":
                        return { label: "ODP Box", color: "bg-cyan-500" };
                      case "ont":
                        return { label: "ONT Device", color: "bg-orange-500" };
                      case "pole":
                        return { label: "Pole / Tiang", color: "bg-gray-600" };
                      case "joinbox":
                        return { label: "Joinbox / Closure", color: "bg-amber-600" };
                      default:
                        return { label: type.toUpperCase(), color: "bg-gray-500" };
                    }
                  };

                  const badge = getBadgeInfo(node.type);
                  const isServerOrOlt = node.type === "server" || node.type === "olt";
                  const isOdc = node.type === "odc";
                  const isOdp = node.type === "odp";

                  const copyInfo = () => {
                    const info = `${node.name}\n${node.latitude?.toFixed(6)}, ${node.longitude?.toFixed(6)}`;
                    navigator.clipboard.writeText(info);
                    showToast("success", "Info copied to clipboard");
                  };

                  return (
                    <Marker
                      key={node.nodeId}
                      position={[node.latitude, node.longitude]}
                      icon={createNodeIcon(node.type, isSelected)}
                      eventHandlers={{
                        click: (e) => handleNodeClick(node, e.target),
                      }}
                    >
                      {fiberLineMode !== "drawing" && (
                        <Popup>
                          <div className="min-w-[240px] max-w-[280px]">
                            {/* Photo if available */}
                            {node.photo && (
                              <div className="mb-3 relative w-full h-40 rounded-lg overflow-hidden bg-gray-100">
                                <Image
                                  src={node.photo}
                                  alt={node.name}
                                  fill
                                  className="object-cover"
                                  sizes="280px"
                                />
                              </div>
                            )}

                            {/* Badge */}
                            <div className="mb-2">
                              <span className={`inline-block px-2 py-1 text-xs font-medium text-white rounded ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>

                            {/* Name */}
                            <h3 className="font-bold text-lg text-gray-900 mb-1">{node.name}</h3>

                            {/* Coordinates */}
                            <div className="flex items-center gap-1 text-sm text-blue-600 mb-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{node.latitude?.toFixed(6)}, {node.longitude?.toFixed(6)}</span>
                            </div>

                            {/* Copy Info Button */}
                            <Button variant="secondary" size="sm"
                              onClick={copyInfo}
                              className="mb-3"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy Info
                            </Button>

                            {/* Slot Usage - for ODC and ODP */}
                            {(isOdc || isOdp) && (
                              <div className="border-t border-gray-200 pt-3 mb-3">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm font-medium text-gray-700">Slot Usage</span>
                                  <span className="text-sm font-medium text-gray-900">{usedSlots}/{capacity}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                  <div
                                    className={`h-2 rounded-full ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                    style={{ width: `${usagePercent}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Available:</span>
                                  <span className="font-medium text-green-600">{availableSlots} ports</span>
                                </div>
                              </div>
                            )}

                            {/* Attenuation Info - for ODC and ODP */}
                            {(isOdc || isOdp) && (
                              <div className="border-t border-gray-200 pt-3 mb-3">
                                <p className="text-sm font-medium text-gray-700 mb-1">Optical Info</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span className="text-gray-500 block">Input Redaman:</span>
                                    <span className="font-medium text-gray-900">{node.attenuationIn ? `${node.attenuationIn} dBm` : "-"}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 block">Output Redaman:</span>
                                    <span className="font-medium text-gray-900">{node.attenuationOut ? `${node.attenuationOut} dBm` : "-"}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-gray-500 block">Warna Core Input:</span>
                                    <span className="font-medium text-gray-900">{node.inputCoreColor || "-"}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Connected From - for ODC, ODP, ONT */}
                            {connectedFromNodes.length > 0 && (
                              <div className="border-t border-gray-200 pt-3 mb-3">
                                <p className="text-sm font-medium text-gray-700 mb-1">Connected from:</p>
                                <div className="space-y-1">
                                  {connectedFromNodes.map((n) => (
                                    <div key={n!.nodeId} className="flex items-center gap-2 text-sm">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: nodeIcons[n!.type as keyof typeof nodeIcons]?.color || "#6b7280" }}
                                      />
                                      <span className="text-gray-600">{n!.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Connected To - for Server/OLT and ODC */}
                            {connectedToNodes.length > 0 && (isServerOrOlt || isOdc) && (
                              <div className="border-t border-gray-200 pt-3 mb-3">
                                <p className="text-sm font-medium text-gray-700 mb-1">
                                  {isServerOrOlt ? "Connected to ODCs:" : "Connected to ODPs:"}
                                </p>
                                <div className="space-y-1">
                                  {connectedToNodes.map((n) => (
                                    <div key={n!.nodeId} className="flex items-center gap-2 text-sm">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: nodeIcons[n!.type as keyof typeof nodeIcons]?.color || "#6b7280" }}
                                      />
                                      <span className="text-gray-600">{n!.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="border-t border-gray-200 pt-3 space-y-2">
                              {/* Edit Button */}
                              <Button onClick={() => onEditNode(node)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit {isServerOrOlt ? "OLT" : node.type.toUpperCase()}
                              </Button>

                              {/* Edit Location and Delete Buttons */}
                              <div className="flex gap-2">
                                <Button onClick={() => onEditNodeLocation(node)}
                                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  Edit Location
                                </Button>
                                <Button onClick={() => deleteNode(node.nodeId)}
                                  className="flex items-center justify-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      )}
                    </Marker>
                  );
                })}
              </MapContainer>

              {/* Fiber Drawing Info Panel */}
              {fiberLineMode === "drawing" && fiberSourceNode && (
                <div className="absolute top-4 left-4 z-1000 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">Drawing Fiber Line</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-600 dark:text-gray-400">Source:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{fiberSourceNode.name}</span>
                    </div>
                    <div className="text-blue-600 dark:text-blue-400">Click target node</div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Waypoints:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{fiberWaypoints.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Distance:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {fiberWaypoints.length > 0
                          ? `${calculateDistance(
                            fiberSourceNode.latitude!,
                            fiberSourceNode.longitude!,
                            fiberWaypoints[fiberWaypoints.length - 1][0],
                            fiberWaypoints[fiberWaypoints.length - 1][1],
                            fiberWaypoints.slice(0, -1)
                          ).toFixed(1)} m`
                          : "0 m"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Map Style Toggle */}
              <Button onClick={() => setMapStyle(mapStyle === "satellite" ? "plain" : "satellite")}
                className="absolute bottom-4 right-4 z-1000 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <HiMap className="w-4 h-4" />
                {mapStyle === "satellite" ? "Sat Plain" : "Plain Sat"}
              </Button>
            </div>

            {/* Statistics Bar */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
              <div className="flex gap-6">
                <StatCard label="Servers/OLT" value={statistics.nodesByType["olt"] || statistics.nodesByType["server"] || 0} description="Active nodes" color="#9333ea" />
                <StatCard label="ODC Cabinets" value={statistics.nodesByType["odc"] || 0} description="Distribution points" color="#2563eb" />
                <StatCard label="ODP Boxes" value={statistics.nodesByType["odp"] || 0} description="Drop points" color="#06b6d4" />
                <StatCard label="ONT Devices" value={statistics.nodesByType["ont"] || 0} description="Customer units" color="#ea580c" />
              </div>
            </div>
          </>
        )}

        {activeTab === "list" && (
          <div className="flex-1 p-6 overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Node List</h2>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Manual Add Button Group */}
                <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <Button onClick={() => handleManualAdd("olt")}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-r border-gray-200 dark:border-gray-700 flex items-center gap-1"
                    title="Add Server/OLT"
                  >
                    <HiServer className="w-4 h-4 text-purple-500" />
                    <span className="hidden sm:inline">OLT</span>
                  </Button>
                  <Button onClick={() => handleManualAdd("odc")}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-r border-gray-200 dark:border-gray-700 flex items-center gap-1"
                    title="Add ODC"
                  >
                    <HiCube className="w-4 h-4 text-blue-500" />
                    <span className="hidden sm:inline">ODC</span>
                  </Button>
                  <Button onClick={() => handleManualAdd("odp")}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-r border-gray-200 dark:border-gray-700 flex items-center gap-1"
                    title="Add ODP"
                  >
                    <HiSquare3Stack3D className="w-4 h-4 text-cyan-500" />
                    <span className="hidden sm:inline">ODP</span>
                  </Button>
                  <Button onClick={() => handleManualAdd("ont")}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                    title="Add ONT"
                  >
                    <HiCpuChip className="w-4 h-4 text-orange-500" />
                    <span className="hidden sm:inline">ONT</span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Capacity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Serial Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredNodes.map((node) => (
                    <tr key={node.nodeId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{node.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className="px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: nodeIcons[node.type as keyof typeof nodeIcons]?.color || "#6b7280" }}
                        >
                          {node.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{node.capacity} ports</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">{node.serialNumber || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <Button onClick={() => onEditNode(node)} className="text-blue-600 hover:text-blue-800">Edit</Button>
                          <Button onClick={() => deleteNode(node.nodeId)} className="text-red-600 hover:text-red-800">Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <SettingsTab
            settings={settings}
            nodes={nodes}
            edges={edges}
            onSave={async (data) => {
              const res = await fetch("/api/map/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              if (res.ok) {
                showToast("success", "Settings saved");
                fetchData();
              }
            }}
            onExport={() => {
              const data = {
                nodes: nodes.map(n => ({
                  node_id: n.nodeId,
                  type: n.type,
                  name: n.name,
                  latitude: n.latitude,
                  longitude: n.longitude,
                  capacity: n.capacity,
                  splitter: n.splitter,
                  pppoe: n.pppoe,
                  serialnumber: n.serialNumber,
                  notes: n.notes || "",
                })),
                edges: edges.map(e => ({
                  edge_id: e.edgeId,
                  source: e.source,
                  target: e.target,
                  fiber_type: e.fiberType,
                  distance: e.distance,
                  waypoints: e.waypoints ? JSON.parse(e.waypoints) : [],
                  notes: e.notes || "",
                })),
                settings,
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `map-export-${new Date().toISOString().split("T")[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
              showToast("success", "Map exported");
            }}
            onReset={async (password) => {
              const res = await fetch("/api/map/reset", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
              if (res.ok) {
                showToast("success", "All map data deleted");
                fetchData();
              } else {
                const error = await res.json();
                showToast("error", error.error || "Gagal mereset");
              }
            }}
          />
        )}
      </div>

      {/* Node Form Modal */}
      <NodeFormModal
        isOpen={showNodeForm}
        nodeType={nodeFormType}
        data={nodeFormData}
        isEditing={!!editingNode}
        allowManualCoordinates={isManualAdd}
        onClose={() => {
          setShowNodeForm(false);
          setNodeFormData({});
          setEditingNode(null);
          setIsManualAdd(false);
          handleServerPositionCancel();
          handleOdcPositionCancel();
          handleOdpPositionCancel();
          handleOntPositionCancel();
        }}
        onChange={setNodeFormData}
        onSave={saveNode}
      />

      {/* Fiber Form Modal */}
      <FiberFormModal
        isOpen={showFiberForm}
        data={fiberFormData}
        nodes={nodes}
        onClose={() => {
          setShowFiberForm(false);
          setFiberFormData(null);
          handleFiberLineCancel();
        }}
        onSave={handleFiberLineComplete}
        onFiberTypeChange={(type) => setFiberFormData(prev => prev ? { ...prev, fiberType: type } : null)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        title="Confirm Deletion"
        size="md"
      >
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4 text-amber-600">
            <HiExclamationTriangle className="w-8 h-8" />
            <p className="font-medium text-gray-900 dark:text-white">
              Are you sure you want to delete this {deleteConfirmation?.type === 'node' ? 'Node' : 'Fiber Line'}?
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            This action cannot be undone.
            {deleteConfirmation?.type === 'node' && " All connected fiber lines will also be deleted."}
          </p>
          <ModalFooter>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button variant="destructive"
                onClick={handleConfirmDelete}

              >
                Delete
              </Button>
            </div>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// SUB COMPONENTS
// ============================================

function StatCard({ label, value, description, color }: { label: string; value: number; description: string; color: string }) {
  return (
    <div className="flex-1 flex items-center gap-3">
      <div className="w-1 h-12 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
    </div>
  );
}

function NodeFormModal({
  isOpen,
  nodeType,
  data,
  isEditing,
  allowManualCoordinates = false,
  onClose,
  onChange,
  onSave
}: {
  isOpen: boolean;
  nodeType: string;
  data: Partial<MappingNode>;
  isEditing: boolean;
  allowManualCoordinates?: boolean;
  onClose: () => void;
  onChange: (data: Partial<MappingNode>) => void;
  onSave: () => void;
}) {
  const [ontIdentifierType, setOntIdentifierType] = useState<"pppoe" | "serial">("pppoe");

  if (!isOpen) return null;

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";
  const inputReadonlyClass = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  // Get node type display name
  const getTypeLabel = () => {
    switch (nodeType) {
      case "server":
      case "olt":
        return "Server";
      case "odc":
        return "ODC";
      case "odp":
        return "ODP";
      case "ont":
        return "ONT";
      default:
        return nodeType.toUpperCase();
    }
  };

  // Splitter options for ODC (more options)
  const odcSplitterOptions = ["1:2", "1:4", "1:8", "1:16", "1:32", "1:64"];
  // Splitter options for ODP (fewer options)
  const odpSplitterOptions = ["1:2", "1:4", "1:8", "1:16", "1:32"];

  const coreColorOptions = FIBER_CORE_COLORS.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  const isServerOrOlt = nodeType === "server" || nodeType === "olt";
  const isOdc = nodeType === "odc";
  const isOdp = nodeType === "odp";
  const isOnt = nodeType === "ont";
  const isPole = nodeType === "pole";
  const isJoinbox = nodeType === "joinbox";

  const handlePhotoUpdate = (urls: string[]) => {
    // Filter out any potential non-string values and handle empty strings
    const validUrls = urls.filter((url) => url && typeof url === "string" && url.trim() !== "");
    const photo = validUrls.length > 0 ? validUrls[0] : null;
    console.log("Updating photo:", photo);
    onChange({ ...data, photo });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Edit ${getTypeLabel()}` : `Add New ${getTypeLabel()}`} size="lg">
      <div className="space-y-4">
        {/* Server/OLT Form */}
        {isServerOrOlt && (
          <>
            <div>
              <label className={labelClass}>Server Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., OLT-JAKARTA-01"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.latitude || "") : (data.latitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, latitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.longitude || "") : (data.longitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, longitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes..."
                className={inputClass}
              />
            </div>
            {!allowManualCoordinates && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-300">The coordinates are automatically set from the marker position on the map.</p>
              </div>
            )}

            <div className="mt-4">
              <ImageUpload
                label="Foto Server/OLT"
                value={data.photo && typeof data.photo === "string" ? [data.photo] : []}
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="server-photos"
              />
            </div>
          </>
        )}

        {/* ODC Form */}
        {isOdc && (
          <>
            <div>
              <label className={labelClass}>ODC Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., ODC-JAKARTA-01"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Splitter Type *</label>
              <select
                value={data.splitter || "1:8"}
                onChange={(e) => onChange({ ...data, splitter: e.target.value })}
                className={inputClass}
              >
                {odcSplitterOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.latitude || "") : (data.latitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, latitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.longitude || "") : (data.longitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, longitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes..."
                className={inputClass}
              />
            </div>
            {!allowManualCoordinates && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-300">The coordinates are automatically set from the marker position on the map.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className={labelClass}>Input Redaman (dBm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.attenuationIn || ""}
                  onChange={(e) => onChange({ ...data, attenuationIn: parseFloat(e.target.value) })}
                  placeholder="e.g. -18.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Output Redaman (dBm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.attenuationOut || ""}
                  onChange={(e) => onChange({ ...data, attenuationOut: parseFloat(e.target.value) })}
                  placeholder="e.g. -19.2"
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Warna Core Input</label>
                <Select
                  options={coreColorOptions}
                  value={data.inputCoreColor || ""}
                  onChange={(val) => onChange({ ...data, inputCoreColor: val })}
                  placeholder="Pilih Warna Core"
                />
              </div>
            </div>

            <div className="mt-4">
              <ImageUpload
                label="Foto ODC"
                value={data.photo && typeof data.photo === "string" ? [data.photo] : []}
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="odc-photos"
              />
            </div>
          </>
        )}

        {/* ODP Form */}
        {isOdp && (
          <>
            <div>
              <label className={labelClass}>ODP Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., ODP-JAKARTA-01"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Splitter Type *</label>
              <select
                value={data.splitter || "1:8"}
                onChange={(e) => onChange({ ...data, splitter: e.target.value })}
                className={inputClass}
              >
                {odpSplitterOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.latitude || "") : (data.latitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, latitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.longitude || "") : (data.longitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, longitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes..."
                className={inputClass}
              />
            </div>
            {!allowManualCoordinates && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-300">The coordinates are automatically set from the marker position on the map.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className={labelClass}>Input Redaman (dBm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.attenuationIn || ""}
                  onChange={(e) => onChange({ ...data, attenuationIn: parseFloat(e.target.value) })}
                  placeholder="e.g. -18.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Output Redaman (dBm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.attenuationOut || ""}
                  onChange={(e) => onChange({ ...data, attenuationOut: parseFloat(e.target.value) })}
                  placeholder="e.g. -19.2"
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Warna Core Input</label>
                <Select
                  options={coreColorOptions}
                  value={data.inputCoreColor || ""}
                  onChange={(val) => onChange({ ...data, inputCoreColor: val })}
                  placeholder="Pilih Warna Core"
                />
              </div>
            </div>

            <div className="mt-4">
              <ImageUpload
                label="Foto ODP"
                value={data.photo && typeof data.photo === "string" ? [data.photo] : []}
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="odp-photos"
              />
            </div>
          </>
        )}

        {/* ONT Form */}
        {isOnt && (
          <>
            <div>
              <label className={labelClass}>Identifier Type</label>
              <div className="flex gap-2">
                <Button type="button"
                  onClick={() => setOntIdentifierType("pppoe")}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${ontIdentifierType === "pppoe"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                >
                  PPPoE
                </Button>
                <Button type="button"
                  onClick={() => setOntIdentifierType("serial")}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${ontIdentifierType === "serial"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                >
                  Serial Number
                </Button>
              </div>
            </div>
            {ontIdentifierType === "pppoe" ? (
              <div>
                <label className={labelClass}>PPPoE Name *</label>
                <input
                  type="text"
                  value={data.pppoe || ""}
                  onChange={(e) => onChange({ ...data, pppoe: e.target.value, name: e.target.value })}
                  placeholder="Search PPPoE..."
                  className={inputClass}
                />
              </div>
            ) : (
              <div>
                <label className={labelClass}>Serial Number *</label>
                <input
                  type="text"
                  value={data.serialNumber || ""}
                  onChange={(e) => onChange({ ...data, serialNumber: e.target.value, name: e.target.value })}
                  placeholder="Enter Serial Number..."
                  className={inputClass}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.latitude || "") : (data.latitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, latitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.longitude || "") : (data.longitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, longitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes (optional)"
                className={inputClass}
              />
            </div>

            <div className="mt-4">
              <ImageUpload
                label="Foto ONT"
                value={data.photo && typeof data.photo === "string" ? [data.photo] : []}
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="ont-photos"
              />
            </div>
          </>
        )}

        {/* Pole Form */}
        {isPole && (
          <>
            <div>
              <label className={labelClass}>Pole Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., POLE-001"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Pole Size</label>
                <select
                  value={data.metadata?.poleSize || "7m"}
                  onChange={(e) => onChange({
                    ...data,
                    metadata: { ...(data.metadata as NodeMetadata || {}), poleSize: e.target.value }
                  })}
                  className={inputClass}
                >
                  <option value="6m">6m</option>
                  <option value="7m">7m</option>
                  <option value="9m">9m</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Cable Slack</label>
                <div className="flex items-center h-[42px]">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.metadata?.hasSlack || false}
                      onChange={(e) => onChange({
                        ...data,
                        metadata: { ...(data.metadata as NodeMetadata || {}), hasSlack: e.target.checked }
                      })}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Ada Slack</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.latitude || "") : (data.latitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, latitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.longitude || "") : (data.longitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, longitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes (optional)"
                className={inputClass}
              />
            </div>

            <div className="mt-4">
              <ImageUpload
                label="Foto Pole"
                value={data.photo && typeof data.photo === "string" ? [data.photo] : []}
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="pole-photos"
              />
            </div>
          </>
        )}

        {/* Joinbox Form */}
        {isJoinbox && (
          <>
            <div>
              <label className={labelClass}>Joinbox Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., JB-001"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Capacity (Cores)</label>
                <select
                  value={data.capacity || 24}
                  onChange={(e) => onChange({ ...data, capacity: parseInt(e.target.value) })}
                  className={inputClass}
                >
                  <option value={2}>2 Core</option>
                  <option value={4}>4 Core</option>
                  <option value={6}>6 Core</option>
                  <option value={12}>12 Core</option>
                  <option value={24}>24 Core</option>
                  <option value={48}>48 Core</option>
                  <option value={96}>96 Core</option>
                  <option value={144}>144 Core</option>
                  <option value={288}>288 Core</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Closure Type</label>
                <select
                  value={data.metadata?.closureType || "dome"}
                  onChange={(e) => onChange({
                    ...data,
                    metadata: { ...(data.metadata as NodeMetadata || {}), closureType: e.target.value }
                  })}
                  className={inputClass}
                >
                  <option value="dome">Dome (Vertical)</option>
                  <option value="inline">Inline (Horizontal)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.latitude || "") : (data.latitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, latitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={allowManualCoordinates ? (data.longitude || "") : (data.longitude?.toFixed(6) || "")}
                  readOnly={!allowManualCoordinates}
                  onChange={allowManualCoordinates ? (e) => onChange({ ...data, longitude: parseFloat(e.target.value) }) : undefined}
                  className={allowManualCoordinates ? inputClass : inputReadonlyClass}
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes (optional)"
                className={inputClass}
              />
            </div>

            <div className="mt-4">
              <ImageUpload
                label="Foto Joinbox"
                value={data.photo && typeof data.photo === "string" ? [data.photo] : []}
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="joinbox-photos"
              />
            </div>
          </>
        )}
      </div>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} >Cancel</Button>
        <Button onClick={onSave} >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {isEditing ? "Save Changes" : isOnt ? "Save ONT" : isPole ? "Save Pole" : isJoinbox ? "Save Joinbox" : "Add Node"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function FiberFormModal({
  isOpen,
  data,
  nodes,
  onClose,
  onSave,
  onFiberTypeChange
}: {
  isOpen: boolean;
  data: { source: string; target: string; fiberType: string; waypoints: [number, number][] } | null;
  nodes: MappingNode[];
  onClose: () => void;
  onSave: (data: { name: string; fiberType: string; notes: string }) => void;
  onFiberTypeChange: (type: string) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    fiberType: "distribution",
    notes: "",
  });

  const sourceNode = nodes.find(n => n?.nodeId === data?.source);
  const targetNode = nodes.find(n => n?.nodeId === data?.target);

  // Calculate distance for display
  const distance = data && sourceNode && targetNode ? calculateDistance(
    sourceNode.latitude!,
    sourceNode.longitude!,
    targetNode.latitude!,
    targetNode.longitude!,
    data.waypoints
  ) : 0;

  // Derived state for props change
  const [prevData, setPrevData] = useState(data);

  if (data !== prevData) {
    setPrevData(data);
    if (data && sourceNode && targetNode) {
      setFormData({
        name: `${sourceNode.name} → ${targetNode.name}`,
        fiberType: data.fiberType || "distribution",
        notes: "",
      });
    }
  }

  if (!isOpen || !data) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const getFiberColorInfo = (type: string) => {
    switch (type) {
      case "feeder": return { color: "text-purple-500", label: "Purple line - Feeder network" };
      case "distribution": return { color: "text-blue-500", label: "Blue line - Distribution network" };
      case "drop": return { color: "text-green-500", label: "Green line - Drop network" };
      default: return { color: "text-gray-500", label: "Gray line - Standard connection" };
    }
  };

  const fiberInfo = getFiberColorInfo(formData.fiberType);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Fiber Line" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Summary Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex items-center gap-4">
          <div className="p-2 bg-white dark:bg-blue-800 rounded-lg shadow-sm">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100">
              <span>{sourceNode?.name}</span>
              <span>→</span>
              <span>{targetNode?.name}</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Distance: {distance} m
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Label / Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Label / Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
              placeholder="Enter fiber line name"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Auto-generated from source and target nodes
            </p>
          </div>

          {/* Fiber Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fiber Type <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Select
                options={[
                  { value: "distribution", label: "Distribution (ODC to ODP)" },
                  { value: "feeder", label: "Feeder (Backbone)" },
                  { value: "drop", label: "Drop Cable" },
                  { value: "odc_to_odc", label: "ODC to ODC" },
                  { value: "odp_to_odp", label: "ODP to ODP" },
                ]}
                value={formData.fiberType}
                onChange={(val) => {
                  setFormData({ ...formData, fiberType: val });
                  onFiberTypeChange(val);
                }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className={`w-3 h-3 rounded-full ${fiberInfo.color.replace('text-', 'bg-')}`}></div>
              {fiberInfo.label}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <ModalFooter>
          <Button variant="outline"
            type="button"
            onClick={onClose}

          >
            Cancel
          </Button>
          <Button type="submit"

          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Fiber Line
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function SettingsTab({
  settings,
  nodes,
  edges,
  onSave,
  onExport,
  onReset
}: {
  settings: MapSettings | null;
  nodes: MappingNode[];
  edges: MappingEdge[];
  onSave: (data: Partial<MapSettings>) => void;
  onExport: () => void;
  onReset: (password: string) => void;
}) {
  const [formData, setFormData] = useState({
    centerLat: settings?.centerLat || "-6.2088",
    centerLng: settings?.centerLng || "106.8456",
    maxZoomIn: settings?.maxZoomIn || "22",
    maxZoomOut: settings?.maxZoomOut || "5",
    defaultZoom: settings?.defaultZoom || "13",
  });

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");

  const [prevSettings, setPrevSettings] = useState(settings);

  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setFormData({
      centerLat: settings?.centerLat || "-6.2088",
      centerLng: settings?.centerLng || "106.8456",
      maxZoomIn: settings?.maxZoomIn || "22",
      maxZoomOut: settings?.maxZoomOut || "5",
      defaultZoom: settings?.defaultZoom || "13",
    });
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";

  return (
    <div className="flex-1 p-6 overflow-auto space-y-6">
      {/* Center Coordinates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Center Coordinates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Latitude</label>
            <input type="text" value={formData.centerLat} onChange={(e) => setFormData({ ...formData, centerLat: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Longitude</label>
            <input type="text" value={formData.centerLng} onChange={(e) => setFormData({ ...formData, centerLng: e.target.value })} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Zoom Levels */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Zoom Levels</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Max Zoom In</label>
            <input type="number" value={formData.maxZoomIn} onChange={(e) => setFormData({ ...formData, maxZoomIn: e.target.value })} min={1} max={22} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Max Zoom Out</label>
            <input type="number" value={formData.maxZoomOut} onChange={(e) => setFormData({ ...formData, maxZoomOut: e.target.value })} min={1} max={22} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Default Zoom</label>
            <input type="number" value={formData.defaultZoom} onChange={(e) => setFormData({ ...formData, defaultZoom: e.target.value })} min={1} max={22} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Button onClick={() => onSave(formData)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Save Settings
      </Button>

      {/* Map Data Management */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Map Data Management</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="success" onClick={onExport} >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Map
          </Button>
          <Button onClick={() => setShowResetModal(true)} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Reset Map Data
          </Button>
        </div>
        <div className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium mb-1">Information</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Coordinate format: Latitude (-90 to 90), Longitude (-180 to 180)</li>
              <li>Zoom levels range from 1 (world view) to 22 (street level)</li>
              <li>Export preserves all nodes, edges, and settings</li>
              <li>Reset will delete all map data (requires password)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Reset Map Data</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">This will delete ALL nodes ({nodes.length}) and edges ({edges.length}). Enter your password to confirm.</p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Enter password"
              className={`${inputClass} mb-4`}
            />
            <div className="flex gap-2">
              <Button onClick={() => { setShowResetModal(false); setResetPassword(""); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</Button>
              <Button onClick={() => { onReset(resetPassword); setShowResetModal(false); setResetPassword(""); }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete All</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
