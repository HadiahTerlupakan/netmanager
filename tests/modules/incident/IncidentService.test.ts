import { beforeEach, describe, expect, it, vi } from "vitest";

const { publish } = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));
vi.mock("@/lib/event-bus", () => ({
  eventBus: { publish },
  EVENT_NAMES: { INCIDENT_CREATED: "incident:created", INCIDENT_RESOLVED: "incident:resolved" },
}));

import type { IncidentRepository } from "@/modules/incident/repositories/IncidentRepository";
import { IncidentService } from "@/modules/incident/services/IncidentService";

const T = "tenant-1";
const MENIT = 60 * 1000;
const sekarang = Date.now();

function insiden(over: Record<string, unknown> = {}) {
  return {
    id: "inc-1",
    title: "Fiber putus",
    description: "ODP-12 down",
    severity: "MAJOR",
    status: "INVESTIGATING",
    affectedAreas: ["Cianjur"],
    startedAt: new Date(sekarang - 90 * MENIT),
    resolvedAt: null as Date | null,
    isPublic: true,
    createdById: "u1",
    createdAt: new Date(),
    updatedAt: new Date(),
    tenantId: T,
    updates: [] as unknown[],
    ...over,
  };
}

function repoPalsu(over: Partial<Record<keyof IncidentRepository, unknown>> = {}) {
  return {
    findMany: vi.fn(async () => []),
    findById: vi.fn(async () => insiden()),
    findStartedSince: vi.fn(async () => []),
    countActive: vi.fn(async () => 0),
    createWithInitialUpdate: vi.fn(async () => insiden()),
    addUpdateIfOpen: vi.fn(async () => ({ id: "upd-1", status: "IDENTIFIED" })),
    delete: vi.fn(async () => true),
    ...over,
  } as unknown as IncidentRepository;
}

describe("IncidentService.addUpdate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insiden yang sudah selesai tidak bisa diubah lagi (409) dan event selesai tidak dikirim ulang", async () => {
    const repo = repoPalsu({
      addUpdateIfOpen: vi.fn(async () => null),
      findById: vi.fn(async () => insiden({ status: "RESOLVED", resolvedAt: new Date() })),
    });
    await expect(
      new IncidentService(repo).addUpdate(T, "inc-1", { status: "RESOLVED", message: "beres" }, "u1"),
    ).rejects.toMatchObject({ status: 409 });
    expect(publish).not.toHaveBeenCalled();
  });

  it("insiden tidak ada / milik tenant lain → 404", async () => {
    const repo = repoPalsu({ addUpdateIfOpen: vi.fn(async () => null), findById: vi.fn(async () => null) });
    await expect(
      new IncidentService(repo).addUpdate(T, "x", { status: "MONITORING", message: "cek" }, "u1"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("menyelesaikan insiden mengirim incident:resolved dengan durasi menit", async () => {
    const repo = repoPalsu({
      findById: vi.fn(async () => insiden({ status: "RESOLVED", resolvedAt: new Date(sekarang) })),
    });
    await new IncidentService(repo).addUpdate(T, "inc-1", { status: "RESOLVED", message: "pulih" }, "u1");
    expect(publish).toHaveBeenCalledWith(
      "incident:resolved",
      expect.objectContaining({ incidentId: "inc-1", durationMinutes: 90, tenantId: T }),
    );
  });
});

describe("IncidentService.create", () => {
  it("gagal publish event tidak menggagalkan pembuatan insiden yang sudah tersimpan", async () => {
    publish.mockRejectedValueOnce(new Error("redis mati"));
    const repo = repoPalsu();
    const input = { title: "Fiber putus", description: "ODP-12", severity: "MAJOR" as const, affectedAreas: [] as string[] };
    await expect(new IncidentService(repo).create(T, input, "u1")).resolves.toMatchObject({ id: "inc-1" });
    expect(repo.createWithInitialUpdate).toHaveBeenCalledWith(T, { ...input, createdById: "u1" });
  });
});

describe("IncidentService.getAnalytics", () => {
  it("aktif = semua yang belum selesai (termasuk di luar jendela); MTTR & severity dari jendela", async () => {
    const repo = repoPalsu({
      countActive: vi.fn(async () => 3),
      findStartedSince: vi.fn(async () => [
        insiden({ id: "a", status: "RESOLVED", severity: "CRITICAL", startedAt: new Date(sekarang - 120 * MENIT), resolvedAt: new Date(sekarang - 60 * MENIT) }),
        insiden({ id: "b", status: "RESOLVED", severity: "MINOR", startedAt: new Date(sekarang - 40 * MENIT), resolvedAt: new Date(sekarang - 10 * MENIT) }),
        insiden({ id: "c", status: "MONITORING" }),
      ]),
    });
    const hasil = await new IncidentService(repo).getAnalytics(T, 30);

    expect(hasil).toMatchObject({ totalIncidents: 3, totalResolved: 2, totalActive: 3, avgResolutionMinutes: 45 });
    expect(hasil.bySeverity).toEqual({ CRITICAL: 1, MAJOR: 1, MINOR: 1 });
    expect(hasil.recentlyResolved.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("IncidentService.delete", () => {
  it("menghapus insiden yang tidak ada → 404", async () => {
    await expect(new IncidentService(repoPalsu({ delete: vi.fn(async () => false) })).delete(T, "x")).rejects.toMatchObject({
      status: 404,
    });
  });
});
