import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tryRefreshMobileToken: vi.fn() }));

vi.mock("@/modules/investor", () => ({
  getMobileInvestorAuthService: () => ({ refresh: vi.fn(async () => null) }),
}));

vi.mock("@/modules/users", async () => {
  const audit = await vi.importActual<
    typeof import("@/modules/users/services/MobileLoginAudit")
  >("@/modules/users/services/MobileLoginAudit");
  return {
    tryRefreshCustomerToken: vi.fn(async () => null),
    tryRefreshMobileToken: mocks.tryRefreshMobileToken,
    recordOutdatedAppRejected: audit.recordOutdatedAppRejected,
  };
});

vi.mock("@/modules/app-version", () => ({
  evaluateMobileVersion: vi.fn(async () => ({
    isSupported: true,
    minimum: null,
  })),
  getMinimumMobileVersion: vi.fn(async () => ({
    versionCode: 49,
    versionName: "1.0.9",
  })),
}));

import { logger } from "@/lib/logger";
import { POST } from "@/app/api/mobile/auth/refresh/route";

describe("POST /api/mobile/auth/refresh with an outdated app", () => {
  const logAuth = vi.spyOn(logger, "logAuth");

  beforeEach(() => {
    vi.clearAllMocks();
    logAuth.mockResolvedValue(undefined);
  });

  it("records who was refused and on which version", async () => {
    mocks.tryRefreshMobileToken.mockResolvedValue({
      kind: "unsupported",
      details: {
        versionCode: 48,
        versionAccess: {
          isSupported: false,
          currentVersionCode: 48,
          minimumVersionCode: 49,
        },
        payload: {
          sub: "user-1",
          role: "admin",
          email: "a@radpro.id",
          appVersionName: "1.0.9",
        },
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/auth/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-app-version-code": "48",
          "x-app-version-name": "1.0.9",
          "user-agent": "okhttp/4.12.0",
        },
        body: JSON.stringify({ refreshToken: "refresh" }),
      }),
    );

    expect(response.status).toBe(426);
    expect(logAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN_REJECTED_OUTDATED_APP",
        userId: "user-1",
        details: expect.objectContaining({
          email: "a@radpro.id",
          stage: "refresh",
          appVersion: "1.0.9 (build 48)",
          requiredVersion: "1.0.9 (build 49)",
        }),
      }),
    );
  });
});
