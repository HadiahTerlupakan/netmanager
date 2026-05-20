/**
 * Helper untuk meng-ekstrak info pelanggan MixRadius dari Work Order.
 *
 * Saat WO dibuat dari pelanggan MixRadius, kita tidak menyimpan FK ke tabel
 * `Pelanggan` (data pelanggan ada di MixRadius, bukan di DB lokal). Yang
 * tersimpan di WO hanya kolom denormalized (`contactName/contactPhone/
 * locationAddress`) plus marker `[MixRadius: <username>]` di kolom
 * `description`. Helper ini menyediakan satu sumber kebenaran untuk
 * menampilkan info pelanggan tersebut konsisten di list & detail.
 */

const MIXRADIUS_USERNAME_PATTERN = /\[MixRadius: ([^\]]+)\]/;

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
  description?: string | null;
  isInternal?: boolean | null;
}

export interface WorkOrderCustomerInfo {
  /** Sumber data: 'pelanggan' (FK lokal), 'mixradius' (dari MixRadius), 'internal' (WO internal), atau 'guest' (manual entry tanpa FK & tanpa MixRadius). */
  source: "pelanggan" | "mixradius" | "internal" | "guest";
  name: string | null;
  /** ID pelanggan untuk display (idPelanggan lokal atau username MixRadius). */
  identifier: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export function extractMixRadiusUsername(
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  const match = description.match(MIXRADIUS_USERNAME_PATTERN);
  return match?.[1]?.trim() || null;
}

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

  if (source.isInternal) {
    return {
      source: "internal",
      name: source.contactName ?? null,
      identifier: null,
      email: null,
      phone: source.contactPhone ?? null,
      address: source.locationAddress ?? null,
    };
  }

  const mixRadiusUsername = extractMixRadiusUsername(source.description);
  if (mixRadiusUsername) {
    return {
      source: "mixradius",
      name: source.contactName ?? null,
      identifier: mixRadiusUsername,
      email: null,
      phone: source.contactPhone ?? null,
      address: source.locationAddress ?? null,
    };
  }

  return {
    source: "guest",
    name: source.contactName ?? null,
    identifier: null,
    email: null,
    phone: source.contactPhone ?? null,
    address: source.locationAddress ?? null,
  };
}
