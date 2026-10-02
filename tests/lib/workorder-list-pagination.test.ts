import { describe, expect, it } from "vitest";

import { BATAS_HALAMAN_WORK_ORDER, workOrderListPaginationSchema } from "@/lib/validations/workorder";

describe("workOrderListPaginationSchema", () => {
  it("memakai bawaan page 1 / limit 20 bila kosong", () => {
    expect(workOrderListPaginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("menerima limit unduh PDF (100) dan menolak di atasnya atau nilai tak sah", () => {
    expect(workOrderListPaginationSchema.parse({ page: "3", limit: String(BATAS_HALAMAN_WORK_ORDER) })).toEqual({ page: 3, limit: 100 });
    expect(workOrderListPaginationSchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(workOrderListPaginationSchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(workOrderListPaginationSchema.safeParse({ page: "abc" }).success).toBe(false);
  });
});
