import { describe, expect, it } from "vitest";

import { getWorkOrderCustomerInfo } from "@/modules/work-order/client";

const LINKED_PELANGGAN = {
  id: "pelanggan-1",
  idPelanggan: "PLG-001",
  nama: "Budi Santoso",
  email: "budi@example.com",
  noTelp: "081100000001",
};

describe("getWorkOrderCustomerInfo", () => {
  it("memakai data pelanggan lokal saat WO terhubung ke pelanggan", () => {
    const customerInfo = getWorkOrderCustomerInfo({
      pelanggan: LINKED_PELANGGAN,
      contactName: "Nama Kontak Lain",
      contactPhone: "081100000002",
      locationAddress: "Jl. Melati No. 1",
    });

    expect(customerInfo).toEqual({
      source: "pelanggan",
      name: "Budi Santoso",
      identifier: "PLG-001",
      email: "budi@example.com",
      phone: "081100000001",
      address: "Jl. Melati No. 1",
    });
  });

  it("memakai contactPhone saat pelanggan lokal tidak punya nomor telepon", () => {
    const customerInfo = getWorkOrderCustomerInfo({
      pelanggan: { ...LINKED_PELANGGAN, noTelp: null },
      contactPhone: "081100000002",
    });

    expect(customerInfo.phone).toBe("081100000002");
  });

  it("menandai WO internal tanpa identifier pelanggan", () => {
    const customerInfo = getWorkOrderCustomerInfo({
      pelanggan: null,
      isInternal: true,
      contactName: "Tim FOC",
      locationAddress: "Site: JKT - Jakarta",
    });

    expect(customerInfo).toEqual({
      source: "internal",
      name: "Tim FOC",
      identifier: null,
      email: null,
      phone: null,
      address: "Site: JKT - Jakarta",
    });
  });

  it("menandai WO tanpa pelanggan lokal dan bukan internal sebagai guest", () => {
    const customerInfo = getWorkOrderCustomerInfo({
      pelanggan: null,
      isInternal: false,
      contactName: "Andi",
      contactPhone: "081100000003",
      locationAddress: "Jl. Mawar No. 2",
    });

    expect(customerInfo).toEqual({
      source: "guest",
      name: "Andi",
      identifier: null,
      email: null,
      phone: "081100000003",
      address: "Jl. Mawar No. 2",
    });
  });
});
