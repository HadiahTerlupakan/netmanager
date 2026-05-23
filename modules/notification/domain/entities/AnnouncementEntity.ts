export type AnnouncementTargetAudience =
  | "ALL"
  | "ADMIN"
  | "CUSTOMER"
  | "EMPLOYEE"
  | string;

export interface AnnouncementEditEntity {
  id: string;
  title: string;
  content: string;
  target: AnnouncementTargetAudience;
  isActive: boolean;
  isPinned: boolean;
  startDate: Date | null;
  endDate: Date | null;
}

export interface AnnouncementEntity extends AnnouncementEditEntity {
  createdAt: Date;
}

export interface AnnouncementSummaryEntity {
  id: string;
  title: string;
  target: AnnouncementTargetAudience;
}

export interface AnnouncementReaderEntity {
  userId: string | null;
  pelangganId: string | null;
  readAt: Date;
  announcementId: string;
  portal: string | null;
  tenantId: string | null;
}

export interface AnnouncementReaderNameEntity {
  id: string;
  name: string;
}

export interface AnnouncementListItemEntity extends AnnouncementEntity {
  _count?: {
    reads: number;
  };
}

export interface AnnouncementMobileItemEntity {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
}

export interface AnnouncementExistenceEntity {
  id: string;
}

export interface AnnouncementReadEntity {
  announcementId: string;
  userId: string | null;
  pelangganId: string | null;
  portal: string | null;
  tenantId: string | null;
  readAt: Date;
}
