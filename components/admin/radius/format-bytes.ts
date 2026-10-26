const UNITS = ["B", "KB", "MB", "GB", "TB"];
const STEP = 1024;

/** Formats a byte count from the API (octets arrive as strings). */
export function formatBytes(bytes: number | string): string {
  let value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  let unitIndex = 0;
  while (value >= STEP && unitIndex < UNITS.length - 1) {
    value /= STEP;
    unitIndex++;
  }

  if (unitIndex === 0) return `${value} B`;
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${UNITS[unitIndex]}`;
}
