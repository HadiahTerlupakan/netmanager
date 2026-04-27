export interface NotificationEntity {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  userId: string | null;
  departmentId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
  readAt: Date | null;
  siteId: string | null;
  tenantId: string | null;
}
