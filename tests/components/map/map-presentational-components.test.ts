import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MappingNode } from "@/components/map/map-types";

const sampleNodes: MappingNode[] = [
  {
    nodeId: "node-1",
    type: "odc",
    name: "ODC Alpha",
    latitude: -6.2,
    longitude: 106.8,
    capacity: 8,
    splitter: null,
    pppoe: null,
    serialNumber: "SN-001",
    notes: null,
    attenuationIn: null,
    attenuationOut: null,
    inputCoreColor: null,
    photo: null,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as MappingNode,
  {
    nodeId: "node-2",
    type: "ont",
    name: "ONT Beta",
    latitude: -6.21,
    longitude: 106.81,
    capacity: 1,
    splitter: null,
    pppoe: null,
    serialNumber: "SN-002",
    notes: null,
    attenuationIn: null,
    attenuationOut: null,
    inputCoreColor: null,
    photo: null,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as MappingNode,
];

async function renderToolbar() {
  const { MapToolbar } = await import("@/components/map/MapToolbar");

  return renderToStaticMarkup(
    React.createElement(MapToolbar, {
      activeTab: "map",
      showSearchDropdown: true,
      searchQuery: "odc",
      filteredNodes: sampleNodes,
      serverActionMode: "idle",
      odcActionMode: "adding",
      odpActionMode: "idle",
      ontActionMode: "idle",
      poleActionMode: "idle",
      joinboxActionMode: "idle",
      fiberLineMode: "idle",
      isAnyModeActive: true,
      activeModeMessage: "Click on map to place ODC, then click Save",
      hasPendingTempPosition: true,
      sites: [{ id: "site-1", name: "Site A" }],
      siteIdFilter: "",
      onSiteFilterChange: vi.fn(),
      onTabChange: vi.fn(),
      onToggleSearchDropdown: vi.fn(),
      onSearchQueryChange: vi.fn(),
      onSelectSearchResult: vi.fn(),
      onToolbarClick: vi.fn(),
      onSaveActiveTempPosition: vi.fn(),
      onCancelActiveMode: vi.fn(),
      getNodeColor: (type: string) => (type === "odc" ? "#2563eb" : "#ea580c"),
    }),
  );
}

async function renderNodeListTab() {
  const { NodeListTab } = await import("@/components/map/NodeListTab");

  return renderToStaticMarkup(
    React.createElement(NodeListTab, {
      searchQuery: "alpha",
      filteredNodes: sampleNodes,
      onSearchQueryChange: vi.fn(),
      onManualAdd: vi.fn(),
      onEditNode: vi.fn(),
      onDeleteNode: vi.fn(),
      getNodeColor: (type: string) => (type === "odc" ? "#2563eb" : "#ea580c"),
    }),
  );
}

async function renderStatisticsBar() {
  const { MapStatisticsBar } =
    await import("@/components/map/MapStatisticsBar");

  return renderToStaticMarkup(
    React.createElement(MapStatisticsBar, {
      statistics: {
        totalNodes: 4,
        totalEdges: 3,
        nodesByType: {
          olt: 1,
          odc: 2,
          odp: 5,
          ont: 7,
        },
      },
    }),
  );
}

describe("map presentational components", () => {
  it("renders toolbar tabs, search, and active mode banner", async () => {
    await expect(renderToolbar()).resolves.toContain("Topology Map");
    await expect(renderToolbar()).resolves.toContain("Search");
    await expect(renderToolbar()).resolves.toContain("ODC Alpha");
    await expect(renderToolbar()).resolves.toContain(
      "Click on map to place ODC, then click Save",
    );
    await expect(renderToolbar()).resolves.toContain("Save");
  });

  it("renders node list rows and manual add actions", async () => {
    await expect(renderNodeListTab()).resolves.toContain("Node List");
    await expect(renderNodeListTab()).resolves.toContain("ODC Alpha");
    await expect(renderNodeListTab()).resolves.toContain("ONT Beta");
    await expect(renderNodeListTab()).resolves.toContain("Add Server/OLT");
    await expect(renderNodeListTab()).resolves.toContain("Delete");
  });

  it("renders statistics summary cards", async () => {
    await expect(renderStatisticsBar()).resolves.toContain("Servers/OLT");
    await expect(renderStatisticsBar()).resolves.toContain("ODC Cabinets");
    await expect(renderStatisticsBar()).resolves.toContain("Drop points");
    await expect(renderStatisticsBar()).resolves.toContain("7");
  });
});
