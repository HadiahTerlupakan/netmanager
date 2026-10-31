import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/customer/CustomerNotificationBell", () => ({
  CustomerNotificationBell: (): null => null,
}));

import { DashboardHttpError } from "@/lib/dashboard/fetchDashboardResource";
import {
  CustomerDashboardContent,
  getDashboardFailureState,
} from "@/app/(customer)/dashboard/CustomerDashboardClient";

describe("CustomerDashboardClient failure state", () => {
  it("maps auth failures to login recovery", () => {
    const result = getDashboardFailureState(
      new DashboardHttpError("Tidak terautentikasi", 401),
    );

    expect(result).toEqual({
      title: "Sesi pelanggan sudah berakhir",
      description:
        "Sesi Anda sudah berakhir. Silakan login kembali untuk membuka dashboard pelanggan.",
      actionHref: "/login",
      actionLabel: "Kembali ke login",
    });
  });

  it("maps service failures to dashboard retry recovery", () => {
    const result = getDashboardFailureState(
      new Error("Format respons dashboard tidak valid"),
    );

    expect(result).toEqual({
      title: "Dashboard pelanggan belum bisa dimuat",
      description: "Format respons dashboard tidak valid",
      actionHref: "/dashboard",
      actionLabel: "Muat ulang dashboard",
    });
  });

  it("renders retry CTA for non-auth dashboard failures", () => {
    const markup = renderToStaticMarkup(
      <CustomerDashboardContent
        customerId="customer-1"
        customerName="Pelanggan Satu"
        summary={null}
        isLoading={false}
        dashboardError={new Error("Gateway timeout")}
      />,
    );

    expect(markup).toContain("Dashboard pelanggan belum bisa dimuat");
    expect(markup).toContain("Gateway timeout");
    expect(markup).toContain('href="/dashboard"');
    expect(markup).toContain("Muat ulang dashboard");
  });

  it("renders login CTA for auth failures", () => {
    const markup = renderToStaticMarkup(
      <CustomerDashboardContent
        customerId="customer-1"
        customerName="Pelanggan Satu"
        summary={null}
        isLoading={false}
        dashboardError={new DashboardHttpError("Forbidden", 403)}
      />,
    );

    expect(markup).toContain("Sesi pelanggan sudah berakhir");
    expect(markup).toContain('href="/login"');
    expect(markup).toContain("Kembali ke login");
  });
});

function buildIsolatedSummary(outstandingCount: number) {
  return {
    profile: {
      state: "ready" as const,
      data: { nama: "Pelanggan Satu", status: "ISOLIR", paket: null as null },
    },
    connection: {
      state: "ready" as const,
      data: { isOnline: true, ipAddress: "10.255.0.2" },
    },
    billing: {
      state: "ready" as const,
      data: {
        outstandingCount,
        outstandingAmount: outstandingCount * 150000,
        nearestDueDate: outstandingCount > 0 ? "2026-11-10" : null,
        hasOverdue: outstandingCount > 0,
      },
    },
  };
}

describe("CustomerDashboardClient status isolir", () => {
  function renderWith(outstandingCount: number) {
    return renderToStaticMarkup(
      <CustomerDashboardContent
        customerId="customer-1"
        customerName="Pelanggan Satu"
        summary={buildIsolatedSummary(outstandingCount)}
        isLoading={false}
        dashboardError={null}
      />,
    );
  }

  it("tidak menyuruh bayar saat tagihan sudah lunas", () => {
    const markup = renderWith(0);

    expect(markup).toContain("Tagihan lunas");
    expect(markup).toContain("Diisolir – hubungi admin/CS");
    expect(markup).not.toContain("bayar tagihan");
  });

  it("tetap meminta bayar saat masih ada tunggakan", () => {
    expect(renderWith(1)).toContain("Diisolir – bayar tagihan");
  });
});
