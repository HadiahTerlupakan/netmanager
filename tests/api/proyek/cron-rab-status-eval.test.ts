import { beforeEach, describe, expect, it, vi } from "vitest";

const CRON_SECRET = "rahasia-cron-uji";

const mocks = vi.hoisted(() => ({
  evaluateStatuses: vi.fn(),
  authorization: null as string | null,
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "authorization" ? mocks.authorization : null,
  }),
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ CRON_SECRET }),
}));

vi.mock("@/modules/proyek", () => ({
  getRabStatusEvaluationService: () => ({
    evaluateStatuses: mocks.evaluateStatuses,
  }),
}));

describe("route cron evaluasi status proyek", () => {
  beforeEach(() => {
    mocks.evaluateStatuses.mockReset();
    mocks.evaluateStatuses.mockResolvedValue({ evaluated: 3, updated: 1 });
    mocks.authorization = null;
  });

  it("menolak permintaan tanpa header Authorization dengan 401", async () => {
    const { POST } = await import("@/app/api/cron/rab-status-eval/route");

    const response = await POST(new Request("http://localhost/cron"));

    expect(response.status).toBe(401);
    expect(mocks.evaluateStatuses).not.toHaveBeenCalled();
  });

  it("menolak Bearer yang salah dengan 401", async () => {
    mocks.authorization = "Bearer salah";
    const { POST } = await import("@/app/api/cron/rab-status-eval/route");

    const response = await POST(new Request("http://localhost/cron"));

    expect(response.status).toBe(401);
    expect(mocks.evaluateStatuses).not.toHaveBeenCalled();
  });

  it("menjalankan evaluasi dan membalas 200 bila Bearer benar", async () => {
    mocks.authorization = `Bearer ${CRON_SECRET}`;
    const { POST } = await import("@/app/api/cron/rab-status-eval/route");

    const response = await POST(new Request("http://localhost/cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.evaluateStatuses).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body)).toContain("evaluated");
  });
});
