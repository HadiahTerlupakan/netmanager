import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listMonitoredContracts: vi.fn(),
  getTenantSettingsMap: vi.fn(),
  upsertTenantSettings: vi.fn(),
}));

vi.mock("@/modules/legal", () => ({
  LegalPartyContractReader: class {
    listMonitoredContracts = mocks.listMonitoredContracts;
  },
}));

vi.mock("@/modules/settings", () => ({
  getTenantSettingsMap: mocks.getTenantSettingsMap,
  upsertTenantSettings: mocks.upsertTenantSettings,
}));

import { LegalResellerPksDirectory } from "@/modules/reseller/services/legal-pks-directory";
import {
  RESELLER_COMPLIANCE_REQUIRED_KEY,
  TenantResellerComplianceSettings,
} from "@/modules/reseller/services/reseller-compliance-settings";

describe("LegalResellerPksDirectory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("membaca kontrak pihak RESELLER lewat API publik legal dan mengelompokkannya", async () => {
    const endDate = new Date("2027-01-01T00:00:00.000Z");
    mocks.listMonitoredContracts.mockResolvedValueOnce([
      {
        documentId: "d1",
        partyId: "r1",
        startDate: null,
        endDate,
        daysLeft: 59,
        hasStarted: true,
      },
      {
        documentId: "d2",
        partyId: "r1",
        startDate: null,
        endDate: null,
        daysLeft: null,
        hasStarted: true,
      },
      {
        documentId: "d3",
        partyId: "r2",
        startDate: null,
        endDate,
        daysLeft: -3,
        hasStarted: true,
      },
    ]);

    const result =
      await new LegalResellerPksDirectory().listContractsByReseller(
        "tenant-1",
        ["r1", "r2", "r3"],
      );

    expect(mocks.listMonitoredContracts).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      partyType: "RESELLER",
      partyIds: ["r1", "r2", "r3"],
    });
    expect(result.get("r1")?.map((item) => item.documentId)).toEqual([
      "d1",
      "d2",
    ]);
    expect(result.get("r2")).toEqual([
      {
        documentId: "d3",
        startDate: null,
        endDate,
        daysLeft: -3,
        hasStarted: true,
      },
    ]);
    expect(result.has("r3")).toBe(false);
  });

  it("tidak memanggil modul legal untuk daftar kosong", async () => {
    const result =
      await new LegalResellerPksDirectory().listContractsByReseller(
        "tenant-1",
        [],
      );

    expect(result.size).toBe(0);
    expect(mocks.listMonitoredContracts).not.toHaveBeenCalled();
  });
});

describe("TenantResellerComplianceSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("default mati bila tenant belum menyimpan pengaturan", async () => {
    mocks.getTenantSettingsMap.mockImplementationOnce(
      async (_tenant, fields) => ({
        [fields[0].key]: fields[0].defaultValue,
      }),
    );

    expect(
      await new TenantResellerComplianceSettings().isComplianceRequired(
        "tenant-1",
      ),
    ).toBe(false);
    expect(mocks.getTenantSettingsMap).toHaveBeenCalledWith("tenant-1", [
      { key: RESELLER_COMPLIANCE_REQUIRED_KEY, defaultValue: "false" },
    ]);
  });

  it("aktif bila tersimpan 'true'", async () => {
    mocks.getTenantSettingsMap.mockResolvedValueOnce({
      [RESELLER_COMPLIANCE_REQUIRED_KEY]: "true",
    });

    expect(
      await new TenantResellerComplianceSettings().isComplianceRequired(
        "tenant-1",
      ),
    ).toBe(true);
  });

  it("menyimpan per tenant", async () => {
    await new TenantResellerComplianceSettings().setComplianceRequired(
      "tenant-9",
      true,
    );

    expect(mocks.upsertTenantSettings).toHaveBeenCalledWith("tenant-9", [
      expect.objectContaining({
        key: RESELLER_COMPLIANCE_REQUIRED_KEY,
        value: "true",
      }),
    ]);
  });
});
