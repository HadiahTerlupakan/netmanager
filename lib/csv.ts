const FORMULA_PREFIXES = ["=", "+", "-", "@"];

function normalizeCsvString(value: string): string {
  const sanitized = value.replace(/\r?\n/g, " ").trim();

  if (!sanitized) {
    return "";
  }

  if (FORMULA_PREFIXES.includes(sanitized[0])) {
    return `'${sanitized}`;
  }

  return sanitized;
}

/** Escapes a value for safe CSV output. */
export function escapeCsvCell(value: string | number): string {
  const serializedValue =
    typeof value === "number" ? String(value) : normalizeCsvString(value);

  return `"${serializedValue.replace(/"/g, '""')}"`;
}
