import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getTenantIdFromContext: vi.fn(),
  process: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: mockFns.getTenantIdFromContext,
}));

vi.mock("@/modules/finance", () => ({
  WebhookProcessingService: class {
    process = mockFns.process;
  },
}));

import { POST } from "@/app/api/webhooks/[provider]/route";

describe("payment webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-a",
      isSuperAdmin: false,
    });
    mockFns.process.mockResolvedValue({
      status: 200,
      body: { status: "ok" },
    });
  });

  it("forwards raw body, headers, and tenantId to webhook processing service", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/tripay", {
      method: "POST",
      body: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: {
        "content-type": "application/json",
        "x-callback-signature": "sig-1",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ provider: "tripay" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expect(mockFns.process).toHaveBeenCalledWith({
      providerType: "tripay",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: request.headers,
      tenantId: "tenant-a",
    });
  });
});
