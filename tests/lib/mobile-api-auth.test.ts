import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetMobileTokenDetails = vi.fn();
const mockVerifyMobileToken = vi.fn();
vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenDetails: (token: string, versionCodeOverride?: number | null) =>
    mockGetMobileTokenDetails(token, versionCodeOverride),
  verifyMobileToken: (
    token: string,
    versionCodeOverride?: number | null,
    preloadedDetails?: unknown,
  ) => mockVerifyMobileToken(token, versionCodeOverride, preloadedDetails),
}));

import { ErrorCodes } from "@/lib/api-response";
import { authenticateMobileRequest } from "@/lib/mobile-api-auth";

function createRequest(headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/test", {
    headers: headers || {},
  });
}

type MockVersionAccess = {
  isSupported: boolean;
  minimumVersion: string | null;
  latestVersion: unknown;
  updateAvailable: boolean;
  isForceUpdate: boolean;
  currentVersionCode: number;
};

describe("Mobile API auth helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyMobileToken.mockResolvedValue(null);
  });

  it("returns 401 when authorization header is missing", async () => {
    const request = createRequest();
    const result = await authenticateMobileRequest(request);

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error).toBe("Tidak terautentikasi");
    }
  });

  it("returns 401 with invalid token when verification fails", async () => {
    mockGetMobileTokenDetails.mockResolvedValueOnce(null);
    const request = createRequest({ Authorization: "Bearer invalid-token" });
    const result = await authenticateMobileRequest(request);

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error).toBe("Token tidak valid");
    }
  });

  it("returns 426 when version is unsupported", async () => {
    const versionAccess: MockVersionAccess = {
      isSupported: false,
      minimumVersion: "10.0",
      latestVersion: null,
      updateAvailable: false,
      isForceUpdate: false,
      currentVersionCode: 0,
    };
    mockGetMobileTokenDetails.mockResolvedValueOnce({
      payload: { sub: "user-1", userId: "user-1" },
      versionCode: 1,
      versionAccess,
    });
    mockVerifyMobileToken.mockResolvedValueOnce({
      sub: "user-1",
      userId: "user-1",
    });

    const request = createRequest({ Authorization: "Bearer old-token" });
    const result = await authenticateMobileRequest(request);

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(426);
      const body = await result.response.json();
      expect(body.code).toBe(ErrorCodes.APP_VERSION_UNSUPPORTED);
    }

    expect(mockGetMobileTokenDetails).toHaveBeenCalledWith(
      "old-token",
      undefined,
    );
    expect(mockVerifyMobileToken).toHaveBeenCalledWith("old-token", undefined, {
      payload: { sub: "user-1", userId: "user-1" },
      versionCode: 1,
      versionAccess,
    });
  });

  it("returns payload when token is valid and supported", async () => {
    const payload = {
      sub: "user-1",
      userId: "user-1",
      email: "test@example.com",
    };
    const versionAccess: MockVersionAccess = {
      isSupported: true,
      minimumVersion: "1.0",
      latestVersion: null,
      updateAvailable: true,
      isForceUpdate: false,
      currentVersionCode: 100,
    };
    mockGetMobileTokenDetails.mockResolvedValueOnce({
      payload,
      versionCode: 100,
      versionAccess,
    });
    mockVerifyMobileToken.mockResolvedValueOnce(payload);

    const request = createRequest({ Authorization: "Bearer valid-token" });
    const result = await authenticateMobileRequest(request);

    expect("payload" in result).toBe(true);
    if ("payload" in result) {
      expect(result.payload).toEqual(payload);
    }
  });

  it("reuses preloaded token details during verification", async () => {
    const payload = {
      sub: "user-1",
      userId: "user-1",
      email: "test@example.com",
    };
    const versionAccess: MockVersionAccess = {
      isSupported: true,
      minimumVersion: null,
      latestVersion: null,
      updateAvailable: false,
      isForceUpdate: false,
      currentVersionCode: 100,
    };
    mockGetMobileTokenDetails.mockResolvedValueOnce({
      payload,
      versionCode: 100,
      versionAccess,
    });
    mockVerifyMobileToken.mockResolvedValueOnce(payload);

    const request = createRequest({ Authorization: "Bearer valid-token" });
    const result = await authenticateMobileRequest(request);

    expect("payload" in result).toBe(true);
    expect(mockVerifyMobileToken).toHaveBeenCalledWith(
      "valid-token",
      undefined,
      {
        payload,
        versionCode: 100,
        versionAccess,
      },
    );
  });

  it("meneruskan request version header untuk authenticated requests", async () => {
    const payload = {
      sub: "user-1",
      userId: "user-1",
      email: "test@example.com",
    };
    const versionAccess: MockVersionAccess = {
      isSupported: true,
      minimumVersion: null,
      latestVersion: null,
      updateAvailable: false,
      isForceUpdate: false,
      currentVersionCode: 100,
    };
    mockGetMobileTokenDetails.mockResolvedValueOnce({
      payload,
      versionCode: 100,
      versionAccess,
    });
    mockVerifyMobileToken.mockResolvedValueOnce(payload);

    const request = createRequest({
      Authorization: "Bearer valid-token",
      "X-App-Version-Code": "100",
    });
    const result = await authenticateMobileRequest(request);

    expect("payload" in result).toBe(true);
    expect(mockGetMobileTokenDetails).toHaveBeenCalledWith("valid-token", 100);
    expect(mockVerifyMobileToken).toHaveBeenCalledWith("valid-token", 100, {
      payload,
      versionCode: 100,
      versionAccess,
    });
  });
});
