# NetManager Missing API Endpoints Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for missing API endpoints in the NetManager project. The plan is structured in phases based on priority and dependencies, ensuring incremental development and testing.

## Current State Analysis

### Existing Infrastructure
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with session-based auth
- **API Patterns**: RESTful endpoints with consistent error handling
- **Existing Models**: Comprehensive schema for ISP management
- **Current Endpoints**: Basic CRUD for most entities

### Key Findings
1. **Payment Model Exists**: Basic `Payment` model is present but lacks comprehensive billing endpoints
2. **Employee Management**: Partial implementation exists (ID generation, basic relations)
3. **ONU Management**: Bulk operations exist, individual CRUD missing
4. **Work Orders**: Advanced features like templates and SLA missing
5. **Network Monitoring**: Basic health checks exist, performance monitoring missing

## Database Schema Additions Needed

### 1. Enhanced Billing & Payment Models

```prisma
model Invoice {
  id                String    @id @default(cuid())
  invoiceNumber     String    @unique
  pelangganId       String
  issueDate         DateTime  @default(now())
  dueDate           DateTime
  periodStartDate   DateTime
  periodEndDate     DateTime
  subtotal          BigInt    @default(0)
  taxAmount         BigInt    @default(0)
  discountAmount    BigInt    @default(0)
  totalAmount       BigInt    @default(0)
  status            InvoiceStatus @default(DRAFT)
  paymentStatus     PaymentStatus @default(UNPAID)
  items            InvoiceItem[]
  payments         Payment[]
  notes            String?
  generatedBy      String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  pelanggan         Pelanggan @relation(fields: [pelangganId], references: [id], onDelete: Cascade)
  generatedByUser  User?     @relation("InvoiceGeneratedBy", fields: [generatedBy], references: [id])
  
  @@index([pelangganId])
  @@index([status])
  @@index([paymentStatus])
  @@index([dueDate])
}

model InvoiceItem {
  id          String  @id @default(cuid())
  invoiceId   String
  description String
  quantity    Int     @default(1)
  unitPrice   BigInt
  totalPrice  BigInt
  itemType    String  // 'SERVICE', 'INSTALLATION', 'EQUIPMENT', 'OTHER'
  
  invoice     Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  
  @@index([invoiceId])
}

enum InvoiceStatus {
  DRAFT
  SENT
  VIEWED
  OVERDUE
  PAID
  CANCELLED
}

enum PaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID
  OVERPAID
  REFUNDED
}
```

### 2. Enhanced Customer Usage & Suspension

```prisma
model CustomerUsage {
  id              String    @id @default(cuid())
  pelangganId      String
  period          String    // Format: YYYY-MM
  downloadBytes   BigInt    @default(0)
  uploadBytes     BigInt    @default(0)
  totalBytes      BigInt    @default(0)
  sessionTime     BigInt    @default(0) // in seconds
  sessionCount    Int       @default(0)
  recordedAt      DateTime  @default(now())
  
  pelanggan       Pelanggan @relation(fields: [pelangganId], references: [id], onDelete: Cascade)
  
  @@unique([pelangganId, period])
  @@index([period])
}

model ServiceSuspension {
  id              String           @id @default(cuid())
  pelangganId      String
  suspensionType   SuspensionType
  reason           String
  startDate        DateTime
  endDate          DateTime?
  isActive         Boolean          @default(true)
  restoredAt       DateTime?
  restoredBy       String?
  notes            String?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  
  pelanggan        Pelanggan        @relation(fields: [pelangganId], references: [id], onDelete: Cascade)
  restoredByUser   User?            @relation("SuspensionRestoredBy", fields: [restoredBy], references: [id])
  
  @@index([pelangganId])
  @@index([isActive])
  @@index([suspensionType])
}

enum SuspensionType {
  NON_PAYMENT
  VIOLATION
  MAINTENANCE
  REQUESTED
  TECHNICAL
}
```

### 3. Enhanced Work Order Management

```prisma
model WorkOrderTemplate {
  id              String    @id @default(cuid())
  name            String    @unique
  description     String
  type            WorkOrderType
  priority        WorkOrderPriority @default(NORMAL)
  estimatedHours  Float?
  requiredItems   Json?     // List of required materials
  checklist       Json?     // Template checklist
  departmentId    String?
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  department      Department? @relation(fields: [departmentId], references: [id])
  workOrders      WorkOrder[]
  
  @@index([type])
  @@index([departmentId])
  @@index([isActive])
}

model SLA {
  id              String    @id @default(cuid())
  name            String    @unique
  workOrderType   WorkOrderType
  priority        WorkOrderPriority
  responseTime    Int       // in minutes
  resolutionTime  Int       // in minutes
  businessHours   Boolean   @default(true)
  description     String?
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([workOrderType])
  @@index([priority])
  @@index([isActive])
}

model WorkOrderEscalation {
  id              String    @id @default(cuid())
  workOrderId      String
  escalationLevel  Int
  escalatedTo      String    // Employee ID or Department ID
  escalatedBy      String    // Employee ID
  reason           String
  escalatedAt      DateTime  @default(now())
  acknowledgedAt   DateTime?
  resolvedAt       DateTime?
  
  workOrder        WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  escalatedToEmp   Employee? @relation("EscalatedToEmployee", fields: [escalatedTo], references: [id])
  escalatedByEmp   Employee? @relation("EscalatedByEmployee", fields: [escalatedBy], references: [id])
  
  @@index([workOrderId])
  @@index([escalationLevel])
}
```

### 4. Network Performance Monitoring

```prisma
model NetworkPerformance {
  id              String    @id @default(cuid())
  deviceId        String    // OLT, MikroTik Router ID
  deviceType      String    // 'OLT', 'MIKROTIK', 'OTHER'
  metricType      String    // 'CPU', 'MEMORY', 'BANDWIDTH', 'LATENCY', 'PACKET_LOSS'
  metricValue     Float
  unit            String    // '%', 'ms', 'Mbps', etc.
  recordedAt      DateTime  @default(now())
  
  @@index([deviceId, metricType, recordedAt])
  @@index([recordedAt])
}

model NetworkAlert {
  id              String          @id @default(cuid())
  deviceId        String
  deviceType      String
  alertType       String          // 'THRESHOLD', 'DOWN', 'HIGH_LATENCY', etc.
  severity        AlertSeverity   @default(MEDIUM)
  message         String
  isActive        Boolean         @default(true)
  triggeredAt     DateTime        @default(now())
  resolvedAt      DateTime?
  resolvedBy      String?
  acknowledgedBy  String?
  acknowledgedAt  DateTime?
  
  resolvedByUser  User?           @relation("AlertResolvedBy", fields: [resolvedBy], references: [id])
  acknowledgedByUser User?        @relation("AlertAcknowledgedBy", fields: [acknowledgedBy], references: [id])
  
  @@index([deviceId, isActive])
  @@index([severity])
  @@index([triggeredAt])
}

enum AlertSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### 5. Configuration Backup & Restore

```prisma
model DeviceBackup {
  id              String    @id @default(cuid())
  deviceId        String    // OLT, MikroTik Router ID
  deviceType      String    // 'OLT', 'MIKROTIK'
  backupType      String    // 'FULL', 'CONFIG_ONLY', 'USERS_ONLY'
  filePath        String
  fileSize        Int
  checksum        String
  backupDate      DateTime  @default(now())
  createdBy       String?
  description     String?
  isAutomatic     Boolean   @default(false)
  
  createdByUser   User?     @relation("BackupCreatedBy", fields: [createdBy], references: [id])
  
  @@index([deviceId, backupDate])
  @@index([backupType])
  @@index([isAutomatic])
}

model ConfigurationRestore {
  id              String    @id @default(cuid())
  deviceId        String
  deviceType      String
  backupId        String
  restoreDate     DateTime  @default(now())
  status          String    // 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
  restoredBy      String?
  errorMessage    String?
  rollbackAvailable Boolean   @default(false)
  
  backup          DeviceBackup @relation(fields: [backupId], references: [id])
  restoredByUser  User?        @relation("RestorePerformedBy", fields: [restoredBy], references: [id])
  
  @@index([deviceId])
  @@index([status])
  @@index([restoreDate])
}
```

### 6. Advanced Notification System

```prisma
model NotificationTemplate {
  id              String    @id @default(cuid())
  name            String    @unique
  type            String    // 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP'
  category        String    // 'BILLING', 'WORK_ORDER', 'NETWORK', 'SYSTEM'
  subject         String?
  bodyTemplate    String
  variables       Json?     // Template variables description
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([type])
  @@index([category])
  @@index([isActive])
}

model SMSTemplate {
  id              String    @id @default(cuid())
  name            String    @unique
  content         String    // SMS template with variables
  variables       Json?     // Description of template variables
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([isActive])
}

model WebhookConfig {
  id              String    @id @default(cuid())
  name            String    @unique
  url             String
  method          String    @default("POST")
  headers         Json?
  events          String[]  // Array of events to trigger webhook
  isActive        Boolean   @default(true)
  secret          String?   // For webhook verification
  retryCount      Int       @default(3)
  timeout         Int       @default(30000) // 30 seconds
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([isActive])
}
```

## High Priority Endpoints Implementation Plan

### 1. Billing and Payment Management

#### 1.1 Invoice Management
**Endpoints:**
- `GET /api/invoices` - List invoices with filtering and pagination
- `POST /api/invoices` - Create new invoice
- `GET /api/invoices/[id]` - Get invoice details
- `PUT /api/invoices/[id]` - Update invoice
- `DELETE /api/invoices/[id]` - Delete invoice
- `POST /api/invoices/[id]/send` - Send invoice to customer
- `GET /api/invoices/[id]/pdf` - Generate PDF invoice

**Request/Response Schemas:**
```typescript
// GET /api/invoices
interface InvoiceListQuery {
  page?: number;
  limit?: number;
  status?: InvoiceStatus | InvoiceStatus[];
  paymentStatus?: PaymentStatus | PaymentStatus[];
  pelangganId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  pelangganId: string;
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    email: string;
  };
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  items: InvoiceItem[];
}

// POST /api/invoices
interface CreateInvoiceRequest {
  pelangganId: string;
  issueDate: string;
  dueDate: string;
  periodStartDate: string;
  periodEndDate: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: string;
    itemType: string;
  }[];
  notes?: string;
}
```

**Database Operations:**
- Create invoices with automatic calculation
- Generate invoice numbers with sequential pattern
- Link to customer data
- Handle tax calculations
- Support recurring invoice generation

**Authentication/Authorization:**
- Required: Admin, Billing Manager roles
- Customer access: Only own invoices via `/api/customer/invoices`

**Dependencies:**
- Customer management (existing)
- Payment gateway integration (existing)
- PDF generation library

#### 1.2 Payment Processing
**Endpoints:**
- `GET /api/payments` - List payments with filtering
- `POST /api/payments` - Record new payment
- `GET /api/payments/[id]` - Get payment details
- `PUT /api/payments/[id]` - Update payment
- `POST /api/payments/[id]/verify` - Verify payment
- `POST /api/payments/[id]/refund` - Process refund
- `GET /api/payments/methods` - Get available payment methods

**Request/Response Schemas:**
```typescript
interface CreatePaymentRequest {
  pelangganId: string;
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
  invoiceIds?: string[]; // Link to specific invoices
}

interface PaymentResponse {
  id: string;
  pelangganId: string;
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  verifiedAt?: string;
  verifiedBy?: string;
  invoices: Invoice[];
}
```

#### 1.3 Payment History & Analytics
**Endpoints:**
- `GET /api/payments/history/[pelangganId]` - Customer payment history
- `GET /api/billing/analytics` - Billing analytics and reports
- `GET /api/billing/ar-aging` - Accounts receivable aging report
- `GET /api/billing/revenue` - Revenue reports

### 2. Advanced Customer Management

#### 2.1 Customer Usage Statistics
**Endpoints:**
- `GET /api/customers/[id]/usage` - Get customer usage statistics
- `GET /api/customers/[id]/usage/history` - Historical usage data
- `POST /api/customers/[id]/usage/record` - Record usage data
- `GET /api/customers/[id]/usage/current` - Current month usage

**Request/Response Schemas:**
```typescript
interface CustomerUsageResponse {
  period: string;
  downloadBytes: string;
  uploadBytes: string;
  totalBytes: string;
  sessionTime: number;
  sessionCount: number;
  dailyUsage: {
    date: string;
    download: string;
    upload: string;
  }[];
}
```

#### 2.2 Service Suspension Management
**Endpoints:**
- `GET /api/customers/[id]/suspensions` - Get suspension history
- `POST /api/customers/[id]/suspend` - Suspend service
- `POST /api/customers/[id]/restore` - Restore suspended service
- `GET /api/suspensions` - List all suspensions
- `PUT /api/suspensions/[id]` - Update suspension record

**Request/Response Schemas:**
```typescript
interface SuspendServiceRequest {
  suspensionType: SuspensionType;
  reason: string;
  endDate?: string;
  notes?: string;
}

interface SuspensionResponse {
  id: string;
  suspensionType: SuspensionType;
  reason: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  restoredAt?: string;
}
```

### 3. Complete Employee Management

#### 3.1 Full CRUD Operations
**Endpoints:**
- `GET /api/employees` - List employees with filtering
- `POST /api/employees` - Create new employee

**Request/Response Schemas:**
```typescript
interface CreateEmployeeRequest {
  employeeId: string;
  fullName: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  positionId?: string;
  siteId?: string;
  joinDate: string;
  // Personal Information
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE';
  idCardNumber?: string;
  address?: string;
  // Employment Details
  employmentStatus?: 'PROBATION' | 'PERMANENT' | 'CONTRACT';
  probationEndDate?: string;
  // Bank Information
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  npwp?: string;
  // Emergency Contact
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
}

interface EmployeeResponse {
  id: string;
  employeeId: string;
  fullName: string;
  email?: string;
  phone?: string;
  department?: {
    id: string;
    name: string;
  };
  position?: {
    id: string;
    title: string;
  };
  site?: {
    id: string;
    name: string;
  };
  joinDate: string;
  status: string;
  isActive: boolean;
  user?: {
    id: string;
    email: string;
  };
}
```

### 4. Individual ONU CRUD Operations

#### 4.1 Individual ONU Management
**Endpoints:**
- `GET /api/onus/[id]` - Get individual ONU details
- `PUT /api/onus/[id]` - Update ONU configuration
- `DELETE /api/onus/[id]` - Delete ONU
- `POST /api/onus/[id]/reboot` - Reboot ONU
- `POST /api/onus/[id]/reset` - Factory reset ONU
- `GET /api/onus/[id]/status` - Get real-time ONU status
- `GET /api/onus/[id]/history` - ONU configuration history

**Request/Response Schemas:**
```typescript
interface UpdateONURequest {
  name?: string;
  description?: string;
  pppoe?: string;
  // Additional ONU-specific configuration
}

interface ONUResponse {
  id: string;
  oltId: string;
  name: string;
  description?: string;
  pppoe?: string;
  gponOnu: string;
  status: string;
  rxOlt?: string;
  rxOnu?: string;
  serialNumber?: string;
  actualType?: string;
  lastUpdate: string;
}
```

## Medium Priority Endpoints Implementation Plan

### 1. Advanced Work Order Management

#### 1.1 Work Order Templates
**Endpoints:**
- `GET /api/work-orders/templates` - List templates
- `POST /api/work-orders/templates` - Create template
- `GET /api/work-orders/templates/[id]` - Get template
- `PUT /api/work-orders/templates/[id]` - Update template
- `DELETE /api/work-orders/templates/[id]` - Delete template
- `POST /api/work-orders/from-template` - Create work order from template

#### 1.2 SLA Management
**Endpoints:**
- `GET /api/work-orders/sla` - List SLA rules
- `POST /api/work-orders/sla` - Create SLA rule
- `GET /api/work-orders/sla/[id]` - Get SLA rule
- `PUT /api/work-orders/sla/[id]` - Update SLA rule
- `DELETE /api/work-orders/sla/[id]` - Delete SLA rule
- `GET /api/work-orders/[id]/sla-status` - Check SLA compliance

#### 1.3 Work Order Escalation
**Endpoints:**
- `GET /api/work-orders/[id]/escalations` - Get escalation history
- `POST /api/work-orders/[id]/escalate` - Escalate work order
- `PUT /api/escalations/[id]/acknowledge` - Acknowledge escalation
- `PUT /api/escalations/[id]/resolve` - Resolve escalation

### 2. Network Performance Monitoring and Alerts

#### 2.1 Performance Metrics
**Endpoints:**
- `GET /api/network/performance` - Get performance metrics
- `POST /api/network/performance` - Record performance data
- `GET /api/network/performance/[deviceId]` - Device-specific metrics
- `GET /api/network/performance/[deviceId]/history` - Historical data
- `GET /api/network/performance/dashboard` - Dashboard data

#### 2.2 Alert Management
**Endpoints:**
- `GET /api/network/alerts` - List active alerts
- `POST /api/network/alerts` - Create alert
- `GET /api/network/alerts/[id]` - Get alert details
- `PUT /api/network/alerts/[id]/acknowledge` - Acknowledge alert
- `PUT /api/network/alerts/[id]/resolve` - Resolve alert
- `GET /api/network/alerts/rules` - Get alert rules
- `POST /api/network/alerts/rules` - Create alert rule

### 3. Configuration Backup/Restore for Network Equipment

#### 3.1 Backup Management
**Endpoints:**
- `GET /api/network/backups` - List backups
- `POST /api/network/backups` - Create backup
- `GET /api/network/backups/[id]` - Get backup details
- `DELETE /api/network/backups/[id]` - Delete backup
- `POST /api/network/devices/[deviceId]/backup` - Backup specific device
- `GET /api/network/backups/[id]/download` - Download backup file

#### 3.2 Restore Operations
**Endpoints:**
- `GET /api/network/restores` - List restore operations
- `POST /api/network/restores` - Start restore operation
- `GET /api/network/restores/[id]` - Get restore status
- `POST /api/network/restores/[id]/rollback` - Rollback restore
- `GET /api/network/devices/[deviceId]/restore-points` - Available restore points

### 4. Advanced Notification System

#### 4.1 SMS Notifications
**Endpoints:**
- `GET /api/notifications/sms/templates` - List SMS templates
- `POST /api/notifications/sms/templates` - Create SMS template
- `PUT /api/notifications/sms/templates/[id]` - Update template
- `DELETE /api/notifications/sms/templates/[id]` - Delete template
- `POST /api/notifications/sms/send` - Send SMS
- `GET /api/notifications/sms/history` - SMS history

#### 4.2 Push Notifications
**Endpoints:**
- `POST /api/notifications/push/subscribe` - Subscribe to push notifications
- `DELETE /api/notifications/push/unsubscribe` - Unsubscribe
- `POST /api/notifications/push/send` - Send push notification
- `GET /api/notifications/push/history` - Push notification history
- `PUT /api/notifications/push/settings` - Update push settings

## Low Priority Endpoints Implementation Plan

### 1. System Maintenance

#### 1.1 Database Backup/Restore
**Endpoints:**
- `POST /api/system/backup/database` - Create database backup
- `GET /api/system/backups` - List database backups
- `POST /api/system/restore/database` - Restore database
- `GET /api/system/backups/[id]/download` - Download backup
- `DELETE /api/system/backups/[id]` - Delete backup

#### 1.2 Logs Viewer
**Endpoints:**
- `GET /api/system/logs` - List available log files
- `GET /api/system/logs/[filename]` - Get log file content
- `GET /api/system/logs/search` - Search in logs
- `POST /api/system/logs/clear` - Clear old logs
- `GET /api/system/logs/stats` - Log statistics

### 2. Integration APIs

#### 2.1 Webhooks
**Endpoints:**
- `GET /api/webhooks` - List webhook configurations
- `POST /api/webhooks` - Create webhook
- `GET /api/webhooks/[id]` - Get webhook details
- `PUT /api/webhooks/[id]` - Update webhook
- `DELETE /api/webhooks/[id]` - Delete webhook
- `POST /api/webhooks/[id]/test` - Test webhook
- `GET /api/webhooks/logs` - Webhook delivery logs

#### 2.2 Third-party Integrations
**Endpoints:**
- `GET /api/integrations` - List available integrations
- `POST /api/integrations/connect` - Connect to third-party service
- `DELETE /api/integrations/[id]` - Disconnect integration
- `GET /api/integrations/[id]/status` - Check integration status
- `POST /api/integrations/[id]/sync` - Sync data with integration

## Consistent Patterns and Error Handling Approach

### 1. API Response Structure

All endpoints should follow this consistent response structure:

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}
```

### 2. Authentication Pattern

```typescript
// Standard authentication check
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Proceed with authenticated logic
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

### 3. Error Handling Pattern

```typescript
// Consistent error handling
const handleApiError = (error: any, context: string) => {
  console.error(`[${context}] Error:`, error);
  
  if (error.code === 'P2002') {
    return NextResponse.json(
      { success: false, error: 'Resource already exists' },
      { status: 409 }
    );
  }
  
  if (error.code === 'P2025') {
    return NextResponse.json(
      { success: false, error: 'Resource not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json(
    { success: false, error: 'Internal Server Error' },
    { status: 500 }
  );
};
```

### 4. Validation Pattern

```typescript
// Input validation using Zod
import { z } from 'zod';

const createInvoiceSchema = z.object({
  pelangganId: z.string().min(1, 'Customer ID is required'),
  issueDate: z.string().datetime('Invalid date format'),
  dueDate: z.string().datetime('Invalid date format'),
  items: z.array(z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(1, 'Quantity must be positive'),
    unitPrice: z.string().min(1, 'Unit price is required'),
    itemType: z.string().min(1, 'Item type is required'),
  })).min(1, 'At least one item is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createInvoiceSchema.parse(body);
    // Proceed with validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    // Handle other errors
  }
}
```

### 5. Database Transaction Pattern

```typescript
// Consistent transaction handling
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const result = await prisma.$transaction(async (tx) => {
      // Create main record
      const invoice = await tx.invoice.create({
        data: { /* invoice data */ },
      });
      
      // Create related records
      for (const item of body.items) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            ...item
          }
        });
      }
      
      // Update customer status if needed
      await tx.pelanggan.update({
        where: { id: body.pelangganId },
        data: { /* update data */ }
      });
      
      return invoice;
    });
    
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Invoice created successfully'
    });
  } catch (error) {
    return handleApiError(error, 'CREATE_INVOICE');
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
1. **Database Schema Updates**
   - Add new models to Prisma schema
   - Run database migrations
   - Update TypeScript types

2. **Core Infrastructure**
   - Implement base API patterns
   - Set up validation schemas
   - Create error handling utilities

### Phase 2: High Priority - Billing (Weeks 3-5)
1. **Invoice Management**
   - CRUD operations
   - PDF generation
   - Email sending

2. **Payment Processing**
   - Payment recording
   - Payment verification
   - Refund processing

3. **Basic Analytics**
   - Revenue reports
   - AR aging

### Phase 3: High Priority - Customer & Employee Management (Weeks 6-8)
1. **Customer Usage Tracking**
   - Usage recording
   - Statistics API
   - Historical data

2. **Service Suspension**
   - Suspension workflow
   - Restoration process
   - History tracking

3. **Employee Management**
   - Complete CRUD
   - User integration
   - History tracking

4. **ONU Individual Operations**
   - Individual CRUD
   - Device control
   - Status monitoring

### Phase 4: Medium Priority - Advanced Features (Weeks 9-12)
1. **Work Order Enhancements**
   - Templates system
   - SLA management
   - Escalation workflow

2. **Network Monitoring**
   - Performance tracking
   - Alert system
   - Dashboard integration

3. **Configuration Management**
   - Backup automation
   - Restore operations
   - Scheduling

4. **Advanced Notifications**
   - SMS templates
   - Push notifications
   - Multi-channel delivery

### Phase 5: Low Priority - System & Integrations (Weeks 13-14)
1. **System Maintenance**
   - Database backup/restore
   - Log management
   - System health

2. **Integration APIs**
   - Webhook system
   - Third-party connectors
   - API documentation

## Testing Strategy

### 1. Unit Testing
- Model validation tests
- Service layer tests
- Utility function tests

### 2. Integration Testing
- API endpoint tests
- Database transaction tests
- Third-party integration tests

### 3. End-to-End Testing
- Complete workflow tests
- User journey tests
- Performance tests

## Security Considerations

### 1. Authentication & Authorization
- Role-based access control
- API rate limiting
- Session management

### 2. Data Protection
- Input validation
- SQL injection prevention
- XSS protection

### 3. Audit Trail
- Action logging
- Change tracking
- Access monitoring

## Performance Optimization

### 1. Database Optimization
- Proper indexing
- Query optimization
- Connection pooling

### 2. API Performance
- Response caching
- Pagination
- Compression

### 3. Resource Management
- File upload limits
- Memory usage optimization
- Background job processing

## Conclusion

This implementation plan provides a comprehensive roadmap for adding missing API endpoints to the NetManager project. The phased approach ensures incremental development, testing, and deployment while maintaining system stability and performance.

The plan prioritizes critical business functions (billing, customer management) while ensuring a solid foundation for advanced features. Consistent patterns and error handling approaches will maintain code quality and developer productivity throughout the implementation process.