import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  pelangganFindFirst: vi.fn(),
  pelangganUpdate: vi.fn(),
  mitraFindUnique: vi.fn(),
  mitraUpdate: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: mockFns.compare,
    hash: mockFns.hash,
  },
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findFirst: mockFns.userFindFirst,
      update: mockFns.userUpdate,
    },
    pelanggan: {
      findFirst: mockFns.pelangganFindFirst,
      update: mockFns.pelangganUpdate,
    },
  },
  prismaMitra: {
    mitra: {
      findUnique: mockFns.mitraFindUnique,
      update: mockFns.mitraUpdate,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: mockFns.logActivity,
  },
}));

import {
  changeMobilePassword,
  MobilePasswordChangeError,
} from "@/modules/users/services/MobilePasswordChangeService";

describe("changeMobilePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.compare.mockResolvedValue(true);
    mockFns.hash.mockResolvedValue("new-hash");
    mockFns.userFindFirst.mockResolvedValue({ passwordHash: "old-hash" });
  });

  it("updates regular user password and writes activity log", async () => {
    await changeMobilePassword({
      auth: { id: "user-1", tenantId: "tenant-1", role: "ADMIN" },
      input: {
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      },
    });

    expect(mockFns.compare).toHaveBeenCalledWith("old-pass", "old-hash");
    expect(mockFns.hash).toHaveBeenCalledWith("new-pass", 10);
    expect(mockFns.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1", tenantId: "tenant-1" },
      data: { passwordHash: "new-hash" },
    });
    expect(mockFns.logActivity).toHaveBeenCalledWith({
      action: "UPDATE",
      subject: "Password Change",
      details: expect.objectContaining({ method: "mobile_app", role: "ADMIN" }),
      userId: "user-1",
      tenantId: "tenant-1",
    });
  });

  it("updates customer password for CUSTOMER role", async () => {
    mockFns.pelangganFindFirst.mockResolvedValue({
      passwordHash: "customer-hash",
    });

    await changeMobilePassword({
      auth: { id: "customer-1", tenantId: "tenant-1", role: "CUSTOMER" },
      input: {
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      },
    });

    expect(mockFns.pelangganUpdate).toHaveBeenCalledWith({
      where: { id: "customer-1", tenantId: "tenant-1" },
      data: { passwordHash: "new-hash" },
    });
  });

  it("throws validation error when confirmation does not match", async () => {
    await expect(
      changeMobilePassword({
        auth: { id: "user-1", tenantId: "tenant-1", role: "ADMIN" },
        input: {
          currentPassword: "old-pass",
          newPassword: "new-pass",
          confirmPassword: "different",
        },
      }),
    ).rejects.toEqual(
      new MobilePasswordChangeError(
        "Password baru dan konfirmasi password tidak cocok",
        "VALIDATION_ERROR",
        400,
      ),
    );
    expect(mockFns.userFindFirst).not.toHaveBeenCalled();
  });
});
