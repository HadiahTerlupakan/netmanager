import type { DashboardSection } from "@/lib/dashboard/contracts";

export type CustomerDashboardProfileData = {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  email: string | null;
  noTelp: string | null;
  alamat: string | null;
  status: string;
  tipe: string;
  tanggalAktif: Date | string;
  jatuhTempo: Date | string;
  lokasi: {
    provinsi: string | null;
    kabupatenKota: string | null;
    kecamatan: string | null;
    kelurahanDesa: string | null;
  };
  preferences: {
    is2FAEnabled: boolean;
    isBillNotifEnabled: boolean;
    isPromoEnabled: boolean;
  };
  paket: {
    nama: string;
    harga: unknown;
    durasi: number;
    kecepatan: string | null;
    bandwidth: {
      nama: string;
      download: unknown;
      upload: unknown;
    } | null;
  } | null;
};

export type CustomerDashboardConnectionData = {
  isOnline: boolean;
  ipAddress: string | null;
  nasipaddress: string | null;
  sessionId: string | null;
  sessionStart: Date | null;
  sessionDuration: number;
  sessionDurationFormatted: string | null;
  lastSeen: Date | null;
};

export type CustomerDashboardBillingData = {
  outstandingCount: number;
  outstandingAmount: number;
  nearestDueDate: string | null;
  hasOverdue: boolean;
};

export type CustomerDashboardViewModel = {
  profile: DashboardSection<CustomerDashboardProfileData>;
  connection: DashboardSection<CustomerDashboardConnectionData>;
  billing: DashboardSection<CustomerDashboardBillingData>;
};
