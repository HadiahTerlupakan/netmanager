import { describe, expect, it } from "vitest";
import { selectAssignableResellers } from "@/app/admin/pelanggan/ppp/shared/reseller-options";
import { isApprovedByCreator } from "@/app/admin/resellers/commission-ui";
import { COMMISSION_STATUS_LABELS } from "@/app/admin/resellers/types";

const RESELLERS = [
  { id: "active", status: "ACTIVE" },
  { id: "inactive", status: "INACTIVE" },
  { id: "suspended", status: "SUSPENDED" },
  { id: "terminated", status: "TERMINATED" },
];

describe("selectAssignableResellers", () => {
  it("form tambah hanya menampilkan reseller ACTIVE", () => {
    expect(selectAssignableResellers(RESELLERS).map((r) => r.id)).toEqual([
      "active",
    ]);
  });

  it("form edit tetap menampilkan reseller tersimpan walau tidak ACTIVE", () => {
    expect(
      selectAssignableResellers(RESELLERS, "suspended").map((r) => r.id),
    ).toEqual(["active", "suspended"]);
  });
});

describe("isApprovedByCreator", () => {
  it("true hanya bila penyetuju tercatat dan sama dengan pembuat", () => {
    expect(isApprovedByCreator({ createdById: "u1", approvedById: "u1" })).toBe(
      true,
    );
    expect(isApprovedByCreator({ createdById: "u1", approvedById: "u2" })).toBe(
      false,
    );
    expect(isApprovedByCreator({ createdById: null, approvedById: null })).toBe(
      false,
    );
  });
});

describe("COMMISSION_STATUS_LABELS", () => {
  it("memberi label Indonesia untuk setiap status komisi", () => {
    expect(COMMISSION_STATUS_LABELS.REVERSED).toBe("Ditagih balik");
    expect(Object.keys(COMMISSION_STATUS_LABELS).sort()).toEqual([
      "ACCRUED",
      "PAID",
      "REVERSED",
      "SETTLED",
    ]);
  });
});
