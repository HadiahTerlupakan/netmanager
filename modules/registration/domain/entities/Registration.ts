export const REGISTRATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "SURVEYED",
  "INSTALLED",
  "CANCELLED",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export interface Registration {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  packageName: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  ipAddress: string | null;
  status: RegistrationStatus;
  notes: string | null;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  phoneNumber: string | null;
  tenantId: string | null;
}

export interface CreateRegistrationData {
  name: string;
  email: string;
  phone: string;
  address: string;
  packageName?: string;
  location?: string;
  ipAddress?: string;
  notes?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  status: RegistrationStatus;
}

export interface UpdateRegistrationStatusData {
  status: RegistrationStatus;
  notes?: string | null;
  rejectionReason?: string | null;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
}
