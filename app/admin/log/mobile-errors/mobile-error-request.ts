/** Info request yang gagal, dilampirkan aplikasi mobile di `context.extra`. */
export interface MobileErrorRequest {
  method?: string;
  endpoint?: string;
  status?: number;
  serverMessage?: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Ambil endpoint, metode, status, dan pesan server dari detail laporan.
 * Laporan lama hanya membawa endpoint & metode; `null` bila tidak ada sama sekali.
 */
export function describeMobileErrorRequest(details: {
  context?: unknown;
}): MobileErrorRequest | null {
  const context = details.context;
  if (!context || typeof context !== "object") return null;

  const extra = (context as { extra?: unknown }).extra;
  if (!extra || typeof extra !== "object") return null;

  const raw = extra as Record<string, unknown>;
  const request: MobileErrorRequest = {};
  const method = readString(raw.method);
  const endpoint = readString(raw.endpoint);
  const serverMessage = readString(raw.serverMessage);
  if (method) request.method = method;
  if (endpoint) request.endpoint = endpoint;
  if (typeof raw.status === "number") request.status = raw.status;
  if (serverMessage) request.serverMessage = serverMessage;

  return request.endpoint ? request : null;
}

/** Satu baris ringkas: `POST /api/... · 400`. */
export function formatMobileErrorRequest(request: MobileErrorRequest): string {
  const target = [request.method, request.endpoint].filter(Boolean).join(" ");
  return request.status ? `${target} · ${request.status}` : target;
}
