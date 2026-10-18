import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/map/PetaUniversal", () => ({
  PetaUniversal: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/map/PenandaUniversal", () => ({
  PenandaUniversal: ({ title, warna }: { title: string; warna: string }) => (
    <i data-marker={title} data-color={warna} />
  ),
}));

import EmployeeLocationMap from "@/components/attendance/EmployeeLocationMap";

const base = {
  userImage: null as string | null,
  siteName: "HQ",
  departmentName: "Ops",
  accuracy: null as number | null,
  isMoving: false,
  batteryLevel: null as number | null,
  checkInTime: "2026-10-18T01:00:00.000Z",
};

describe("EmployeeLocationMap", () => {
  it("marks tracking-off employees in red and skips those without a position", () => {
    const markup = renderToStaticMarkup(
      <EmployeeLocationMap
        locations={[
          {
            ...base,
            userId: "a",
            userName: "Aktif",
            latitude: -6.2,
            longitude: 106.8,
            recordedAt: "2026-10-18T02:00:00.000Z",
          },
          {
            ...base,
            userId: "b",
            userName: "Mati",
            latitude: -6.3,
            longitude: 106.9,
            recordedAt: "2026-10-18T01:10:00.000Z",
            trackingOff: true,
          },
          {
            ...base,
            userId: "c",
            userName: "Kosong",
            latitude: null,
            longitude: null,
            recordedAt: null,
            trackingOff: true,
          },
        ]}
      />,
    );

    expect(markup).toContain('data-marker="Aktif" data-color="#2563eb"');
    expect(markup).toContain('data-marker="Mati" data-color="#dc2626"');
    expect(markup).not.toContain('data-marker="Kosong"');
  });
});
