/**
 * Pure support ticket domain entities for pelanggan module.
 */

export interface SupportTicketReplyEntity {
  id?: string;
  createdAt: Date;
  message: string;
  isFromAdmin: boolean;
  user?: {
    id?: string;
    name?: string | null;
    image?: string | null;
    email?: string;
  } | null;
}

export interface SupportTicketCustomerEntity {
  id?: string;
  idPelanggan?: string;
  nama: string;
  username?: string;
  email?: string | null;
  noTelp?: string | null;
  alamat?: string | null;
  status?: string;
  siteId?: string | null;
  hargaPaket?: {
    name: string;
  } | null;
}

export interface SupportTicketAssigneeEntity {
  id: string;
  name: string | null;
  email?: string;
  image?: string | null;
}

export interface SupportTicketAttachmentEntity {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSize: number | null;
}

export interface SupportTicketEntity {
  id: string;
  ticketNumber: string;
  pelangganId?: string;
  subject: string;
  description?: string | null;
  category: string;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  rating?: number | null;
  replies?: SupportTicketReplyEntity[];
  pelanggan?: SupportTicketCustomerEntity | null;
  user?: SupportTicketAssigneeEntity | null;
  assignedTo?: SupportTicketAssigneeEntity | null;
  attachments?: SupportTicketAttachmentEntity[];
  replyCount?: number;
}

export interface SupportTicketListResultEntity {
  tickets: SupportTicketEntity[];
  total: number;
}
