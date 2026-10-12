/**
 * Node icon configuration dan SVG definitions
 */

export const NODE_ICON_COLORS = {
  server: "#9333ea", // Purple
  olt: "#9333ea",
  odc: "#2563eb", // Blue
  odp: "#06b6d4", // Cyan
  ont: "#ea580c", // Orange
  pole: "#6b7280", // Gray
  joinbox: "#d97706", // Amber
} as const;

/**
 * Jejak gambar tiap tipe titik — hanya atribut `d`-nya.
 *
 * Dipisahkan dari markup di `NODE_ICON_SVG` supaya ikon Google Maps bisa
 * merendernya sebagai JSX (`<path d={...} />`) tanpa `dangerouslySetInnerHTML`.
 * Selama Leaflet masih hidup, markup string-nya diturunkan dari daftar ini
 * juga, jadi hanya ada satu salinan jejak gambarnya.
 */
export const NODE_ICON_PATH = {
  server:
    "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
  olt: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
  odc: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  odp: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
  ont: "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",
  pole: "M12 3v18M8 6h8M8 10h8M8 14h8",
  joinbox: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
} as const;

/** Atribut goresan yang sama untuk semua ikon. */
const GORESAN_IKON =
  'stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"';

/**
 * Markup `<path>` untuk `L.divIcon`, diturunkan dari `NODE_ICON_PATH`.
 *
 * Hanya dipakai jalur Leaflet yang sedang dimigrasikan; ikon Google Maps
 * memakai `NODE_ICON_PATH` langsung sebagai JSX.
 */
export const NODE_ICON_SVG = Object.fromEntries(
  Object.entries(NODE_ICON_PATH).map(([tipe, d]) => [
    tipe,
    `<path d="${d}" ${GORESAN_IKON}/>`,
  ]),
) as Record<keyof typeof NODE_ICON_PATH, string>;

export type NodeType = keyof typeof NODE_ICON_COLORS;
