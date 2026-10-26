import type { RouterOSAPI } from "node-routeros-v2";
import { delay } from "./mikrotik-provisioning.connection";

/** Satu baris print RouterOS: nilai properti selalu string. */
export type RouterRow = { ".id": string; [key: string]: string | undefined };

function parseArg(arg: string): [string, string] {
  const body = arg.slice(1);
  const split = body.indexOf("=");
  return [body.slice(0, split), body.slice(split + 1)];
}

// RouterOS menerima yes/no saat menulis tetapi mencetak boolean sebagai
// true/false; tanpa ini rule seperti passthrough=yes di-set ulang setiap kali.
const PRINTED_BOOLEANS = new Map([
  ["yes", "true"],
  ["no", "false"],
]);

function matchesArg(printed: string | undefined, value: string) {
  return printed === value || printed === PRINTED_BOOLEANS.get(value);
}

/**
 * Baris yang dinonaktifkan, nilainya tidak lagi sama dengan standar, atau
 * masih memuat properti `unset` yang tidak boleh ada.
 */
export function needsRestore(
  row: RouterRow,
  args: readonly string[],
  unset: readonly string[] = [],
) {
  if (row.disabled === "true") return true;
  if (unset.some((key) => row[key] !== undefined)) return true;
  return args.some((arg) => {
    const [key, value] = parseArg(arg);
    return row[key] === undefined || !matchesArg(row[key], value);
  });
}

/**
 * Kembalikan baris milik billing yang diubah atau dinonaktifkan orang ke nilai
 * standar. Properti tambahan yang tidak ada di args dibiarkan, karena set
 * RouterOS hanya menimpa yang disebut, kecuali yang didaftar di `unset`.
 */
export async function restoreRows(input: {
  connection: Pick<RouterOSAPI, "write">;
  path: string;
  rows: RouterRow[];
  args: readonly string[];
  unset?: readonly string[];
  logs: string[];
  label: string;
}) {
  const unset = input.unset ?? [];
  for (const row of input.rows) {
    if (!needsRestore(row, input.args, unset)) continue;
    await input.connection.write(`${input.path}/set`, [
      `=.id=${row[".id"]}`,
      ...input.args,
      "=disabled=no",
    ]);
    for (const key of unset.filter((name) => row[name] !== undefined)) {
      await input.connection.write(`${input.path}/unset`, [
        `=numbers=${row[".id"]}`,
        `=value-name=${key}`,
      ]);
    }
    await delay(100);
    input.logs.push(`Restored ${input.label}`);
  }
}
