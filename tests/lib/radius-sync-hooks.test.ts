import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  syncSingleCustomer: vi.fn(),
  handleStatusChange: vi.fn(),
  verifyCustomerSync: vi.fn(),
  deleteRadiusUserByUsername: vi.fn(),
}));

vi.mock("@/modules/network", () => ({
  RadiusSyncService: class MockRadiusSyncService {
    syncSingleCustomer = mockFns.syncSingleCustomer;
    handleStatusChange = mockFns.handleStatusChange;
    verifyCustomerSync = mockFns.verifyCustomerSync;
    deleteRadiusUserByUsername = mockFns.deleteRadiusUserByUsername;
  },
}));

import {
  afterCustomerUpdate,
  beforeCustomerDelete,
} from "@/lib/hooks/radius-sync-hooks";

describe("radius sync hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.syncSingleCustomer.mockResolvedValue(undefined);
    mockFns.handleStatusChange.mockResolvedValue(undefined);
    mockFns.verifyCustomerSync.mockResolvedValue({
      synced: true,
      username: "new-user",
      status: "AKTIF",
      existsInRadius: true,
    });
    mockFns.deleteRadiusUserByUsername.mockResolvedValue(undefined);
  });

  it("syncs renamed username before deleting the old radius user", async () => {
    prismaMock.pelanggan.findUnique.mockResolvedValueOnce({
      id: "cust-1",
      tenantId: "tenant-1",
    });

    const result = await afterCustomerUpdate(prismaMock as never, "cust-1", {
      oldUsername: "old-user",
      newUsername: "new-user",
    });

    expect(result).toEqual({ success: true });
    expect(mockFns.syncSingleCustomer).toHaveBeenCalledWith("cust-1");
    expect(mockFns.verifyCustomerSync).toHaveBeenCalledWith("cust-1");
    expect(mockFns.deleteRadiusUserByUsername).toHaveBeenCalledWith(
      "old-user",
      "tenant-1",
    );
    expect(
      mockFns.deleteRadiusUserByUsername.mock.invocationCallOrder[0],
    ).toBeGreaterThan(mockFns.syncSingleCustomer.mock.invocationCallOrder[0]);
  });

  it("does not delete the old radius user when renamed customer sync verification fails", async () => {
    prismaMock.pelanggan.findUnique.mockResolvedValueOnce({
      id: "cust-1",
      tenantId: "tenant-1",
    });
    mockFns.verifyCustomerSync.mockResolvedValueOnce(false);

    const result = await afterCustomerUpdate(prismaMock as never, "cust-1", {
      oldUsername: "old-user",
      newUsername: "new-user",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/verifikasi/i);
    expect(mockFns.deleteRadiusUserByUsername).not.toHaveBeenCalled();
  });

  it("uses the public delete method when deleting a customer", async () => {
    prismaMock.pelanggan.findFirst.mockResolvedValueOnce({
      tenantId: "tenant-1",
    });

    const result = await beforeCustomerDelete(
      prismaMock as never,
      "legacy-user",
    );

    expect(result).toEqual({ success: true });
    expect(mockFns.deleteRadiusUserByUsername).toHaveBeenCalledWith(
      "legacy-user",
      "tenant-1",
    );
  });
});
