"use client";

import React from "react";
import {
  HiChevronLeft,
  HiChevronRight,
  HiMagnifyingGlass,
  HiServer,
  HiCube,
  HiSquare3Stack3D,
  HiCpuChip,
  HiLink,
} from "react-icons/hi2";
import { Button } from '@/components/ui/Button'
import type { MappingNode, MappingEdge } from "@prisma/client";

interface MapSidebarProps {
  open: boolean;
  onToggle: () => void;
  nodes: MappingNode[];
  edges: MappingEdge[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNodeSelect: (node: MappingNode) => void;
  onEdgeSelect: (edge: MappingEdge) => void;
}

const getNodeIcon = (type: string) => {
  switch (type) {
    case "olt":
    case "server":
      return <HiServer className="h-4 w-4 text-red-500" />;
    case "odc":
      return <HiCube className="h-4 w-4 text-orange-500" />;
    case "odp":
      return <HiSquare3Stack3D className="h-4 w-4 text-blue-500" />;
    case "ont":
      return <HiCpuChip className="h-4 w-4 text-green-500" />;
    default:
      return <HiSquare3Stack3D className="h-4 w-4 text-gray-500" />;
  }
};

export function MapSidebar({
  open,
  onToggle,
  nodes,
  edges,
  searchQuery,
  onSearchChange,
  onNodeSelect,
  onEdgeSelect,
}: MapSidebarProps) {
  // Group nodes by type
  const groupedNodes = nodes.reduce((acc, node) => {
    const type = node.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(node);
    return acc;
  }, {} as Record<string, MappingNode[]>);

  const typeLabels: Record<string, string> = {
    olt: "OLT / Server",
    server: "OLT / Server",
    odc: "ODC (Cabinet)",
    odp: "ODP (Distribution Point)",
    ont: "ONT (Terminal)",
  };

  return (
    <>
      {/* Toggle Button */}
      <Button variant="outline"
         className={`absolute top-4 ${open ? "left-[316px]" : "left-4"} z-[1001] border border-gray-200 duration-300`}
        onClick={onToggle}
      >
        {open ? <HiChevronLeft className="h-4 w-4" /> : <HiChevronRight className="h-4 w-4" />}
      </Button>

      {/* Sidebar Panel */}
      <div
        className={`${
          open ? "w-[300px]" : "w-0"
        } bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 overflow-hidden z-[1000] flex flex-col`}
      >
        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari node..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Node List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {Object.entries(groupedNodes).map(([type, typeNodes]) => (
              <div key={type}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {typeLabels[type] || type} ({typeNodes.length})
                </h3>
                <div className="space-y-1">
                  {typeNodes.map((node) => (
                    <Button key={node.nodeId}
                      onClick={() => onNodeSelect(node)}
                      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
                    >
                      {getNodeIcon(node.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{node.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {node.capacity} port • {node.serialNumber || "No S/N"}
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ))}

            {/* Edges Section */}
            {edges.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Koneksi Fiber ({edges.length})
                </h3>
                <div className="space-y-1">
                  {edges.slice(0, 20).map((edge) => {
                    const sourceNode = nodes.find((n) => n.nodeId === edge.source);
                    const targetNode = nodes.find((n) => n.nodeId === edge.target);
                    return (
                      <Button key={edge.edgeId}
                        onClick={() => onEdgeSelect(edge)}
                        className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
                      >
                        <HiLink className="h-4 w-4 text-purple-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                            {sourceNode?.name || edge.source} → {targetNode?.name || edge.target}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {edge.fiberType} {edge.distance ? `• ${edge.distance}m` : ""}
                          </p>
                        </div>
                      </Button>
                    );
                  })}
                  {edges.length > 20 && (
                    <p className="text-xs text-gray-400 text-center py-2">
                      + {edges.length - 20} koneksi lainnya
                    </p>
                  )}
                </div>
              </div>
            )}

            {nodes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <HiSquare3Stack3D className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Belum ada node</p>
                <p className="text-xs">Gunakan toolbar untuk menambahkan</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
