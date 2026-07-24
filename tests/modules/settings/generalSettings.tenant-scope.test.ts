import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetTenantIdFromContext = vi.fn();

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: (...args: unknown[]) =>
    mockGetTenantIdFromContext(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  buildGeneralSettingsUpserts,
  getGeneralSettings,
  updateGeneralSettings,
  type GeneralSettingsPayload,
} from "@/modules/settings/services/generalSettings";
import type { ISettingsRepository } from "@/modules/settings/domain/ports/ISettingsRepository";

const basePayload: GeneralSettingsPayload = {
  perusahaan: "PT Test",
  namaAplikasi: "NetManager",
  alamat: "Jl. Test",
  nomorHp: "08123",
  email: "a@b.com",
  deskripsiInvoice: "Invoice",
  rekeningBank: [],
  invoiceOtomatis: "5",
  disablePerpanjanganPaket: "5",
  timezone: "Asia/Jakarta",
  attendanceTolerance: "15",
  reminderOtomatis: "3",
  reminderFrequency: "DAILY",
  reminderTime: "08:00",
  notifApp: true,
  notifWa: false,
  notifEmail: false,
};

describe("generalSettings tenant scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-a",
      isSuperAdmin: false,
    });
  });

  it("reads settings with active tenant id from context", async () => {
    const findManyByKeys = vi.fn().mockResolvedValue([
      {
        key: "GENERAL_PERUSAHAAN",
        value: "PT Saved",
        encrypted: false,
      },
    ]);
    const repository = {
      findManyByKeys,
      upsertMany: vi.fn(),
    } as unknown as ISettingsRepository;

    const result = await getGeneralSettings(repository);

    expect(findManyByKeys).toHaveBeenCalledWith(
      expect.arrayContaining(["GENERAL_PERUSAHAAN"]),
      "tenant-a",
    );
    expect(result.perusahaan).toBe("PT Saved");
  });

  it("writes settings with active tenant id on every upsert entry", async () => {
    const upsertMany = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findManyByKeys: vi.fn(),
      upsertMany,
    } as unknown as ISettingsRepository;

    await updateGeneralSettings(basePayload, repository);

    expect(upsertMany).toHaveBeenCalledTimes(1);
    const entries = upsertMany.mock.calls[0][0] as Array<{
      key: string;
      tenantId?: string | null;
      value: string | null;
    }>;
    expect(entries.length).toBeGreaterThan(5);
    expect(entries.every((entry) => entry.tenantId === "tenant-a")).toBe(true);
    expect(
      entries.find((entry) => entry.key === "GENERAL_PERUSAHAAN")?.value,
    ).toBe("PT Test");
  });

  it("buildGeneralSettingsUpserts stamps explicit tenantId", () => {
    const entries = buildGeneralSettingsUpserts(basePayload, "tenant-b");
    expect(entries.every((entry) => entry.tenantId === "tenant-b")).toBe(true);
  });
});
