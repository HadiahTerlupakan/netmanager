import { describe, expect, it } from "vitest";
import { partyDetailUrl } from "@/modules/legal/domain/party-links";

describe("partyDetailUrl", () => {
  it.each([
    ["MITRA", "/admin/mitra/x1"],
    ["PELANGGAN", "/admin/pelanggan/ppp/x1"],
    ["VENDOR", "/admin/procurement/suppliers/x1"],
    ["SITE", "/admin/workorders/sites/x1"],
    ["RESELLER", "/admin/resellers"],
  ] as const)("%s → %s", (type, url) => {
    expect(partyDetailUrl(type, "x1")).toBe(url);
  });

  it("pihak teks bebas tidak punya tautan", () => {
    expect(partyDetailUrl(null, null)).toBeNull();
  });
});
