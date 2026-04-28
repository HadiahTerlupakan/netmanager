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
