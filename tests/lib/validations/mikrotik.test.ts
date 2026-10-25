import { describe, expect, it } from "vitest";
import { mikrotikRouterCreateSchema } from "@/lib/validations/mikrotik";

const PUBLIC_ROUTER = {
  name: "Router A",
  ipAddress: "203.0.113.10",
  apiUsername: "admin",
  apiPassword: "rahasia",
  connectionMode: "PUBLIC" as const,
};

const VPN_ROUTER = {
  ...PUBLIC_ROUTER,
  connectionMode: "VPN" as const,
  rosVersion: "V7" as const,
  vpnServerIds: ["0a1b2c3d"],
  vpnDraftId: "4e5f6a7b",
};

describe("mikrotikRouterCreateSchema mode Server isolir", () => {
  it("menolak router PUBLIC dengan issue pada isolirMode", () => {
    const result = mikrotikRouterCreateSchema.safeParse({
      ...PUBLIC_ROUTER,
      isolirMode: "ISOLIR_SERVICE",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ["isolirMode"],
        message: "Mode Server isolir hanya untuk router VPN",
      }),
    );
  });

  it("menerima router VPN yang sah", () => {
    const result = mikrotikRouterCreateSchema.safeParse({
      ...VPN_ROUTER,
      isolirMode: "ISOLIR_SERVICE",
    });

    expect(result.success).toBe(true);
  });
});
