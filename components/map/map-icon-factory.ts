/**
 * Factory untuk create Leaflet map icons
 */

import L from "leaflet";
import {
  NODE_ICON_COLORS,
  NODE_ICON_SVG,
  type NodeType,
} from "./map-icon-config";
import { MAP_CONSTANTS } from "./map-constants";

/**
 * Create icon untuk node yang sudah ada di map
 */
export function createNodeIcon(type: string, isSelected = false): L.DivIcon {
  const nodeType = type as NodeType;
  const color = NODE_ICON_COLORS[nodeType] || NODE_ICON_COLORS.odp;
  const svg = NODE_ICON_SVG[nodeType] || NODE_ICON_SVG.odp;

  const size = isSelected
    ? MAP_CONSTANTS.ICON_SIZE.SELECTED
    : MAP_CONSTANTS.ICON_SIZE.DEFAULT;
  const border = isSelected
    ? MAP_CONSTANTS.BORDER.SELECTED
    : MAP_CONSTANTS.BORDER.DEFAULT;

  return L.divIcon({
    className: "custom-node-icon",
    html: `
      <div style="
        background-color: ${color};
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
          ${svg}
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -15],
  });
}

/**
 * Create icon untuk temporary marker (saat adding node)
 */
export function createTempMarkerIcon(type: string): L.DivIcon {
  const nodeType = type as NodeType;
  const color = NODE_ICON_COLORS[nodeType] || NODE_ICON_COLORS.odp;
  const svg = NODE_ICON_SVG[nodeType] || NODE_ICON_SVG.odp;

  const size = MAP_CONSTANTS.ICON_SIZE.TEMP;

  return L.divIcon({
    className: "temp-node-icon",
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: ${MAP_CONSTANTS.BORDER.TEMP};
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        cursor: move;
        animation: pulse ${MAP_CONSTANTS.ANIMATION.PULSE_DURATION} ease-in-out infinite;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          ${svg}
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Get node color by type
 */
export function getNodeColor(type: string): string {
  const nodeType = type as NodeType;
  return NODE_ICON_COLORS[nodeType] || NODE_ICON_COLORS.odp;
}
