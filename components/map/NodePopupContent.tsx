"use client";

import Image from "next/image";

import type { MappingNode } from "@/components/map/map-types";
import { Button } from "@/components/ui/Button";

const NODE_BADGES: Record<string, { label: string; color: string }> = {
  server: { label: "Server/OLT", color: "bg-purple-500" },
  olt: { label: "Server/OLT", color: "bg-purple-500" },
  odc: { label: "ODC Cabinet", color: "bg-blue-500" },
  odp: { label: "ODP Box", color: "bg-cyan-500" },
  ont: { label: "ONT Device", color: "bg-orange-500" },
  pole: { label: "Pole / Tiang", color: "bg-gray-600" },
  joinbox: { label: "Joinbox / Closure", color: "bg-amber-600" },
};

const NODE_COLORS: Record<string, string> = {
  server: "#9333ea",
  olt: "#9333ea",
  odc: "#2563eb",
  odp: "#06b6d4",
  ont: "#ea580c",
  pole: "#6b7280",
  joinbox: "#d97706",
};

interface NodePopupContentProps {
  node: MappingNode;
  connectedFromNodes: MappingNode[];
  connectedToNodes: MappingNode[];
  usedSlots: number;
  capacity: number;
  onCopyInfo: () => void;
  onEditNode: (node: MappingNode) => void;
  onEditNodeLocation: (node: MappingNode) => void;
  onDeleteNode: (nodeId: string) => void;
}

function getNodeBadge(type: string) {
  return (
    NODE_BADGES[type] || { label: type.toUpperCase(), color: "bg-gray-500" }
  );
}

function isServerOrOlt(type: string) {
  return type === "server" || type === "olt";
}

export function NodePopupContent({
  node,
  connectedFromNodes,
  connectedToNodes,
  usedSlots,
  capacity,
  onCopyInfo,
  onEditNode,
  onEditNodeLocation,
  onDeleteNode,
}: NodePopupContentProps) {
  const badge = getNodeBadge(node.type);
  const showSlotUsage = node.type === "odc" || node.type === "odp";
  const showOpticalInfo = node.type === "odc" || node.type === "odp";
  const showConnectedTo =
    connectedToNodes.length > 0 &&
    (isServerOrOlt(node.type) || node.type === "odc");
  const availableSlots = Math.max(0, capacity - usedSlots);
  const usagePercent = (usedSlots / capacity) * 100;

  return (
    <div className="min-w-[240px] max-w-[280px]">
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

      <div className="mb-2">
        <span
          className={`inline-block px-2 py-1 text-xs font-medium text-white rounded ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>

      <h3 className="font-bold text-lg text-gray-900 mb-1">{node.name}</h3>

      <div className="flex items-center gap-1 text-sm text-blue-600 mb-2">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span>
          {node.latitude?.toFixed(6)}, {node.longitude?.toFixed(6)}
        </span>
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={onCopyInfo}
        className="mb-3"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Copy Info
      </Button>

      {showSlotUsage && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700">
              Slot Usage
            </span>
            <span className="text-sm font-medium text-gray-900">
              {usedSlots}/{capacity}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full ${usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-yellow-500" : "bg-green-500"}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Available:</span>
            <span className="font-medium text-green-600">
              {availableSlots} ports
            </span>
          </div>
        </div>
      )}

      {showOpticalInfo && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <p className="text-sm font-medium text-gray-700 mb-1">Optical Info</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500 block">Input Redaman:</span>
              <span className="font-medium text-gray-900">
                {node.attenuationIn !== null && node.attenuationIn !== undefined
                  ? `${node.attenuationIn} dBm`
                  : "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Output Redaman:</span>
              <span className="font-medium text-gray-900">
                {node.attenuationOut !== null &&
                node.attenuationOut !== undefined
                  ? `${node.attenuationOut} dBm`
                  : "-"}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 block">Warna Core Input:</span>
              <span className="font-medium text-gray-900">
                {node.inputCoreColor || "-"}
              </span>
            </div>
          </div>
        </div>
      )}

      {connectedFromNodes.length > 0 && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <p className="text-sm font-medium text-gray-700 mb-1">
            Connected from:
          </p>
          <div className="space-y-1">
            {connectedFromNodes.map((connectedNode) => (
              <div
                key={connectedNode.nodeId}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      NODE_COLORS[connectedNode.type] || "#6b7280",
                  }}
                />
                <span className="text-gray-600">{connectedNode.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showConnectedTo && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <p className="text-sm font-medium text-gray-700 mb-1">
            {isServerOrOlt(node.type)
              ? "Connected to ODCs:"
              : "Connected to ODPs:"}
          </p>
          <div className="space-y-1">
            {connectedToNodes.map((connectedNode) => (
              <div
                key={connectedNode.nodeId}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      NODE_COLORS[connectedNode.type] || "#6b7280",
                  }}
                />
                <span className="text-gray-600">{connectedNode.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 pt-3 space-y-2">
        <Button onClick={() => onEditNode(node)} className="w-full">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Edit {isServerOrOlt(node.type) ? "OLT" : node.type.toUpperCase()}
        </Button>

        <div className="flex gap-2">
          <Button
            variant="success"
            onClick={() => onEditNodeLocation(node)}
            className="flex-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Edit Location
          </Button>
          <Button
            variant="destructive"
            onClick={() => onDeleteNode(node.nodeId)}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
