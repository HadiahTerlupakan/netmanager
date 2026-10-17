import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  logAuditActivity: vi.fn().mockResolvedValue(undefined),
  markDomainActivity: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: vi.fn().mockResolvedValue([]),
}));
vi.unmock("@/lib/tenant-context");
vi.mock("@/lib/middleware/request-logger", () => ({
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  logAuditActivity: mocks.logAuditActivity,
}));

import {
  getActivityRequestContext,
  trackDomainActivity,
} from "@/lib/activity-request-context";
import { createHandler } from "@/lib/api/handler";

function postRequest() {
  return new NextRequest("http://localhost/api/mobile/attendance/check-out", {
    method: "POST",
    headers: {
      "x-forwarded-for": "10.0.0.7, 10.42.0.1",
      "user-agent": "okhttp/4.12.0",
    },
  });
}

const ROUTE_CONTEXT = { params: Promise.resolve({}) };

describe("createHandler: satu aksi satu baris log", () => {
  beforeEach(() => mocks.logAuditActivity.mockClear());

  it("melewati log generik bila handler sudah menulis log domain", async () => {
    let seenContext: ReturnType<typeof getActivityRequestContext>;
    const route = createHandler({ auth: false }, async () => {
      seenContext = getActivityRequestContext();
      trackDomainActivity(seenContext!, Promise.resolve(true));
      return NextResponse.json({ ok: true });
    });

    await route(postRequest(), ROUTE_CONTEXT);

    expect(seenContext!).toMatchObject({
      ipAddress: "10.42.0.1",
      userAgent: "okhttp/4.12.0",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.logAuditActivity).not.toHaveBeenCalled();
  });

  it("tetap menulis log generik bila handler tidak punya log domain", async () => {
    const route = createHandler({ auth: false }, async () =>
      NextResponse.json({ ok: true }),
    );

    await route(postRequest(), ROUTE_CONTEXT);

    await vi.waitFor(() =>
      expect(mocks.logAuditActivity).toHaveBeenCalledTimes(1),
    );
  });
});

it("tetap menulis log generik bila log domain request gagal tersimpan", async () => {
  mocks.logAuditActivity.mockClear();
  const route = createHandler({ auth: false }, async () => {
    trackDomainActivity(getActivityRequestContext()!, Promise.resolve(false));
    return NextResponse.json({ ok: true });
  });

  await route(postRequest(), ROUTE_CONTEXT);

  await vi.waitFor(() =>
    expect(mocks.logAuditActivity).toHaveBeenCalledTimes(1),
  );
});
