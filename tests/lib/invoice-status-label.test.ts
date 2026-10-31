import { InvoiceStatus } from "@prisma/client-billing";
import { describe, expect, it } from "vitest";
import { getInvoiceStatusLabel } from "@/lib/constants/invoice-status";

describe("getInvoiceStatusLabel", () => {
  it.each(Object.values(InvoiceStatus))(
    "status %s tidak tampil mentah ke pelanggan",
    (status) => {
      expect(getInvoiceStatusLabel(status)).not.toBe(status);
    },
  );

  it("tagihan yang dibatalkan berlabel Dibatalkan", () => {
    expect(getInvoiceStatusLabel(InvoiceStatus.CANCELLED)).toBe("Dibatalkan");
  });
});
