import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apiSuccess } from "@/lib/api-response";
import { fetchDashboardResource } from "@/lib/dashboard/fetchDashboardResource";

describe("fetchDashboardResource", () => {
  it("returns parsed data from apiSuccess envelope", async () => {
    const schema = z.object({ id: z.string(), total: z.number() });
    const response = apiSuccess(
      { id: "dashboard-1", total: 12 },
      { message: "OK" },
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await fetchDashboardResource(
      "https://example.com/dashboard",
      schema,
    );

    expect(result).toEqual({ id: "dashboard-1", total: 12 });
  });

  it("throws DashboardHttpError when a 2xx response does not have success true", async () => {
    const schema = z.object({ id: z.string(), total: z.number() });
    const response = new Response(
      JSON.stringify({ data: { id: "dashboard-1", total: 12 } }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(
      fetchDashboardResource("https://example.com/dashboard", schema),
    ).rejects.toMatchObject({
      name: "DashboardHttpError",
      message: "Format respons dashboard tidak valid",
    });
  });

  it("throws DashboardHttpError for non-2xx responses", async () => {
    const schema = z.object({ id: z.string() });
    const response = new Response(
      JSON.stringify({ error: "Tidak bisa memuat dashboard" }),
      {
        status: 503,
        headers: { "content-type": "application/json" },
      },
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(
      fetchDashboardResource("https://example.com/dashboard", schema),
    ).rejects.toMatchObject({
      name: "DashboardHttpError",
      message: "Tidak bisa memuat dashboard",
      status: 503,
    });
  });
});
