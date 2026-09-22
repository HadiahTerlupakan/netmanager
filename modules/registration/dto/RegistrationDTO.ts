import type { RegistrationStatus } from "../domain/entities/Registration";

/** DTO for registration list views. */
export interface RegistrationListItemDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  location: string | null;
  packageName: string | null;
  ipAddress: string | null;
  status: RegistrationStatus;
  notes: string | null;
  createdAt: string;
}

/** DTO for registration detail views. */
export interface RegistrationDetailDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  location: string | null;
  packageName: string | null;
  ipAddress: string | null;
  status: RegistrationStatus;
  notes: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** DTO for registration creation input. */
export interface CreateRegistrationDTO {
  name: string;
  email: string;
  phone: string;
  address: string;
  location?: string;
  packageName?: string;
  notes?: string;
  ipAddress?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  turnstileToken?: string;
}

/** DTO for registration status update input. */
export interface UpdateRegistrationStatusDTO {
  status: RegistrationStatus;
  rejectionReason?: string;
  notes?: string;
  verifiedBy?: string;
}
