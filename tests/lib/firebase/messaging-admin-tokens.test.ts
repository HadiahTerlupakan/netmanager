import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  prismaAuth: prismaMock,
}));

vi.mock("@/lib/firebase/admin", () => ({
  messaging: {
    sendEachForMulticast: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Firebase messaging admin token selection", () => {
  let getAdminTokens: (typeof import("@/lib/firebase/messaging"))["getAdminTokens"];

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ getAdminTokens } = await import("@/lib/firebase/messaging"));
  });

  it("selects admin by accessAdminPanel capability, not role name list", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "admin-1",
        fcmTokens: ["token-1"],
        isActive: true,
        role: { name: "CUSTOM_ADMIN", accessAdminPanel: true },
      },
      {
        id: "admin-2",
        fcmTokens: ["token-2"],
        isActive: true,
        role: { name: "ANOTHER_ROLE", accessAdminPanel: true },
      },
    ] as never);

    await getAdminTokens();

    const query = prismaMock.user.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({
      isActive: true,
      role: { accessAdminPanel: true },
    });
    expect(query.where).not.toMatchObject({
      role: {
        name: { in: ["SUPER_ADMIN", "Super Admin", "Admin", "Admin Payment"] },
      },
    });
  });
});
