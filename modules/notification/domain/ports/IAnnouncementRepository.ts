import type {
  AnnouncementEditEntity,
  AnnouncementEntity,
  AnnouncementExistenceEntity,
  AnnouncementListItemEntity,
  AnnouncementReaderEntity,
  AnnouncementReaderNameEntity,
  AnnouncementReadEntity,
  AnnouncementSummaryEntity,
  AnnouncementTargetAudience,
} from "../entities/AnnouncementEntity";

type AnnouncementFieldFilter<TValue> = {
  in?: TValue[];
  lte?: TValue;
  gte?: TValue;
};

export interface AnnouncementRepositoryWhere {
  target?:
    | AnnouncementTargetAudience
    | AnnouncementFieldFilter<AnnouncementTargetAudience>;
  isActive?: boolean;
  tenantId?: string;
  startDate?: AnnouncementFieldFilter<Date>;
  endDate?: null | AnnouncementFieldFilter<Date>;
  OR?: AnnouncementRepositoryWhere[];
}

export interface AnnouncementCreateRepositoryInput {
  id: string;
  title: string;
  content: string;
  target: AnnouncementTargetAudience;
  isActive: boolean;
  isPinned: boolean;
  startDate: Date;
  endDate: Date | null;
  createdBy: string;
  updatedAt: Date;
}

export interface AnnouncementUpdateRepositoryInput {
  title?: string;
  content?: string;
  target?: AnnouncementTargetAudience;
  isActive?: boolean;
  isPinned?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface IAnnouncementRepository {
  /** Ambil announcement untuk form edit. */
  findEditById(id: string): Promise<AnnouncementEditEntity | null>;

  /** Ambil daftar announcement untuk listing route. */
  findMany?(params: {
    where: AnnouncementRepositoryWhere;
    includeReadCount?: boolean;
  }): Promise<AnnouncementListItemEntity[]>;

  /** Membuat announcement baru. */
  create?(data: AnnouncementCreateRepositoryInput): Promise<AnnouncementEntity>;

  /** Memperbarui announcement yang ada. */
  update?(
    id: string,
    data: AnnouncementUpdateRepositoryInput,
  ): Promise<AnnouncementEntity>;

  /** Menghapus announcement berdasarkan id. */
  delete?(id: string): Promise<void>;

  /** Memastikan announcement tersedia. */
  findExistingById?(id: string): Promise<AnnouncementExistenceEntity | null>;

  /** Memastikan announcement tersedia dalam tenant. */
  findExistingByIdAndTenant?(
    id: string,
    tenantId: string | null,
  ): Promise<AnnouncementExistenceEntity | null>;

  /** Menandai announcement dibaca oleh user. */
  upsertUserRead?(input: {
    announcementId: string;
    userId: string;
    portal: string;
    tenantId?: string;
  }): Promise<AnnouncementReadEntity>;

  /** Menandai announcement dibaca oleh pelanggan. */
  upsertCustomerRead?(input: {
    announcementId: string;
    pelangganId: string;
    portal: string;
  }): Promise<AnnouncementReadEntity>;

  /** Hitung total pembaca announcement. */
  countReads?(announcementId: string): Promise<number>;

  /** Ambil pembaca terbaru announcement. */
  findRecentReaders?(
    announcementId: string,
    limit: number,
  ): Promise<AnnouncementReaderEntity[]>;

  /** Ambil ringkasan announcement untuk statistik. */
  findSummaryById?(id: string): Promise<AnnouncementSummaryEntity | null>;

  /** Ambil nama user pembaca. */
  findUserNames?(userIds: string[]): Promise<AnnouncementReaderNameEntity[]>;

  /** Ambil nama pelanggan pembaca. */
  findCustomerNames?(
    pelangganIds: string[],
  ): Promise<AnnouncementReaderNameEntity[]>;
}

export function requireAnnouncementRepositoryMethod<TReturn>(
  method: TReturn | undefined,
  methodName: string,
): TReturn {
  if (method) {
    return method;
  }

  throw new Error(
    `AnnouncementRepository method is not implemented: ${methodName}`,
  );
}
