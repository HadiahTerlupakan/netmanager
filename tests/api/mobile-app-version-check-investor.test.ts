import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvestorSession = vi.hoisted(() => vi.fn());
const mockMobilePayload = vi.hoisted(() => vi.fn());
const mockCheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mobile-investor-auth", () => ({
  getInvestorMobileSession: mockInvestorSession,
}));
vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: (_reason: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockMobilePayload,
}));
vi.mock("@/modules/app-version", async () => {
  const { z } = await import("zod");
  return {
    getAppReleaseServices: async () => ({
      versionCheckService: { check: mockCheck },
    }),
    versionCheckQuerySchema: z.object({
      platform: z.string(),
      currentVersion: z.string(),
      currentVersionCode: z.coerce.number(),
    }),
  };
});

import { GET } from "@/app/api/mobile/app-version/check/route";

const URL_CEK =
  "http://localhost/api/mobile/app-version/check?platform=ANDROID&currentVersion=1.0.9&currentVersionCode=1";

describe("GET /api/mobile/app-version/check — akun investor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheck.mockResolvedValue({ needsUpdate: false });
  });

  it("token investor diterima memakai tenant investor (sebelumnya 401 → investor dikeluarkan)", async () => {
    mockInvestorSession.mockResolvedValue({ id: "inv-1", tenantId: "t-inv" });

    const response = await GET(new Request(URL_CEK) as never);

    expect(response.status).toBe(200);
    expect(mockCheck).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t-inv" }),
    );
    expect(mockMobilePayload).not.toHaveBeenCalled();
  });

  it("bukan investor tanpa token sah → tetap dijawab tanpa tenant", async () => {
    // Aplikasi di layar login (atau yang versinya ditolak) harus tetap tahu
    // versi apa yang wajib dipasang.
    mockInvestorSession.mockResolvedValue(null);
    mockMobilePayload.mockResolvedValue(NextResponse.json({}, { status: 401 }));

    expect((await GET(new Request(URL_CEK) as never)).status).toBe(200);
    expect(mockCheck).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined }),
    );
  });

  it("galat lain dari jalur token mobile tetap diteruskan", async () => {
    mockInvestorSession.mockResolvedValue(null);
    mockMobilePayload.mockResolvedValue(NextResponse.json({}, { status: 403 }));

    expect((await GET(new Request(URL_CEK) as never)).status).toBe(403);
    expect(mockCheck).not.toHaveBeenCalled();
  });
});
