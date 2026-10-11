// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Column } from "@/components/ui/ResponsiveTable";

const mockResponsiveTable = vi.fn((_props?: unknown) => null);
const mockUseApi = vi.fn();

vi.mock("@/components/ui/ResponsiveTable", () => ({
  ResponsiveTable: (props: unknown) => mockResponsiveTable(props),
}));

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: (...args: unknown[]) => mockUseApi(...args),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children?: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
  ConfirmDialog: (): null => null,
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

import { AnnouncementIndexClient } from "@/app/admin/announcement/AnnouncementIndexClient";

interface BarisPengumuman {
  id: string;
  title: string;
  content: string;
  target: "ALL";
  isActive: boolean;
  isPinned: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

function buatPengumuman(
  override: Partial<BarisPengumuman> = {},
): BarisPengumuman {
  return {
    id: "ann-1",
    title: "Judul",
    content: "Konten",
    target: "ALL",
    isActive: true,
    isPinned: false,
    startDate: null,
    endDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...override,
  };
}

/** Render daftar lalu ambil teks yang dirender kolom Status untuk satu baris. */
async function statusTerender(pengumuman: BarisPengumuman) {
  mockUseApi.mockReturnValue({
    data: [pengumuman],
    isLoading: false,
    mutate: vi.fn(),
  });

  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<AnnouncementIndexClient />);
  });

  const props = mockResponsiveTable.mock.calls.at(-1)?.[0] as {
    columns: Column<BarisPengumuman>[];
  };
  const kolomStatus = props.columns.find((kolom) => kolom.header === "Status");
  if (!kolomStatus?.render) {
    throw new Error("Kolom Status tidak ditemukan");
  }

  const pembungkus = document.createElement("div");
  document.body.appendChild(pembungkus);
  await act(async () => {
    createRoot(pembungkus).render(
      <>{kolomStatus.render!(pengumuman, 0)}</>,
    );
  });
  return pembungkus.textContent ?? "";
}

describe("kolom Status daftar pengumuman", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-10-11T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("menandai kedaluwarsa ketika periodenya sudah lewat walau isActive true", async () => {
    const teks = await statusTerender(
      buatPengumuman({
        isActive: true,
        startDate: "2026-05-18T00:00:00.000Z",
        endDate: "2026-05-20T00:00:00.000Z",
      }),
    );

    expect(teks).toBe("Kedaluwarsa");
  });

  it("menandai terjadwal ketika tanggal mulainya masih di depan", async () => {
    const teks = await statusTerender(
      buatPengumuman({ startDate: "2026-12-01T00:00:00.000Z" }),
    );

    expect(teks).toBe("Terjadwal");
  });

  it("menandai aktif ketika sedang berada di dalam periode", async () => {
    const teks = await statusTerender(
      buatPengumuman({
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2026-10-31T00:00:00.000Z",
      }),
    );

    expect(teks).toBe("Aktif");
  });

  it("menandai non-aktif ketika saklarnya dimatikan", async () => {
    const teks = await statusTerender(buatPengumuman({ isActive: false }));

    expect(teks).toBe("Non-aktif");
  });
});
