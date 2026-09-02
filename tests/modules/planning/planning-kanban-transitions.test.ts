import { describe, expect, it } from "vitest";
import { resolveKanbanTransition } from "@/modules/planning/client";
import type { PlanningStatus } from "@/modules/planning/client";

const from = (a: PlanningStatus, b: PlanningStatus) =>
  resolveKanbanTransition(a, b);

describe("resolveKanbanTransition", () => {
  // Transisi yang tidak memerlukan masukan tambahan aman dilakukan lewat
  // gestur seret.
  it("mengajukan rencana saat diseret dari draf ke menunggu persetujuan", () => {
    expect(from("BACKLOG", "PENDING_APPROVAL")?.endpoint).toBe("submit");
  });

  it("memulai pengerjaan saat diseret dari disetujui ke berjalan", () => {
    expect(from("APPROVED", "IN_PROGRESS")?.endpoint).toBe("start");
  });

  it("menyelesaikan saat diseret dari berjalan ke selesai", () => {
    expect(from("IN_PROGRESS", "COMPLETED")?.endpoint).toBe("complete");
  });

  // Persetujuan adalah keputusan kendali atas belanja infrastruktur. Menjadikan
  // nya gestur seret berarti satu selip tetikus bisa menyetujuinya, dan
  // penolakan wajib disertai alasan yang tidak mungkin diisi lewat seret.
  it("menolak persetujuan lewat gestur seret", () => {
    expect(from("PENDING_APPROVAL", "APPROVED")).toBeNull();
  });

  it("menolak penolakan lewat gestur seret", () => {
    expect(from("PENDING_APPROVAL", "REJECTED")).toBeNull();
  });

  // Mundur ke belakang bukan transisi yang sah pada alur ini.
  it.each([
    ["IN_PROGRESS", "APPROVED"],
    ["COMPLETED", "IN_PROGRESS"],
    ["PENDING_APPROVAL", "BACKLOG"],
  ] as [PlanningStatus, PlanningStatus][])(
    "menolak mundur dari %s ke %s",
    (a, b) => {
      expect(from(a, b)).toBeNull();
    },
  );

  it("menolak lompatan yang melewati tahap", () => {
    expect(from("BACKLOG", "IN_PROGRESS")).toBeNull();
    expect(from("APPROVED", "COMPLETED")).toBeNull();
  });

  it("menolak menjatuhkan ke kolom asalnya sendiri", () => {
    expect(from("BACKLOG", "BACKLOG")).toBeNull();
  });

  it("menyertakan label aksi yang bisa ditampilkan", () => {
    expect(from("APPROVED", "IN_PROGRESS")?.label).toBeTruthy();
  });
});
