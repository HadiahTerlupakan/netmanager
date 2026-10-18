import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));

import { MinVersionPanel } from "@/app/admin/pengaturan/app-update/MinVersionPanel";

const release = (versionCode: number, status: string) => ({
  versionCode,
  versionName: "1.0.9",
  firstSeenAt: "2026-10-18T06:00:00.000Z",
  enforcedFrom: "2026-10-20T06:00:00.000Z",
  cancelledAt: status === "CANCELLED" ? "2026-10-19T00:00:00.000Z" : null,
  status,
});

const render = (overview: object, canUpdate = true) =>
  renderToStaticMarkup(
    <MinVersionPanel
      overview={overview as never}
      canUpdate={canUpdate}
      busy={false}
      onToggle={vi.fn()}
      onEnforceNow={vi.fn()}
      onSync={vi.fn()}
    />,
  );

describe("MinVersionPanel", () => {
  it("explains that nothing is locked until the Play credential is set", () => {
    const html = render({
      credentialConfigured: false,
      minimum: null,
      releases: [],
    });

    expect(html).toContain("Belum terhubung ke Google Play");
    expect(html).toContain("Belum ada versi yang dikunci");
  });

  it("shows each release with its status and the matching action", () => {
    const html = render({
      credentialConfigured: true,
      minimum: { versionCode: 49, versionName: "1.0.9" },
      releases: [
        release(50, "GRACE"),
        release(49, "REQUIRED"),
        release(48, "LOCKED_OUT"),
        release(47, "CANCELLED"),
      ],
    });

    expect(html).toContain("Versi minimum saat ini: 1.0.9 (build 49)");
    expect(html).toContain("Masa jeda");
    expect(html).toContain("Wajib");
    expect(html).toContain("Ditolak");
    expect(html).toContain("Dibatalkan");
    expect(html.match(/Batalkan penguncian/g)).toHaveLength(2);
    expect(html).toContain("Aktifkan kembali");
  });

  it("hides the actions from admins without the update permission", () => {
    const html = render(
      {
        credentialConfigured: true,
        minimum: null,
        releases: [release(50, "GRACE")],
      },
      false,
    );

    expect(html).not.toContain("Batalkan penguncian");
    expect(html).not.toContain("Sinkronkan sekarang");
  });

  it("offers to enforce early only a release still in its grace", () => {
    const html = render({
      credentialConfigured: true,
      minimum: { versionCode: 48, versionName: "1.0.9" },
      releases: [release(49, "GRACE"), release(48, "REQUIRED")],
    });

    expect(html.match(/Wajibkan sekarang/g)).toHaveLength(1);
  });
});
