"use client";

import { Button } from "@/components/ui/Button";
import type { MappingNode } from "@/components/map/map-types";
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
} from "react-icons/hi2";

type ActiveTab = "map" | "list" | "settings";
type NodeActionMode = "idle" | "adding" | "editing";
type FiberLineMode = "idle" | "drawing";
type ToolbarTool =
  | "server"
  | "odc"
  | "odp"
  | "ont"
  | "pole"
  | "joinbox"
  | "fiber";

interface MapSiteOption {
  id: string;
  name: string;
  code?: string;
}

interface MapToolbarProps {
  activeTab: ActiveTab;
  showSearchDropdown: boolean;
  searchQuery: string;
  filteredNodes: MappingNode[];
  serverActionMode: NodeActionMode;
  odcActionMode: NodeActionMode;
  odpActionMode: NodeActionMode;
  ontActionMode: NodeActionMode;
  poleActionMode: NodeActionMode;
  joinboxActionMode: NodeActionMode;
  fiberLineMode: FiberLineMode;
  isAnyModeActive: boolean;
  activeModeMessage: string;
  hasPendingTempPosition: boolean;
  sites: MapSiteOption[];
  siteIdFilter: string;
  onSiteFilterChange: (siteId: string) => void;
  onTabChange: (tab: ActiveTab) => void;
  onToggleSearchDropdown: () => void;
  onSearchQueryChange: (value: string) => void;
  onSelectSearchResult: (node: MappingNode) => void;
  onToolbarClick: (tool: ToolbarTool) => void;
  onSaveActiveTempPosition: () => void;
  onCancelActiveMode: () => void;
  getNodeColor: (type: string) => string;
}

export function MapToolbar({
  activeTab,
  showSearchDropdown,
  searchQuery,
  filteredNodes,
  serverActionMode,
  odcActionMode,
  odpActionMode,
  ontActionMode,
  poleActionMode,
  joinboxActionMode,
  fiberLineMode,
  isAnyModeActive,
  activeModeMessage,
  hasPendingTempPosition,
  sites,
  siteIdFilter,
  onSiteFilterChange,
  onTabChange,
  onToggleSearchDropdown,
  onSearchQueryChange,
  onSelectSearchResult,
  onToolbarClick,
  onSaveActiveTempPosition,
  onCancelActiveMode,
  getNodeColor,
}: MapToolbarProps) {
  return (
    <>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 relative z-10 overflow-visible">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden md:block">
              Topology Map
            </h1>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <Button
                variant="ghost"
                onClick={() => onTabChange("map")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === "map"
                    ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <HiMap className="w-4 h-4" />
                Map
              </Button>
              <Button
                variant="ghost"
                onClick={() => onTabChange("list")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === "list"
                    ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <HiListBullet className="w-4 h-4" />
                List
              </Button>
              <Button
                variant="ghost"
                onClick={() => onTabChange("settings")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === "settings"
                    ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <HiCog6Tooth className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={siteIdFilter}
              onChange={(e) => onSiteFilterChange(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white max-w-[160px]"
              title="Filter site"
            >
              <option value="">Semua Site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <div className="relative z-20">
              <Button
                variant={showSearchDropdown ? "default" : "outline"}
                onClick={onToggleSearchDropdown}
              >
                <HiMagnifyingGlass className="w-4 h-4" />
                Search
              </Button>
              {showSearchDropdown && (
                <div
                  className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                  style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
                >
                  <div className="p-3">
                    <input
                      type="text"
                      placeholder="Search nodes..."
                      value={searchQuery}
                      onChange={(e) => onSearchQueryChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                  {searchQuery && (
                    <div className="max-h-64 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
                      {filteredNodes.slice(0, 10).map((node) => (
                        <Button
                          key={node.nodeId}
                          variant="ghost"
                          onClick={() => onSelectSearchResult(node)}
                          className="w-full justify-start rounded-none"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getNodeColor(node.type) }}
                          />
                          <span className="text-gray-900 dark:text-white flex-1">
                            {node.name}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {node.type.toUpperCase()}
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

            <Button
              variant={serverActionMode !== "idle" ? "default" : "outline"}
              onClick={() => onToolbarClick("server")}
            >
              <HiServer className="w-4 h-4" />
              Server
            </Button>
            <Button
              variant={odcActionMode !== "idle" ? "default" : "outline"}
              onClick={() => onToolbarClick("odc")}
            >
              <HiCube className="w-4 h-4" />
              ODC
            </Button>
            <Button
              variant={odpActionMode !== "idle" ? "default" : "outline"}
              onClick={() => onToolbarClick("odp")}
            >
              <HiSquare3Stack3D className="w-4 h-4" />
              ODP
            </Button>
            <Button
              variant={ontActionMode !== "idle" ? "default" : "outline"}
              onClick={() => onToolbarClick("ont")}
            >
              <HiCpuChip className="w-4 h-4" />
              ONT
            </Button>
            <Button
              variant={poleActionMode !== "idle" ? "default" : "outline"}
              onClick={() => onToolbarClick("pole")}
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
                  d="M12 3v18M8 6h8M8 10h8M8 14h8"
                />
              </svg>
              Pole
            </Button>
            <Button
              variant={joinboxActionMode !== "idle" ? "default" : "outline"}
              onClick={() => onToolbarClick("joinbox")}
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              Joinbox
            </Button>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

            <Button
              variant={fiberLineMode !== "idle" ? "default" : "outline"}
              onClick={() => onToolbarClick("fiber")}
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Fiber Line
            </Button>
          </div>
        </div>
      </div>

      {isAnyModeActive && (
        <div className="bg-blue-500 dark:bg-blue-400 text-white px-4 py-2 flex items-center justify-between">
          <span className="text-sm">{activeModeMessage}</span>
          <div className="flex items-center gap-2">
            {hasPendingTempPosition && (
              <Button
                variant="success"
                size="sm"
                onClick={onSaveActiveTempPosition}
              >
                Save
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onCancelActiveMode}
              className="text-white hover:bg-white/20 hover:text-white dark:text-white dark:hover:bg-white/20 dark:hover:text-white"
            >
              <HiXMark className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
