import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock("@/lib/mobile-investor-auth", () => ({
  getInvestorMobileSession: vi.fn(async () => null),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: vi.fn(async () =>
    NextResponse.json({ success: false }, { status: 426 }),
  ),
}));

vi.mock("@/modules/app-version", async () => ({
  versionCheckQuerySchema: (
    await vi.importActual<
      typeof import("@/modules/app-version/validators/app-release")
    >("@/modules/app-version/validators/app-release")
  ).versionCheckQuerySchema,
  getAppReleaseServices: async () => ({
    versionCheckService: { check: mocks.check },
  }),
}));

import { GET } from "@/app/api/mobile/app-version/check/route";

describe("GET /api/mobile/app-version/check for an outdated app", () => {
  it("still tells the app what to install instead of refusing it", async () => {
    mocks.check.mockResolvedValue({
      updateAvailable: true,
      isForceUpdate: true,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/mobile/app-version/check?platform=android&currentVersion=1.0.0&currentVersionCode=53",
        { headers: { authorization: "Bearer old-token" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ isForceUpdate: true });
  });
});
