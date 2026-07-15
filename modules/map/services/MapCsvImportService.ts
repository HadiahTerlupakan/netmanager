import { randomUUID } from "crypto";

import type { CreateMapNodeInput } from "../types/MappingRepositoryTypes";
import type { TenantContext } from "../utils/tenantContext";
import type { IMappingRepository } from "../domain/ports/IMappingRepository";
import { isCanonicalNodeType, NODE_TYPE_DEFAULTS } from "../domain/nodeType";

/** Hasil import satu baris CSV. */
export interface CsvImportRowResult {
  rowIndex: number;
  nodeId: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  action: "created" | "updated";
  warnings: string[];
}

/** Ringkasan hasil import CSV. */
export interface CsvImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  results: CsvImportRowResult[];
  errors: Array<{ rowIndex: number; raw: string; error: string }>;
}

/** Baris CSV yang sudah di-parse mentah (string). */
export interface CsvRawRow {
  rowIndex: number;
  raw: Record<string, string>;
}

/** Konstanta parser CSV. */
const CSV_DELIMITER = ",";
const CSV_QUOTE = '"';
const CSV_NEWLINE = /\r\n|\r|\n/;
const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_VALID_LATITUDE = -90;
const MAX_VALID_LATITUDE = 90;
const MIN_VALID_LONGITUDE = -180;
const MAX_VALID_LONGITUDE = 180;

/** Prefix nama → tipe node canonical. */
const NODE_TYPE_PREFIXES: Array<{ prefix: string; type: string }> = [
  { prefix: "ODP", type: "odp" },
  { prefix: "ODC", type: "odc" },
  { prefix: "OLT", type: "olt" },
  { prefix: "ONT", type: "ont" },
  { prefix: "POLE", type: "pole" },
  { prefix: "JOINBOX", type: "joinbox" },
];

const DEFAULT_NODE_TYPE = "odp";

/** Deteksi tipe node dari nama (prefix). Default "odp" bila tidak cocok. */
export function detectNodeTypeFromName(name: string): string {
  const upper = name.trim().toUpperCase();
  for (const { prefix, type } of NODE_TYPE_PREFIXES) {
    if (upper.startsWith(prefix)) return type;
  }
  return DEFAULT_NODE_TYPE;
}

/** Deteksi & koreksi lat/lon tertukar. Lat harus [-90,90], lon [-180,180]. */
export function normalizeCoordinates(
  latRaw: number,
  lonRaw: number,
): { latitude: number; longitude: number; swapped: boolean } {
  const latOutOfRange =
    latRaw < MIN_VALID_LATITUDE || latRaw > MAX_VALID_LATITUDE;
  const lonOutOfRange =
    lonRaw < MIN_VALID_LONGITUDE || lonRaw > MAX_VALID_LONGITUDE;

  if (latOutOfRange || lonOutOfRange) {
    const swappedLat = lonRaw;
    const swappedLon = latRaw;
    const swappedLatValid =
      swappedLat >= MIN_VALID_LATITUDE && swappedLat <= MAX_VALID_LATITUDE;
    const swappedLonValid =
      swappedLon >= MIN_VALID_LONGITUDE && swappedLon <= MAX_VALID_LONGITUDE;
    if (swappedLatValid && swappedLonValid) {
      return { latitude: swappedLat, longitude: swappedLon, swapped: true };
    }
  }

  return { latitude: latRaw, longitude: lonRaw, swapped: false };
}

/** Parse CSV text → header + array baris (RFC4180 sederhana, dukung quote). */
export function parseCsv(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = text.split(CSV_NEWLINE).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

/** Parse satu baris CSV dengan dukung quote & escape ("" → "). */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === CSV_QUOTE) {
        if (line[i + 1] === CSV_QUOTE) {
          current += CSV_QUOTE;
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === CSV_QUOTE) {
      inQuotes = true;
    } else if (char === CSV_DELIMITER) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

/** Bangun notes dari area + owner + notes original. */
function buildNotes(row: Record<string, string>): string | null {
  const area = row.area?.trim() || "";
  const owner = row.owner?.trim() || "";
  const notes = row.notes?.trim() || "";

  const parts: string[] = [];
  if (area) parts.push(`Area: ${area}`);
  if (owner) parts.push(`Owner: ${owner}`);
  if (notes) parts.push(notes);

  return parts.length > 0 ? parts.join(" | ") : null;
}

/** Validasi & map raw row → CreateMapNodeInput. Return null jika skip. */
function mapRowToNodeInput(
  row: Record<string, string>,
  rowIndex: number,
): { input: CreateMapNodeInput; warnings: string[] } | { error: string } {
  const name = row.name?.trim() || "";
  if (!name) return { error: "Kolom name wajib diisi" };

  const latRaw = Number(row.latitude);
  const lonRaw = Number(row.longitude);
  if (!Number.isFinite(latRaw))
    return { error: `Latitude tidak valid: "${row.latitude}"` };
  if (!Number.isFinite(lonRaw))
    return { error: `Longitude tidak valid: "${row.longitude}"` };

  const warnings: string[] = [];
  const { latitude, longitude, swapped } = normalizeCoordinates(latRaw, lonRaw);
  if (swapped) warnings.push("Lat/lon tertukar, sudah dikoreksi otomatis");

  if (
    latitude < MIN_VALID_LATITUDE ||
    latitude > MAX_VALID_LATITUDE ||
    longitude < MIN_VALID_LONGITUDE ||
    longitude > MAX_VALID_LONGITUDE
  ) {
    return {
      error: `Koordinat di luar rentang valid: ${latitude}, ${longitude}`,
    };
  }

  const rawType = row.type?.trim() || "";
  const type =
    rawType && isCanonicalNodeType(rawType)
      ? rawType
      : detectNodeTypeFromName(name);

  const nodeId = `${type}-${name.replace(/\s+/g, "-").toUpperCase()}`;

  const notes = buildNotes(row);
  const capacity =
    NODE_TYPE_DEFAULTS[type as keyof typeof NODE_TYPE_DEFAULTS]?.capacity ?? 8;

  return {
    input: {
      nodeId,
      type,
      name,
      latitude,
      longitude,
      capacity,
      notes,
    },
    warnings,
  };
}

/** Service import CSV → MappingNode (mode merge/upsert). */
export class MapCsvImportService {
  constructor(private readonly repository: IMappingRepository) {}

  /** Import CSV text ke MappingNode. Mode merge: node existing update, baru insert. */
  async importFromCsv(
    ctx: TenantContext,
    csvContent: string,
  ): Promise<CsvImportSummary> {
    if (csvContent.length > MAX_CSV_SIZE_BYTES) {
      return {
        totalRows: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        results: [],
        errors: [
          {
            rowIndex: 0,
            raw: "",
            error: `Ukuran CSV melebihi ${MAX_CSV_SIZE_BYTES / 1024 / 1024}MB`,
          },
        ],
      };
    }

    const { rows } = parseCsv(csvContent);
    const results: CsvImportRowResult[] = [];
    const errors: CsvImportSummary["errors"] = [];
    const nodesToUpsert: CreateMapNodeInput[] = [];

    rows.forEach((raw, idx) => {
      const rowIndex = idx + 2;
      const mapped = mapRowToNodeInput(raw, rowIndex);
      if ("error" in mapped) {
        errors.push({ rowIndex, raw: raw.name || "", error: mapped.error });
        return;
      }

      nodesToUpsert.push(mapped.input);
      results.push({
        rowIndex,
        nodeId: mapped.input.nodeId,
        name: mapped.input.name ?? "",
        type: mapped.input.type,
        latitude: mapped.input.latitude ?? 0,
        longitude: mapped.input.longitude ?? 0,
        action: "updated",
        warnings: mapped.warnings,
      });
    });

    const { nodes: uniqueNodes, results: uniqueResults } = dedupeNodesByNodeId(
      nodesToUpsert,
      results,
    );

    if (uniqueNodes.length === 0) {
      return {
        totalRows: rows.length,
        created: 0,
        updated: 0,
        skipped: errors.length,
        results: uniqueResults,
        errors,
      };
    }

    const upsertSummary = await this.repository.upsertNodes(ctx, uniqueNodes);

    uniqueResults.forEach((result, idx) => {
      result.action = upsertSummary.actions[idx] ?? "created";
    });

    return {
      totalRows: rows.length,
      created: upsertSummary.created,
      updated: upsertSummary.updated,
      skipped: errors.length,
      results: uniqueResults,
      errors,
    };
  }
}

function dedupeNodesByNodeId(
  nodes: CreateMapNodeInput[],
  results: CsvImportRowResult[],
): {
  nodes: CreateMapNodeInput[];
  results: CsvImportRowResult[];
} {
  const usedNodeIds = new Set<string>();
  const uniqueNodes: CreateMapNodeInput[] = [];
  const uniqueResults: CsvImportRowResult[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const result = results[i];
    const resolved = resolveUniqueNodeId(node.nodeId, usedNodeIds);

    if (resolved.suffix > 1) {
      const baseName = node.name ?? result.name;
      const uniqueName = `${baseName}-${resolved.suffix}`;
      node.nodeId = resolved.nodeId;
      node.name = uniqueName;
      result.nodeId = resolved.nodeId;
      result.name = uniqueName;
      result.warnings = [
        ...result.warnings,
        `Nama/nodeId duplikat, diganti jadi "${uniqueName}"`,
      ];
    }

    usedNodeIds.add(resolved.nodeId);
    uniqueNodes.push(node);
    uniqueResults.push(result);
  }

  return { nodes: uniqueNodes, results: uniqueResults };
}

function resolveUniqueNodeId(
  baseNodeId: string,
  used: Set<string>,
): { nodeId: string; suffix: number } {
  if (!used.has(baseNodeId)) {
    return { nodeId: baseNodeId, suffix: 1 };
  }

  let suffix = 2;
  while (used.has(`${baseNodeId}-${suffix}`)) {
    suffix++;
  }
  return { nodeId: `${baseNodeId}-${suffix}`, suffix };
}

/** Helper generate nodeId unik untuk fallback. */
export function generateFallbackNodeId(type: string): string {
  return `${type}-${randomUUID().split("-")[0]}`;
}
