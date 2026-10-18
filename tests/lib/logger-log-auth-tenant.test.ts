import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
    systemLog: { create: mocks.create },
  },
}));

vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: async (_reason: string, run: () => Promise<unknown>) =>
    run(),
}));

import { logger } from "@/lib/logger";

describe("logger.logAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({});
  });

  it("files a user's login under that user's tenant", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user-1", tenantId: "tenant-b" });

    await logger.logAuth({ action: "LOGIN", userId: "user-1" });

    expect(mocks.create.mock.calls[0]![0].data.tenantId).toBe("tenant-b");
  });

  it("keeps an explicitly given tenant", async () => {
    await logger.logAuth({
      action: "LOGIN",
      actor: { type: "investor", id: "inv-1" },
      tenantId: "tenant-c",
    });

    expect(mocks.create.mock.calls[0]![0].data.tenantId).toBe("tenant-c");
  });
});
