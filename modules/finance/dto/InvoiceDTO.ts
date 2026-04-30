/**
 * Invoice DTOs (Data Transfer Objects)
 *
 * DTOs define the shape of data for API responses and requests.
 */

import type { InvoiceStatus } from "../types/invoice.enums";

// ==================== Response DTOs ====================

/**
 * Minimal DTO for list/table views
 */
export interface InvoiceListItemDTO {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus;
  createdAt: string;
  // Flattened relations
  pelangganName: string | null;
  pelangganId: string | null;
}

/**
 * Full DTO for detail views
 */
export interface InvoiceDetailDTO {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  // Amounts
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus;
  // Customer
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    alamat: string | null;
    noTelp: string | null;
    email: string | null;
  } | null;
  // Line items
  items: InvoiceItemDTO[];
  // Payment history
  payments: InvoicePaymentDTO[];
  // Metadata
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  paidAt: string | null;
}

/**
 * DTO for invoice line items
 */
export interface InvoiceItemDTO {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  itemType: string | null;
}

/**
 * DTO for payment records
 */
export interface InvoicePaymentDTO {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  reference: string | null;
  verified: boolean;
}

/**
 * DTO for customer portal (simplified)
 */
export interface InvoicePortalDTO {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus;
  isOverdue: boolean;
}

/**
 * DTO for billing summary
 */
export interface BillingSummaryDTO {
  totalUnpaid: number;
  totalOverdue: number;
  upcomingDue: number;
  invoiceCount: number;
  overdueCount: number;
}

// ==================== Request DTOs ====================

/**
 * DTO for creating invoice
 */
export interface CreateInvoiceDTO {
  pelangganId: string;
  dueDate: string;
  periodStart?: string;
  periodEnd?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    itemType?: string;
  }[];
  taxRate?: number;
  discountAmount?: number;
  notes?: string;
}

/**
 * DTO for recording payment
 */
export interface RecordPaymentDTO {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}
