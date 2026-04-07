import type { MixRadiusInvoice } from "./MixRadiusService";

export function parseMixRadiusInvoicesFromHtml(
  html: string,
): MixRadiusInvoice[] {
  const invoices: MixRadiusInvoice[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1] ?? "";
    const colRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cols: string[] = [];
    let colMatch: RegExpExecArray | null;

    while ((colMatch = colRegex.exec(rowContent)) !== null) {
      cols.push((colMatch[1] ?? "").replace(/<[^>]*>/g, "").trim());
    }

    if (cols.length >= 7) {
      let status = cols[7] || "";
      const rowUpper = rowContent.toUpperCase();

      if (!status || status === "Unknown" || status.trim() === "") {
        if (rowUpper.includes("UNPAID") || rowUpper.includes("BELUM BAYAR")) {
          status = "Unpaid";
        } else if (rowUpper.includes("PAID") || rowUpper.includes("LUNAS")) {
          status = "Paid";
        } else {
          status = "Unknown";
        }
      }

      let invoiceNum = cols[1] ?? "";
      if (invoiceNum.toUpperCase().endsWith("UNPAID")) {
        invoiceNum = invoiceNum.substring(0, invoiceNum.length - 6);
        if (!status || status === "Unknown") status = "Unpaid";
      } else if (invoiceNum.toUpperCase().endsWith("PAID")) {
        invoiceNum = invoiceNum.substring(0, invoiceNum.length - 4);
        if (!status || status === "Unknown") status = "Paid";
      }

      const col0 = cols[0] ?? "";
      const col3 = cols[3] ?? "";

      if (/^\d+$/.test(col0) && (col3.includes("Rp") || /[\d,.]+/.test(col3))) {
        invoices.push({
          id: col0,
          invoice_number: invoiceNum,
          plan_name: cols[2] ?? "",
          amount: col3,
          activation_date: cols[4] ?? "",
          deadline_date: cols[5] ?? "",
          owner: cols[6] ?? "",
          status,
        });
      }
    }
  }

  return invoices;
}

export function buildInvoiceCountCacheKey(
  customerId: string,
  renewedOn: string,
) {
  return `${customerId}:${renewedOn}`;
}
