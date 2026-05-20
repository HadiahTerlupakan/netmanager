export interface BankStatementRow {
  date: Date;
  description: string;
  amount: string;
}

export type BankFormat = "BCA" | "MANDIRI" | "BNI" | "GENERIC";

export function parseBankCsv(
  csvContent: string,
  format: BankFormat,
): BankStatementRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  switch (format) {
    case "BCA":
      return parseBCA(lines);
    case "MANDIRI":
      return parseMandiri(lines);
    case "BNI":
      return parseBNI(lines);
    case "GENERIC":
    default:
      return parseGeneric(lines);
  }
}

function parseBCA(lines: string[]): BankStatementRow[] {
  return lines
    .slice(1)
    .map((line) => {
      const cols = splitCsvLine(line);
      const dateStr = cols[0]?.trim();
      const description = cols[1]?.trim() || "";
      const debit = parseAmount(cols[3]);
      const credit = parseAmount(cols[4]);
      const amount = credit > 0 ? credit.toString() : (-debit).toString();

      return { date: parseDate(dateStr, "/"), description, amount };
    })
    .filter((r) => r.description !== "");
}

function parseMandiri(lines: string[]): BankStatementRow[] {
  return lines
    .slice(1)
    .map((line) => {
      const cols = splitCsvLine(line);
      const dateStr = cols[0]?.trim();
      const description = cols[1]?.trim() || "";
      const debit = parseAmount(cols[2]);
      const credit = parseAmount(cols[3]);
      const amount = credit > 0 ? credit.toString() : (-debit).toString();

      return { date: parseDate(dateStr, "-"), description, amount };
    })
    .filter((r) => r.description !== "");
}

function parseBNI(lines: string[]): BankStatementRow[] {
  return lines
    .slice(1)
    .map((line) => {
      const cols = splitCsvLine(line);
      const dateStr = cols[0]?.trim();
      const description = cols[2]?.trim() || "";
      const debit = parseAmount(cols[3]);
      const credit = parseAmount(cols[4]);
      const amount = credit > 0 ? credit.toString() : (-debit).toString();

      return { date: parseDate(dateStr, "/"), description, amount };
    })
    .filter((r) => r.description !== "");
}

function parseGeneric(lines: string[]): BankStatementRow[] {
  return lines
    .slice(1)
    .map((line) => {
      const cols = splitCsvLine(line);
      return {
        date: new Date(cols[0]?.trim()),
        description: cols[1]?.trim() || "",
        amount: cols[2]?.trim() || "0",
      };
    })
    .filter((r) => r.description !== "");
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseAmount(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  return parseFloat(cleaned) || 0;
}

function parseDate(s: string, sep: string): Date {
  const parts = s.split(sep);
  if (parts.length === 3) {
    return new Date(
      parseInt(parts[2]),
      parseInt(parts[1]) - 1,
      parseInt(parts[0]),
    );
  }
  return new Date(s);
}
