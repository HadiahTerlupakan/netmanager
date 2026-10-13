import { describe, expect, it, vi } from "vitest";

const evaluateStatuses = vi
  .fn()
  .mockResolvedValue({ evaluated: 0, updated: 0 });

vi.mock("@/modules/proyek", () => ({
  getRabStatusEvaluationService: () => ({ evaluateStatuses }),
}));

describe("route cron evaluasi status proyek", () => {
  it("masih menemukan service-nya setelah modul pindah", async () => {
    const route = await import("@/app/api/cron/rab-status-eval/route");

    expect(typeof route.POST).toBe("function");
    expect(typeof route.GET).toBe("function");
  });
});
