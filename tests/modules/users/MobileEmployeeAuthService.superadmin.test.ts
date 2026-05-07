import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

vi.mock("@/modules/database", () => ({
  prismaAuth: prismaMock,
}));

vi.mock("bcryptjs", () => ({
  compare: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/mobile-auth", () => ({
  signMobileToken: vi.fn(() => Promise.resolve("mock-token")),
  signMobileRefreshToken: vi.fn(() => Promise.resolve("mock-refresh")),
}));

vi.mock("@/modules/marketing", () => ({
  getUserFeaturesWithCanvasing: vi.fn(() => Promise.resolve([])),
}));

describe("MobileEmployeeAuthService superadmin bypass", () => {
  let MobileEmployeeAuthService: typeof import("@/modules/users/services/MobileEmployeeAuthService").MobileEmployeeAuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ MobileEmployeeAuthService } =
      await import("@/modules/users/services/MobileEmployeeAuthService"));
  });

  it("uses canonical helper for superadmin mobile access bypass", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      name: "Super User",
      email: "super@test.com",
      tenantId: "tenant-1",
      passwordHash: "$2a$10$hash",
      employeeType: null,
      workDays: null,
      workingHourMode: null,
      isSales: false,
      role: {
        name: "SUPER_ADMIN",
        isSuperAdmin: true,
        accessEmployeePanel: false,
        permission: [],
      },
    } as never);

    prismaMock.user.update.mockResolvedValue({} as never);

    const service = new MobileEmployeeAuthService();
    const result = await service.tryLogin({
      email: "super@test.com",
      password: "password",
      versionCode: 1,
      versionName: "1.0.0",
    });

    expect(result).toMatchObject({ found: true, success: true });
  });

  it("blocks employee without accessEmployeePanel and not superadmin", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-2",
      name: "Regular User",
      email: "regular@test.com",
      tenantId: "tenant-1",
      passwordHash: "$2a$10$hash",
      employeeType: null,
      workDays: null,
      workingHourMode: null,
      isSales: false,
      role: {
        name: "REGULAR_ROLE",
        isSuperAdmin: false,
        accessEmployeePanel: false,
        permission: [],
      },
    } as never);

    const service = new MobileEmployeeAuthService();
    const result = await service.tryLogin({
      email: "regular@test.com",
      password: "password",
      versionCode: 1,
      versionName: "1.0.0",
    });

    expect(result).toMatchObject({
      found: true,
      success: false,
      error: "Akun tidak memiliki akses mobile app",
    });
  });
});
