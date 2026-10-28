import type { ZipPart } from "@/modules/sample-invoice";

/** Unduh setiap bagian ZIP lewat tautan, satu per satu, agar tidak diblokir browser. */
export async function downloadParts(batchId: string, parts: ZipPart[]) {
  for (const [index, part] of parts.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 800));
    const link = document.createElement("a");
    link.href = `/api/admin/sample-invoices/${batchId}/download?part=${encodeURIComponent(part.key)}`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
