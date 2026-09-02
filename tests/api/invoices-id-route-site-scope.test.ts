import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  notFound: vi.fn((resource: string) =>
    NextResponse.json(
      { success: false, error: `${resource} tidak ditemukan` },
      { status: 404 },
    ),
  ),
  forbidden: vi.fn((message: string) =>
    NextResponse.json({ success: false, error: message }, { status: 403 }),
  ),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  ApiErrors: {
    notFound: (resource: string) => mockFns.notFound(resource),
    forbidden: (message: string) => mockFns.forbidden(message),
  },
}));

import { DELETE, GET, PUT } from "@/app/api/invoices/[id]/route";
import { prismaMock } from "../setup";

describe("invoice detail route site scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findFirst.mockResolvedValue({
      siteId: "site-1",
    });
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
  });

  it("GET harus lookup invoice dengan siteId untuk user restricted", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices/inv-1"),
      {
        params: { id: "inv-1" },
        // createHandler selalu mengisi ctx.permissions untuk kedua jalur auth
        // (sesi NextAuth maupun Bearer token mobile).
        permissions: ["invoices:site_only"],
        session: {
          user: {
            id: "user-1",
            role: "ADMIN",
          },
        },
      } as never,
    );

    expect(response.status).toBe(404);
    expect(mockFns.notFound).toHaveBeenCalledWith("Invoice");
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "inv-1",
          siteId: "site-1",
        }),
      }),
    );
    expect(prismaMock.invoice.findUnique).not.toHaveBeenCalled();
  });

  it("PUT harus lookup invoice dengan siteId untuk user restricted", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/invoices/inv-1", {
        method: "PUT",
        body: JSON.stringify({ notes: "updated" }),
      }),
      {
        params: { id: "inv-1" },
        // createHandler selalu mengisi ctx.permissions untuk kedua jalur auth
        // (sesi NextAuth maupun Bearer token mobile).
        permissions: ["invoices:site_only"],
        session: {
          user: {
            id: "user-1",
            role: "ADMIN",
          },
        },
      } as never,
    );

    expect(response.status).toBe(404);
    expect(mockFns.notFound).toHaveBeenCalledWith("Invoice");
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "inv-1",
          siteId: "site-1",
        }),
      }),
    );
    expect(prismaMock.invoice.findUnique).not.toHaveBeenCalled();
  });

  it("PUT harus mengunci siteId invoice tetap ke site user restricted", async () => {
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );
    prismaMock.invoice.findFirst.mockResolvedValueOnce({
      id: "inv-1",
      pelangganId: "pel-1",
      siteId: "site-1",
      subtotal: BigInt(1000),
      taxAmount: BigInt(0),
      discountAmount: BigInt(0),
      totalAmount: BigInt(1000),
      paidAmount: BigInt(0),
      invoiceItem: [],
      payment: [],
    });
    prismaMock.pelanggan.findUnique.mockResolvedValueOnce({ id: "pel-1" });
    prismaMock.invoice.update.mockResolvedValueOnce({
      id: "inv-1",
      pelangganId: "pel-1",
      siteId: "site-1",
      subtotal: BigInt(1000),
      taxAmount: BigInt(0),
      discountAmount: BigInt(0),
      totalAmount: BigInt(1000),
      paidAmount: BigInt(0),
      invoiceItem: [],
      payment: [],
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/invoices/inv-1", {
        method: "PUT",
        body: JSON.stringify({ notes: "updated", siteId: null }),
      }),
      {
        params: { id: "inv-1" },
        // createHandler selalu mengisi ctx.permissions untuk kedua jalur auth
        // (sesi NextAuth maupun Bearer token mobile).
        permissions: ["invoices:site_only"],
        session: {
          user: {
            id: "user-1",
            role: "ADMIN",
          },
        },
      } as never,
    );

    expect(response.status).toBe(200);
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          siteId: "site-1",
          notes: "updated",
        }),
      }),
    );
  });

  it("DELETE harus lookup invoice dengan siteId untuk user restricted", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/invoices/inv-1", {
        method: "DELETE",
      }),
      {
        params: { id: "inv-1" },
        // createHandler selalu mengisi ctx.permissions untuk kedua jalur auth
        // (sesi NextAuth maupun Bearer token mobile).
        permissions: ["invoices:site_only"],
        session: {
          user: {
            id: "user-1",
            role: "ADMIN",
          },
        },
      } as never,
    );

    expect(response.status).toBe(404);
    expect(mockFns.notFound).toHaveBeenCalledWith("Invoice");
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "inv-1",
          siteId: "site-1",
        }),
      }),
    );
    expect(prismaMock.invoice.findUnique).not.toHaveBeenCalled();
  });
});
