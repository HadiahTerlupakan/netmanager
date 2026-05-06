/**
 * Constants untuk Map configuration
 */
export const MAP_CONSTANTS = {
  ICON_SIZE: {
    DEFAULT: 30,
    SELECTED: 36,
    TEMP: 36,
  },
  BORDER: {
    DEFAULT: "2px solid white",
    SELECTED: "3px solid #facc15",
    TEMP: "3px dashed white",
  },
  ZOOM: {
    DEFAULT: 13,
    MAX: 22,
    MIN: 5,
  },
  ANIMATION: {
    PULSE_DURATION: "1.5s",
  },
} as const;

/**
 * Node tool configuration
 */
export const NODE_TOOL_CONFIG = {
  server: {
    formType: "olt",
    capacity: 16,
    addMessage: "Click on map to place Server/OLT",
    editMessage: "Drag marker to new position, then click Save",
  },
  odc: {
    formType: "odc",
    capacity: 8,
    addMessage: "Click on map to place ODC",
    editMessage: "Drag marker to new position, then click Save",
  },
  odp: {
    formType: "odp",
    capacity: 8,
    addMessage: "Click on map to place ODP",
    editMessage: "Drag marker to new position, then click Save",
  },
  ont: {
    formType: "ont",
    capacity: 1,
    addMessage: "Click on map to place ONT",
    editMessage: "Drag marker to new position, then click Save",
  },
  pole: {
    formType: "pole",
    capacity: 0,
    addMessage: "Click on map to place Pole",
    editMessage: "Drag marker to new position, then click Save",
  },
  joinbox: {
    formType: "joinbox",
    capacity: 24,
    addMessage: "Click on map to place Joinbox",
    editMessage: "Drag marker to new position, then click Save",
  },
} as const;

/**
 * Map API endpoints
 */
export const MAP_API = {
  NODES: "/api/map/nodes",
  EDGES: "/api/map/edges",
  SETTINGS: "/api/map/settings",
  STATISTICS: "/api/map/statistics",
  RESET: "/api/map/reset",
} as const;

/**
 * Fiber line mode messages
 */
export const FIBER_MODE_MESSAGES = {
  START: "Click on source node to start drawing fiber line",
  SOURCE_SELECTED: (nodeName: string) =>
    `Source: ${nodeName}. Click on map to add waypoints, then click target node.`,
  DRAWING: (nodeName: string, waypointCount: number) =>
    `From: ${nodeName}. Click map for waypoints, click target node to finish. (${waypointCount} waypoints)`,
} as const;
