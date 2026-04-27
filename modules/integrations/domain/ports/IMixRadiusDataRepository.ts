import type {
  MixRadiusInvoiceAverageEntity,
  MixRadiusInvoicePlanAverageEntity,
} from "../entities/MixRadiusInvoiceStatsEntity";
import type { MixRadiusOwnerGroupEntity } from "../entities/MixRadiusOwnerGroupEntity";
import type { MixRadiusSyncedCustomerEntity } from "../entities/MixRadiusSyncedCustomerEntity";
import type { PelangganLinkEntity } from "../entities/PelangganLinkEntity";

export interface UpsertMixRadiusCustomerInput {
  mixRadiusId: string;
  tenantId: string;
  username: string;
  fullName: string;
  address?: string;
  phoneNumber?: string;
  planName?: string;
  ownerName?: string;
  status?: string;
  expiredOn?: Date | null;
  lastSyncedAt: Date;
}

export interface UpsertMixRadiusInvoiceInput {
  mixRadiusId: string;
  tenantId: string;
  invoiceNumber: string;
  username: string;
  fullName: string;
  ownerName: string;
  planName: string;
  amount: number;
  status: string;
  paymentMethod: string;
  issuedDate: Date;
  dueDate: Date | null;
  expiredOn: Date | null;
  syncedAt: Date;
}

export interface IMixRadiusDataRepository {
  upsertMixRadiusCustomer(
    data: UpsertMixRadiusCustomerInput,
  ): Promise<MixRadiusSyncedCustomerEntity>;
  findPelangganByMixRadiusId(
    mixRadiusId: string,
  ): Promise<PelangganLinkEntity | null>;
  findPelangganByUsername(
    username: string,
  ): Promise<PelangganLinkEntity | null>;
  updatePelangganMixRadiusLink(
    pelangganId: string,
    mixRadiusId: string,
  ): Promise<PelangganLinkEntity>;
  updatePelangganSyncTimestamp(
    pelangganId: string,
  ): Promise<PelangganLinkEntity>;
  upsertMixRadiusInvoice(data: UpsertMixRadiusInvoiceInput): Promise<void>;
  findOwnerGroupById(
    groupId: string,
  ): Promise<MixRadiusOwnerGroupEntity | null>;
  getInvoicePlanAverages(): Promise<MixRadiusInvoicePlanAverageEntity[]>;
  getInvoiceGlobalAverage(): Promise<MixRadiusInvoiceAverageEntity>;
}
