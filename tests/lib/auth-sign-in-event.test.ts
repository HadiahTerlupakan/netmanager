import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  logAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prismaAuth: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}));

vi.mock("@/lib/logger", () => ({
  logger: { logAuth: mocks.logAuth, error: vi.fn(), info: vi.fn() },
}));

import { recordWebSignIn } from "@/lib/auth/sign-in-event";

describe("recordWebSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      role: {
        name: "admin",
        accessAdminPanel: true,
        accessEmployeePanel: true,
      },
    });
  });

  it("records a web login in the login log, with role and portal", async () => {
    await recordWebSignIn({
      user: { id: "user-1", email: "a@radpro.id", name: "Ani" },
      account: { provider: "credentials" },
      isNewUser: false,
    } as never);

    expect(mocks.logAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN",
        userId: "user-1",
        details: expect.objectContaining({
          email: "a@radpro.id",
          role: "admin",
          portal: "Admin Portal",
          provider: "credentials",
        }),
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
  });

  it("still records the login when the role lookup fails", async () => {
    mocks.findUnique.mockRejectedValue(new Error("db down"));

    await recordWebSignIn({
      user: { id: "user-1", email: "a@radpro.id", name: "Ani" },
      account: null,
    } as never);

    expect(mocks.logAuth).toHaveBeenCalledWith(
      expect.objectContaining({ action: "LOGIN", userId: "user-1" }),
    );
  });
});

describe("auth config", () => {
  it("records every web sign-in", async () => {
    const { authConfig } = await import("@/lib/auth");

    expect(authConfig.events?.signIn).toBe(recordWebSignIn);
  });
});
