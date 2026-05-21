/**
 * Utility untuk export laporan akuntansi ke CSV dan PDF.
 */

/**
 * Export data ke CSV dan trigger download.
 * BOM (﻿) ditambahkan agar Excel membaca UTF-8 dengan benar.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][],
): void {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");

  const blob = new Blob(["﻿" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export tabel ke PDF dan trigger download.
 * Menggunakan jspdf + jspdf-autotable (dynamic import, client-side only).
 */
export async function downloadPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: string[][],
  options?: { orientation?: "portrait" | "landscape" },
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: options?.orientation || "portrait" });

  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 14, 28);

  // Table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    head: [headers],
    body: rows,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  doc.save(filename);
}
