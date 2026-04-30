export type SessionUsageData = {
  downloadBytes: number;
  uploadBytes: number;
};

export type PPPActiveSessionRecord = Record<string, string> & {
  ".id"?: string;
  name?: string;
  interface?: string;
  "bytes-in"?: string;
  "bytes-out"?: string;
  "rx-byte"?: string;
  "tx-byte"?: string;
  rx?: string;
  tx?: string;
};

/** Parse RouterOS byte counter into a positive number. */
export function parseCounter(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Normalize RouterOS dynamic interface names. */
export function normalizeInterfaceName(name?: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Extract traffic usage from active session or interface stats. */
export function extractSessionUsage(
  session?: PPPActiveSessionRecord,
): SessionUsageData {
  if (!session) return { downloadBytes: 0, uploadBytes: 0 };
  const downloadFromPrimary = pickCounter(session, "bytes-out", "tx-byte");
  const uploadFromPrimary = pickCounter(session, "bytes-in", "rx-byte");
  return {
    downloadBytes:
      downloadFromPrimary > 0 ? downloadFromPrimary : parseCounter(session.tx),
    uploadBytes:
      uploadFromPrimary > 0 ? uploadFromPrimary : parseCounter(session.rx),
  };
}

function pickCounter(
  session: PPPActiveSessionRecord,
  primary: keyof PPPActiveSessionRecord,
  fallback: keyof PPPActiveSessionRecord,
): number {
  const primaryValue = parseCounter(session[primary]);
  if (primaryValue > 0) return primaryValue;
  return parseCounter(session[fallback]);
}
