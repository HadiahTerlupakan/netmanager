/**
 * Helper untuk menentukan info pelanggan yang ditampilkan pada Work Order.
 *
 * Sebuah WO bisa terhubung ke pelanggan lokal (FK `pelanggan`), berupa WO
 * internal, atau dibuat dalam mode guest (input manual tanpa FK). WO guest
 * hanya menyimpan kolom denormalized (`contactName/contactPhone/
 * locationAddress`). Helper ini menyediakan satu sumber kebenaran untuk
 * menampilkan info pelanggan tersebut secara konsisten di list & detail.
 */

export interface WorkOrderCustomerInfoSource {
  pelanggan?: {
    id?: string;
    idPelanggan: string;
    nama: string;
    email?: string | null;
    noTelp?: string | null;
  } | null;
  contactName?: string | null;
  contactPhone?: string | null;
  locationAddress?: string | null;
  isInternal?: boolean | null;
}

export interface WorkOrderCustomerInfo {
  /** Sumber data: 'pelanggan' (FK lokal), 'internal' (WO internal), atau 'guest' (input manual tanpa FK). */
  source: "pelanggan" | "internal" | "guest";
  name: string | null;
  /** ID pelanggan untuk display (idPelanggan lokal); null untuk WO internal & guest. */
  identifier: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

/** Tentukan sumber & info pelanggan WO untuk ditampilkan di list maupun detail. */
export function getWorkOrderCustomerInfo(
  source: WorkOrderCustomerInfoSource,
): WorkOrderCustomerInfo {
  if (source.pelanggan) {
    return {
      source: "pelanggan",
      name: source.pelanggan.nama,
      identifier: source.pelanggan.idPelanggan,
      email: source.pelanggan.email ?? null,
      phone: source.pelanggan.noTelp ?? source.contactPhone ?? null,
      address: source.locationAddress ?? null,
    };
  }

  return {
    source: source.isInternal ? "internal" : "guest",
    name: source.contactName ?? null,
    identifier: null,
    email: null,
    phone: source.contactPhone ?? null,
    address: source.locationAddress ?? null,
  };
}
