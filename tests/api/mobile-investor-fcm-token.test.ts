import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.hoisted(() => vi.fn());
const mockAturToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mobile-investor-auth", () => ({ requireInvestorMobileSession: mockRequireSession }));
vi.mock("@/modules/investor", () => ({ getInvestorPushService: () => ({ aturToken: mockAturToken }) }));

import { POST } from "@/app/api/mobile/investor/fcm-token/route";

function kirim(body: unknown) {
  return POST(
    new Request("http://localhost/api/mobile/investor/fcm-token", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/mobile/investor/fcm-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ id: "inv-1", tenantId: "t-1" });
    mockAturToken.mockResolvedValue(true);
  });

  it("tanpa sesi investor → 401", async () => {
    mockRequireSession.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    expect((await kirim({ fcmToken: "tok" })).status).toBe(401);
    expect(mockAturToken).not.toHaveBeenCalled();
  });

  it("token kosong atau aksi tak dikenal → 400", async () => {
    expect((await kirim({ fcmToken: " " })).status).toBe(400);
    expect((await kirim({ fcmToken: "tok", action: "hapus-semua" })).status).toBe(400);
  });

  it("menyimpan token untuk investor dari sesi (bawaan add), remove diteruskan", async () => {
    expect((await kirim({ fcmToken: "tok" })).status).toBe(200);
    expect(mockAturToken).toHaveBeenCalledWith("inv-1", "tok", "add");

    await kirim({ fcmToken: "tok", action: "remove" });
    expect(mockAturToken).toHaveBeenLastCalledWith("inv-1", "tok", "remove");
  });

  it("investor sudah dihapus → 404", async () => {
    mockAturToken.mockResolvedValue(false);
    expect((await kirim({ fcmToken: "tok" })).status).toBe(404);
  });
});
