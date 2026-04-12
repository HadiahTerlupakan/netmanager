import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
