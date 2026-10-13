import { describe, expect, it } from "vitest";

import {
  rabProjectCreateSchema,
  rabProjectUpdateSchema,
} from "@/lib/validations/rab-project";

describe("RabProject validation", () => {
  it("mengubah nominal create menjadi bigint dan menerapkan default", () => {
    const result = rabProjectCreateSchema.parse({
      name: "RAB Baru",
      projectedRevenue: "1200",
      projectedOpex: 300,
      items: [
        {
          name: "Kabel",
          quantity: 2,
          unitPrice: "500",
          disbursements: [
            {
              name: "Termin 1",
              percentage: 100,
              amount: "1000",
            },
          ],
        },
      ],
    });

    expect(result.projectedRevenue).toBe(1200n);
    expect(result.projectedOpex).toBe(300n);
    expect(result.targetBasis).toBe("HOMECONNECT");
    expect(result.items[0].unitPrice).toBe(500n);
    expect(result.items[0].disbursements[0].amount).toBe(1000n);
  });

  it("mengubah nominal update opsional menjadi bigint", () => {
    const result = rabProjectUpdateSchema.parse({
      projectedRevenue: "2000",
      arpu: "150000",
      items: [
        {
          name: "Router",
          quantity: 1,
          unitPrice: 900,
          category: "HARDWARE",
        },
      ],
    });

    expect(result.projectedRevenue).toBe(2000n);
    expect(result.arpu).toBe(150000n);
    expect(result.items?.[0].unitPrice).toBe(900n);
  });

  it("menolak persentase sharing OPEX buffer yang totalnya bukan 100", () => {
    const result = rabProjectCreateSchema.safeParse({
      name: "RAB Sharing",
      opexBufferFundingMode: "SHARED_PERCENTAGE",
      opexBufferInvestorPercent: 60,
      opexBufferCompanyPercent: 30,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "Total persentase buffer OPEX investor dan perusahaan harus 100%",
    );
  });
});
