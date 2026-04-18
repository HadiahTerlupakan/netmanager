import { describe, expect, it } from "vitest";

import {
  areAllAttendanceIdsSelected,
  toggleAttendanceSelection,
  toggleCurrentPageAttendanceSelection,
} from "@/app/admin/attendance/attendance-selection";

describe("attendance-selection helpers", () => {
  describe("toggleAttendanceSelection", () => {
    it("menambahkan id ketika belum terpilih", () => {
      expect(toggleAttendanceSelection(["att-1"], "att-2")).toEqual([
        "att-1",
        "att-2",
      ]);
    });

    it("menghapus id ketika sudah terpilih", () => {
      expect(toggleAttendanceSelection(["att-1", "att-2"], "att-2")).toEqual([
        "att-1",
      ]);
    });
  });

  describe("toggleCurrentPageAttendanceSelection", () => {
    it("menggabungkan semua id halaman aktif tanpa duplikasi saat shouldSelectAll true", () => {
      expect(
        toggleCurrentPageAttendanceSelection(
          ["att-1", "att-2"],
          ["att-2", "att-3", "att-4"],
          true,
        ),
      ).toEqual(["att-1", "att-2", "att-3", "att-4"]);
    });

    it("menghapus hanya id dari halaman aktif saat shouldSelectAll false", () => {
      expect(
        toggleCurrentPageAttendanceSelection(
          ["att-1", "att-2", "att-3", "att-4"],
          ["att-2", "att-4", "att-5"],
          false,
        ),
      ).toEqual(["att-1", "att-3"]);
    });
  });

  describe("areAllAttendanceIdsSelected", () => {
    it("mengembalikan false ketika currentPageIds kosong", () => {
      expect(areAllAttendanceIdsSelected(["att-1"], [])).toBe(false);
    });

    it("mengembalikan true hanya saat semua id halaman aktif terpilih", () => {
      expect(
        areAllAttendanceIdsSelected(
          ["att-1", "att-2", "att-3"],
          ["att-2", "att-3"],
        ),
      ).toBe(true);

      expect(
        areAllAttendanceIdsSelected(["att-1", "att-2"], ["att-2", "att-3"]),
      ).toBe(false);
    });
  });
});
