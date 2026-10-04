/**
 * Unduh berkas yang disusun di browser (mis. ekspor CSV).
 *
 * CSV diawali BOM UTF-8 supaya Excel membaca huruf non-ASCII dengan benar.
 */

const UTF8_BOM = "﻿";
export const CSV_MIME_TYPE = "text/csv;charset=utf-8;";

/** Picu unduhan teks sebagai berkas; object URL dilepas setelahnya. */
export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const prefix = mimeType.startsWith("text/csv") ? UTF8_BOM : "";
  const url = URL.createObjectURL(new Blob([prefix + content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Tanggal hari ini (WIB) untuk nama berkas, mis. "2026-10-04". */
export function todayForFileName(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}
