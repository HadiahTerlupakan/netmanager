import type { NotificationEntity } from "../entities/NotificationEntity";

export interface NotificationFilters {
  userId?: string;
  type?: string;
  isRead?: boolean;
  skip?: number;
  take?: number;
}

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  priority?: string;
  link?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface CreateFullNotificationInput {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  link?: string | null;
  userId?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  tenantId?: string | null;
}

export interface INotificationRepository {
  findByUserId(
    userId: string,
    filters?: Omit<NotificationFilters, "userId">,
  ): Promise<{ data: NotificationEntity[]; total: number }>;
  findById(id: string): Promise<NotificationEntity | null>;
  create(data: CreateNotificationInput): Promise<NotificationEntity>;
  markAsRead(id: string): Promise<NotificationEntity>;
  markAllAsRead(userId: string): Promise<{ count: number }>;
  delete(id: string): Promise<NotificationEntity>;
  deleteAllByUserId(userId: string): Promise<{ count: number }>;
  countUnread(userId: string): Promise<number>;
  getCounts(userId: string): Promise<{ total: number; unread: number }>;
  createFull(data: CreateFullNotificationInput): Promise<NotificationEntity>;
}
