/**
 * Pure parser untuk output text accel-ppp CLI.
 * Tidak menyentuh socket / I/O — hanya transformasi string ke struct.
 */

export interface AccelPppSessionDTO {
  ifname: string;
  username: string;
  callingSid: string;
  ip: string;
  rateLimit: string | null;
  type: string;
  comp: string | null;
  state: string;
  uptime: string;
  /** Nilai mentah lain di luar kolom standar (mis. ip6, rx-bytes). */
  extras: Record<string, string>;
}

export interface AccelPppStatDTO {
  cpuPercent: number | null;
  activeSessions: number;
  startingSessions: number;
  finishingSessions: number;
  /** Detail mentah dalam bentuk key-value untuk diagnostik. */
  raw: Record<string, string>;
}

const FIELD_TO_KEY: Record<string, keyof AccelPppSessionDTO> = {
  ifname: "ifname",
  username: "username",
  "calling-sid": "callingSid",
  ip: "ip",
  "rate-limit": "rateLimit",
  type: "type",
  comp: "comp",
  state: "state",
  uptime: "uptime",
};

/**
 * Parse output dari `show sessions`.
 * Format default: tabular dengan separator `|`, baris ke-2 berupa garis `--+--`.
 * Kolom non-standar (mis. `sid`, `rx-bytes`) ditampung di `extras`.
 */
export function parseShowSessions(raw: string): AccelPppSessionDTO[] {
  const lines = stripPromptNoise(raw)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  const headerIdx = lines.findIndex((line) => line.includes("|"));
  if (headerIdx < 0) return [];

  const header = lines[headerIdx];
  const dividerExpected =
    headerIdx + 1 < lines.length && /^[\s\-+|]+$/.test(lines[headerIdx + 1]);

  const dataStart = dividerExpected ? headerIdx + 2 : headerIdx + 1;
  const headerColumns = splitPipeRow(header);

  const sessions: AccelPppSessionDTO[] = [];
  for (let i = dataStart; i < lines.length; i += 1) {
    const row = lines[i];
    if (!row.includes("|")) continue;
    const values = splitPipeRow(row);
    if (values.length === 0) continue;

    sessions.push(buildSessionDto(headerColumns, values));
  }

  return sessions;
}

/**
 * Parse output dari `show stat`. Mengambil sebagian metrik penting
 * dan menyertakan sisanya di `raw` untuk debugging.
 */
export function parseShowStat(raw: string): AccelPppStatDTO {
  const cleaned = stripPromptNoise(raw);
  const stat: AccelPppStatDTO = {
    cpuPercent: null,
    activeSessions: 0,
    startingSessions: 0,
    finishingSessions: 0,
    raw: {},
  };

  const lines = cleaned.split(/\r?\n/);
  let inSessionsBlock = false;

  for (const line of lines) {
    const indented = line.startsWith("  ") || line.startsWith("\t");
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    if (/^sessions\s*:?\s*$/i.test(trimmed)) {
      inSessionsBlock = true;
      continue;
    }
    if (!indented) {
      inSessionsBlock = false;
    }

    const cpuMatch = /^cpu\s*:\s*(\d+(?:\.\d+)?)\s*%?$/i.exec(trimmed);
    if (cpuMatch) {
      stat.cpuPercent = Number.parseFloat(cpuMatch[1]);
      continue;
    }

    const kv = /^([^:]+?)\s*:\s*(.+)$/.exec(trimmed);
    if (!kv) continue;

    const key = kv[1].trim();
    const value = kv[2].trim();

    if (inSessionsBlock) {
      if (/^active$/i.test(key)) {
        stat.activeSessions = toIntOrZero(value);
      } else if (/^starting$/i.test(key)) {
        stat.startingSessions = toIntOrZero(value);
      } else if (/^finishing$/i.test(key)) {
        stat.finishingSessions = toIntOrZero(value);
      }
    }

    stat.raw[key] = value;
  }

  return stat;
}

/**
 * Parse response dari perintah `terminate ...`.
 * Mengembalikan `true` bila response mengindikasikan minimal satu sesi diakhiri.
 */
export function parseTerminateResponse(raw: string): {
  success: boolean;
  notFound: boolean;
  message: string;
} {
  const text = stripPromptNoise(raw).trim();
  const lower = text.toLowerCase();

  const notFound =
    lower.includes("not found") ||
    lower.includes("no sessions") ||
    lower.includes("no session matched");

  const success =
    !notFound &&
    (lower.includes("terminated") || lower.includes("ok") || text.length === 0);

  return { success, notFound, message: text };
}

/** Deteksi response auth gagal dari TCP CLI accel-ppp. */
export function isAuthFailureResponse(raw: string): boolean {
  const lower = raw.toLowerCase();
  return (
    lower.includes("authentication failed") ||
    lower.includes("password is incorrect") ||
    lower.includes("invalid password") ||
    lower.includes("access denied")
  );
}

function buildSessionDto(
  headerColumns: string[],
  values: string[],
): AccelPppSessionDTO {
  const dto: AccelPppSessionDTO = {
    ifname: "",
    username: "",
    callingSid: "",
    ip: "",
    rateLimit: null,
    type: "",
    comp: null,
    state: "",
    uptime: "",
    extras: {},
  };

  headerColumns.forEach((col, idx) => {
    const value = values[idx]?.trim() ?? "";
    const standardKey = FIELD_TO_KEY[col];

    if (standardKey) {
      assignStandard(dto, standardKey, value);
      return;
    }

    if (value.length > 0) {
      dto.extras[col] = value;
    }
  });

  return dto;
}

function assignStandard(
  dto: AccelPppSessionDTO,
  key: keyof AccelPppSessionDTO,
  value: string,
): void {
  switch (key) {
    case "ifname":
      dto.ifname = value;
      return;
    case "username":
      dto.username = value;
      return;
    case "callingSid":
      dto.callingSid = value;
      return;
    case "ip":
      dto.ip = value;
      return;
    case "rateLimit":
      dto.rateLimit = value.length > 0 ? value : null;
      return;
    case "type":
      dto.type = value;
      return;
    case "comp":
      dto.comp = value.length > 0 ? value : null;
      return;
    case "state":
      dto.state = value;
      return;
    case "uptime":
      dto.uptime = value;
      return;
    default:
      return;
  }
}

function splitPipeRow(line: string): string[] {
  return line.split("|").map((cell) => cell.trim());
}

function stripPromptNoise(raw: string): string {
  // Hilangkan banner versi & prompt seperti "accel-ppp version 1.5.0" / "accel-ppp#"
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return true;
      if (/^accel-ppp\s+version/i.test(trimmed)) return false;
      if (/^accel-ppp#/i.test(trimmed)) return false;
      return true;
    })
    .join("\n");
}

function toIntOrZero(value: string): number {
  const n = Number.parseInt(value.replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
