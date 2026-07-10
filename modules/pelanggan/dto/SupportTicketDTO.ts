/**
 * SupportTicket DTOs (Data Transfer Objects)
 *
 * DTOs define the shape of data for API responses and requests.
 */

import type {
  TicketCategoryValue as TicketCategory,
  TicketPriorityValue as TicketPriority,
  TicketStatusValue as TicketStatus,
} from "../types/pelanggan-types";

// ==================== Response DTOs ====================

/**
 * Minimal DTO for list views
 */
export interface TicketListItemDTO {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  // Flattened relations
  pelangganName: string | null;
  assignedToName: string | null;
  lastReplyAt: string | null;
  unreadCount: number;
  rating: number | null;
}

/**
 * Full DTO for detail views
 */
export interface TicketDetailDTO {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  rating: number | null;
  // Relations
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    email: string | null;
    noTelp: string | null;
  } | null;
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  // Messages
  messages: TicketMessageDTO[];
  // Attachments
  attachments: TicketAttachmentDTO[];
}

/**
 * DTO for ticket messages/replies
 */
export interface TicketMessageDTO {
  id: string;
  message: string;
  isFromAdmin: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    type: "admin" | "customer";
  } | null;
  attachments: TicketAttachmentDTO[];
}

/**
 * DTO for attachments
 */
export interface TicketAttachmentDTO {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSize: number | null;
}

/**
 * DTO for customer portal (simplified)
 */
export interface TicketPortalDTO {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  lastReplyAt: string | null;
  hasNewReply: boolean;
}

// ==================== Request DTOs ====================

/**
 * DTO for creating ticket
 */
export interface CreateTicketDTO {
  category: TicketCategory;
  subject: string;
  description: string;
  priority?: TicketPriority;
}

/**
 * DTO for replying to ticket
 */
export interface ReplyTicketDTO {
  message: string;
  attachmentIds?: string[];
}

/**
 * DTO for admin updating ticket
 */
export interface UpdateTicketDTO {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToId?: string | null;
}
