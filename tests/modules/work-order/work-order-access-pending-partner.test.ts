import { describe, expect, it } from "vitest";

import { EmployeeWorkOrderQueryService } from "@/modules/work-order/services/EmployeeWorkOrderQueryService";
import { validateMobileAssignedWorkOrderAccess } from "@/modules/work-order/services/work-order-access";

const TENANT = "tenant-1";
const LEAD = "lead-1";
const PARTNER = "partner-1";
const ORANG_LAIN = "orang-lain-1";

type Assignment = { userId: string; status: string };

function buatWorkOrder(assignments: Assignment[]) {
  return {
    id: "wo-1",
    tenantId: TENANT,
    status: "IN_PROGRESS",
    assignedToId: LEAD,
    departmentId: null as string | null,
    siteId: null as string | null,
    assignments,
  };
}

function buatRepository(assignments: Assignment[]) {
  return {
    findById: async () => buatWorkOrder(assignments) as never,
  };
}

function konteks(userId: string) {
  return {
    id: userId,
    name: "Teknisi",
    role: "Teknisi",
    permissions: [] as string[],
    siteId: undefined as string | undefined,
    tenantId: TENANT,
    isSuperAdmin: false,
  };
}

const SEMUA_STATUS = [
  "REQUESTED",
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
  "CANCELLED",
];

function aksesMobile(
  userId: string,
  assignments: Assignment[],
  allowPendingInvitation?: boolean,
) {
  return validateMobileAssignedWorkOrderAccess({
    repository: buatRepository(assignments),
    workOrderId: "wo-1",
    userContext: konteks(userId),
    allowedStatuses: SEMUA_STATUS,
    invalidStatusMessage: "status tidak diizinkan",
    allowPendingInvitation,
  });
}

/**
 * Teknisi yang diundang sebagai partner menerima notifikasi undangan, tetapi
 * membuka work order-nya ditolak 403 karena akses hanya dilepas untuk lead dan
 * partner ber-status APPROVED. Akibatnya undangan harus diterima tanpa bisa
 * melihat pekerjaannya lebih dulu.
 *
 * Terpantau 102 kejadian dari 12 teknisi pada work order yang masih berjalan.
 */
describe("akses partner dengan undangan PENDING", () => {
  it("mengizinkan membaca detail work order", async () => {
    await expect(
      aksesMobile(PARTNER, [{ userId: PARTNER, status: "PENDING" }], true),
    ).resolves.toMatchObject({ id: "wo-1" });
  });

  it("tetap menolak aksi tulis", async () => {
    // Jalur aksi (update, tasks, materials) tidak meneruskan izin ini, jadi
    // undangan yang belum disetujui tidak boleh mengubah apa pun.
    await expect(
      aksesMobile(PARTNER, [{ userId: PARTNER, status: "PENDING" }]),
    ).rejects.toThrow("tidak memiliki akses");
  });

  it("tetap menolak orang yang tidak diundang sama sekali", async () => {
    await expect(
      aksesMobile(ORANG_LAIN, [{ userId: PARTNER, status: "PENDING" }], true),
    ).rejects.toThrow("tidak memiliki akses");
  });

  it("tetap menolak undangan yang sudah ditolak", async () => {
    await expect(
      aksesMobile(PARTNER, [{ userId: PARTNER, status: "REJECTED" }], true),
    ).rejects.toThrow("tidak memiliki akses");
  });

  it("tidak mengubah akses partner yang sudah APPROVED", async () => {
    await expect(
      aksesMobile(PARTNER, [{ userId: PARTNER, status: "APPROVED" }]),
    ).resolves.toMatchObject({ id: "wo-1" });
  });

  it("tidak mengubah akses lead teknisi", async () => {
    await expect(aksesMobile(LEAD, [])).resolves.toMatchObject({ id: "wo-1" });
  });
});

describe("getMobileWorkOrderDetail", () => {
  function detail(userId: string, assignments: Assignment[]) {
    const service = new EmployeeWorkOrderQueryService(
      buatRepository(assignments) as never,
    );
    return service.getMobileWorkOrderDetail("wo-1", {
      id: userId,
      name: "Teknisi",
      role: "Teknisi",
      siteId: undefined,
      tenantId: TENANT,
      isSuperAdmin: false,
    });
  }

  it("membuka detail untuk partner yang undangannya masih PENDING", async () => {
    await expect(
      detail(PARTNER, [{ userId: PARTNER, status: "PENDING" }]),
    ).resolves.toMatchObject({ id: "wo-1" });
  });

  it("tetap menolak teknisi yang tidak terkait work order", async () => {
    await expect(
      detail(ORANG_LAIN, [{ userId: PARTNER, status: "PENDING" }]),
    ).rejects.toThrow("tidak memiliki akses");
  });
});
