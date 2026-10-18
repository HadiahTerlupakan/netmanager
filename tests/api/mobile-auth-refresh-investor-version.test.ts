import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  investorRefresh: vi.fn(),
  evaluateMobileVersion: vi.fn(),
}));

vi.mock("@/modules/investor", () => ({
  getMobileInvestorAuthService: () => ({ refresh: mocks.investorRefresh }),
}));

vi.mock("@/modules/users", () => ({
  tryRefreshCustomerToken: vi.fn(async () => null),
  tryRefreshMobileToken: vi.fn(async () => ({ kind: "invalid" })),
}));

vi.mock("@/modules/app-version", () => ({
  evaluateMobileVersion: mocks.evaluateMobileVersion,
}));

import { POST } from "@/app/api/mobile/auth/refresh/route";

function refreshRequest() {
  return new NextRequest("http://localhost/api/mobile/auth/refresh", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-app-version-code": "40",
      "x-app-version-name": "1.0.5",
    },
    body: JSON.stringify({ refreshToken: "investor-refresh" }),
  });
}

describe("POST /api/mobile/auth/refresh for investors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.investorRefresh.mockResolvedValue({
      token: "new-access",
      refreshToken: "new-refresh",
    });
  });

  it("refuses to extend the session of an outdated investor app", async () => {
    mocks.evaluateMobileVersion.mockResolvedValue({
      isSupported: false,
      minimum: { versionCode: 49, versionName: "1.0.9" },
    });

    const response = await POST(refreshRequest());

    expect(response.status).toBe(426);
    expect(mocks.evaluateMobileVersion).toHaveBeenCalledWith({
      versionCode: 40,
      versionName: "1.0.5",
    });
  });

  it("refreshes an up-to-date investor app", async () => {
    mocks.evaluateMobileVersion.mockResolvedValue({
      isSupported: true,
      minimum: null,
    });

    const response = await POST(refreshRequest());

    expect(response.status).toBe(200);
  });
});
