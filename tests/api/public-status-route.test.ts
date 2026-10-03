import { describe, expect, it, vi } from "vitest";

import { createRouteServiceError } from "@/lib/api/route-service-error";

const { statusPublik } = vi.hoisted(() => ({ statusPublik: vi.fn() }));
vi.mock("@/modules/incident", () => ({ getIncidentService: () => ({ statusPublik }) }));

import { GET } from "@/app/api/public/status/route";

const permintaan = () => new Request("http://admin.radpro.id/api/public/status") as never;

describe("GET /api/public/status", () => {
  it("domain tenant: insiden aktif & selesai terbaru", async () => {
    statusPublik.mockResolvedValueOnce({ active: [{ id: "a" }], recent: [] });
    const res = await GET(permintaan());
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ active: [{ id: "a" }], recent: [] });
  });

  it("domain tanpa tenant → 404 dengan pesan apa adanya", async () => {
    statusPublik.mockRejectedValueOnce(createRouteServiceError("Halaman status tidak tersedia di domain ini", 404));
    const res = await GET(permintaan());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Halaman status tidak tersedia di domain ini");
  });

  it("galat lain tetap 500 tanpa detail internal", async () => {
    statusPublik.mockRejectedValueOnce(new Error("koneksi DB putus"));
    const res = await GET(permintaan());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("koneksi DB putus");
  });
});
