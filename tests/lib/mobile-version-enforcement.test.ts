import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ minimum: null as unknown }));

vi.mock("@/modules/app-version/services/MobileVersionGate", async () => {
  const policy = await vi.importActual<
    typeof import("@/modules/app-version/services/mobile-version-policy")
  >("@/modules/app-version/services/mobile-version-policy");
  return {
    getMinimumMobileVersion: async () => gate.minimum,
    evaluateMobileVersion: async (reported: {
      versionCode: number;
      versionName: string | null;
    }) => ({
      isSupported: policy.isMobileVersionSupported(
        reported,
        gate.minimum as never,
      ),
      minimum: gate.minimum,
    }),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {},
  prismaAuth: { user: { findUnique: vi.fn(async () => null) } },
}));

vi.mock("@/lib/prisma-mitra", () => ({
  prismaMitraAuth: { mitra: { findUnique: vi.fn() } },
}));

async function tokenFor(versionCode: number, versionName: string) {
  const { signMobileToken } = await import("@/lib/mobile-auth");
  return signMobileToken({
    id: "user-1",
    role: "USER",
    appVersionCode: versionCode,
    appVersionName: versionName,
  });
}

describe("mobile version enforcement", () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET ??= "test-secret-at-least-32-characters-long";
  });

  beforeEach(() => {
    gate.minimum = { versionCode: 49, versionName: "1.0.9" };
  });

  it("rejects requests from an app older than the required release", async () => {
    const { getMobileTokenDetails } = await import("@/lib/mobile-auth");

    const details = await getMobileTokenDetails(await tokenFor(48, "1.0.9"));

    expect(details?.versionAccess).toMatchObject({
      isSupported: false,
      currentVersionCode: 48,
      minimumVersionCode: 49,
    });
  });

  it("rejects an old app whose build number is out of sequence", async () => {
    const { getMobileTokenDetails } = await import("@/lib/mobile-auth");

    const details = await getMobileTokenDetails(await tokenFor(53, "1.0.0"));

    expect(details?.versionAccess.isSupported).toBe(false);
  });

  it("accepts the required release", async () => {
    const { getMobileTokenDetails } = await import("@/lib/mobile-auth");

    const details = await getMobileTokenDetails(await tokenFor(49, "1.0.9"));

    expect(details?.versionAccess.isSupported).toBe(true);
  });

  it("refuses a login from an old app by version name as well", async () => {
    const { MobileAuthVersionService } =
      await import("@/modules/users/services/MobileAuthVersionService");
    const service = new MobileAuthVersionService();

    const oldApp = await service.buildUnsupportedVersionResponse(53, "1.0.0");
    const currentApp = await service.buildUnsupportedVersionResponse(
      49,
      "1.0.9",
    );

    expect(oldApp?.status).toBe(426);
    expect(currentApp).toBeNull();
  });
});
