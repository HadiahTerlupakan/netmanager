# Design Document: Void/Cancel Paid Invoice Feature

**Date**: 2026-02-25
**Author**: Antigravity (Sisyphus-Junior)
**Status**: Approved

## 1. Overview
This feature allows administrators to void or cancel an invoice that has already been marked as `PAID` or `PARTIAL_PAID`. Voiding an invoice will refund associated payments, cancel the invoice, rollback the customer's `jatuhTempo` (due date), and potentially isolate the customer's service.

## 2. Architecture
- **Module**: `finance`
- **Service**: `VoidInvoiceService` (New)
- **API Endpoint**: `POST /api/admin/invoices/[id]/void` (New)
- **Database**: 
  - `prismaBilling` (Billing DB): Invoice and Payment status updates.
  - `prisma` (Main DB): Pelanggan (customer) updates.

## 3. Data Flow & Logic

### 3.1 VoidInvoiceService.voidInvoice
1. **Find & Validate**:
   - Retrieve invoice with its payments from `prismaBilling`.
   - Throw error if invoice not found or status not in `PAID`, `PARTIAL_PAID`.
2. **Billing Transaction (`prismaBilling.$transaction`)**:
   - Update Invoice:
     - `status`: `CANCELLED`
     - `paidAmount`: `0`
     - `notes`: Append void reason.
   - Update Payments:
     - Set `gatewayStatus` to `REFUNDED` for all payments linked to this invoice.
3. **Main DB Updates**:
   - Find `Pelanggan` in `prisma`.
   - Calculate `newJatuhTempo`: `pelanggan.jatuhTempo` - 1 month.
   - If `pelanggan.status` is `AKTIF`, update to `ISOLIR`.
   - Save updates to `prisma.pelanggan`.
4. **RADIUS Sync**:
   - If customer status was changed to `ISOLIR`, invoke `RadiusSyncService.handleStatusChange(pelanggan.id, 'ISOLIR')`.
5. **Notification**:
   - Send system notification to the customer via `createNotification`.
6. **Activity Log**:
   - Log the `VOID_INVOICE` action using `logger.logActivity`.

### 3.2 API Route
- **Endpoint**: `/api/admin/invoices/[id]/void`
- **Method**: `POST`
- **Authentication**: Required (Admin).
- **Validation**: `reason` must be a non-empty string.
- **Implementation**: Uses `createHandler` from `@/lib/api`.

## 4. Implementation Details
- **Model Names**: Using `Pelanggan` model (as per `schema.prisma`).
- **Date Handling**: Using native `Date` methods for month subtraction.
- **Error Handling**: Wrapped in try/catch with standardized API responses.

## 5. Exports
- `VoidInvoiceService` will be exported from `modules/finance/index.ts`.
