# Planning OSP Module - Design Specification

**Date:** 2026-08-08  
**Author:** Agent (Claude)  
**Status:** Draft - Pending User Review  
**Module:** `modules/planning`

---

## Executive Summary

Modul Planning OSP (Outside Plant) adalah sistem manajemen perencanaan ekspansi infrastruktur jaringan ISP. Modul ini memungkinkan staff untuk membuat planning ekspansi area baru, Manager untuk approve/reject, tracking progress melalui kanban board, dashboard analytics, dan export PDF untuk dokumentasi.

**Key Features:**
- CRUD planning dengan approval workflow 2-tier (Staff → Manager)
- Kanban board 5 kolom (Backlog → Pending Approval → Approved → In Progress → Completed)
- Material items management (detail qty, unit, price, subtotal)
- Milestone tracking 4 fase (Survey → Procurement → Installation → Testing)
- Map picker integration (OpenLayers) untuk koordinat GPS
- File upload dokumentasi (survey photos, network diagrams)
- Audit log lengkap (field-level tracking)
- Dashboard metrics & analytics
- PDF export untuk planning detail

---

## Business Context

### Problem Statement

ISP perlu planning sistematis untuk ekspansi jaringan ke area baru (perumahan, ruko, cluster). Saat ini proses planning masih manual (spreadsheet, chat, email) yang menyebabkan:
- Data planning tersebar (lokasi, material, budget, timeline)
- Approval workflow tidak clear
- Progress tracking manual
- Tidak ada audit trail
- Estimasi budget dan material tidak terstruktur

### Solution

Modul Planning OSP yang terintegrasi dalam NetManager, dengan:
- Single source of truth untuk semua planning data
- Approval workflow terdefinisi dengan clear
- Visual progress tracking (kanban + milestone)
- Complete audit trail
- Structured material estimation
- Location-first approach (map picker hero element)

---

## Architecture Overview

### Module Structure (Clean Architecture)

```
modules/planning/
├── domain/                          # Pure domain layer
│   ├── entities/
│   │   ├── PlanningEntity.ts
│   │   ├── PlanningItemEntity.ts
│   │   ├── PlanningMilestoneEntity.ts
│   │   ├── PlanningDocumentEntity.ts
│   │   └── PlanningAuditLogEntity.ts
│   └── ports/
│       ├── IPlanningRepository.ts
│       ├── IPlanningItemRepository.ts
│       ├── IPlanningMilestoneRepository.ts
│       ├── IPlanningDocumentRepository.ts
│       └── IPlanningAuditLogRepository.ts
│
├── dto/                             # Data Transfer Objects
│   ├── PlanningDTO.ts
│   ├── PlanningItemDTO.ts
│   ├── PlanningMilestoneDTO.ts
│   ├── PlanningDocumentDTO.ts
│   ├── PlanningDashboardDTO.ts
│   └── PlanningKanbanDTO.ts
│
├── repositories/                    # Concrete implementations
│   ├── PlanningRepository.ts
│   ├── PlanningItemRepository.ts
│   ├── PlanningMilestoneRepository.ts
│   ├── PlanningDocumentRepository.ts
│   └── PlanningAuditLogRepository.ts
│
├── mappers/                         # Transformasi antar layer
│   ├── PlanningMapper.ts
│   ├── PlanningItemMapper.ts
│   ├── PlanningMilestoneMapper.ts
│   ├── PlanningDocumentMapper.ts
│   └── PlanningDashboardMapper.ts
│
├── services/                        # Business logic
│   ├── PlanningService.ts          # Core CRUD
│   ├── PlanningApprovalService.ts  # Approval workflow
│   ├── PlanningKanbanService.ts    # Kanban operations
│   ├── PlanningDashboardService.ts # Analytics
│   ├── PlanningAuditService.ts     # Audit logging
│   ├── PlanningExportService.ts    # PDF export
│   ├── PlanningServiceFactory.ts   # DI container
│   └── PlanningValidationService.ts # Zod schemas
│
├── factories/
│   ├── PlanningFactory.ts
│   └── PlanningMilestoneFactory.ts
│
├── utils/
│   ├── planningCalculations.ts
│   └── planningValidations.ts
│
├── validators/
│   ├── planningSchemas.ts
│   ├── planningItemSchemas.ts
│   └── planningMilestoneSchemas.ts
│
├── contracts.ts
└── index.ts                         # Public API
```

---

## Database Schema

### Table: `plannings`

```prisma
model Planning {
  id                     String   @id
  tenantId               String
  
  // Type & Basic Info
  type                   PlanningType  @default(OSP)
  title                  String
  description            String?       @db.Text
  
  // Location (OSP specific)
  area                   String
  coordinates            Json?         // {lat: -6.xxx, lng: 106.xxx}
  estimatedUnits         Int
  
  // Financial
  estimatedBudget        Float?
  actualBudget           Float?
  
  // Status & Workflow
  status                 PlanningStatus @default(BACKLOG)
  
  // Approval
  submittedAt            DateTime?
  submittedById          String?
  approvedAt             DateTime?
  approvedById           String?
  rejectedAt             DateTime?
  rejectedById           String?
  approvalNotes          String?       @db.Text
  
  // Tracking
  progressPercentage     Int           @default(0)
  startDate              DateTime?
  targetCompletionDate   DateTime?
  actualCompletionDate   DateTime?
  
  // Meta
  createdById            String?
  createdAt              DateTime      @default(now())
  updatedAt              DateTime      @updatedAt
  deletedAt              DateTime?
  
  // Relations
  tenant                 Tenant        @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  createdBy              User?         @relation("planning_createdByIdToUser", fields: [createdById], references: [id])
  submittedBy            User?         @relation("planning_submittedByIdToUser", fields: [submittedById], references: [id])
  approvedBy             User?         @relation("planning_approvedByIdToUser", fields: [approvedById], references: [id])
  rejectedBy             User?         @relation("planning_rejectedByIdToUser", fields: [rejectedById], references: [id])
  
  items                  PlanningItem[]
  milestones             PlanningMilestone[]
  documents              PlanningDocument[]
  auditLogs              PlanningAuditLog[]
  
  @@index([tenantId])
  @@index([status])
  @@index([type])
  @@index([createdAt])
  @@index([tenantId, status])
}

enum PlanningType {
  OSP
}

enum PlanningStatus {
  BACKLOG
  PENDING_APPROVAL
  APPROVED
  IN_PROGRESS
  COMPLETED
  REJECTED
  CANCELLED
}
```

### Table: `planning_items` (Material Details)

```prisma
model PlanningItem {
  id              String   @id
  planningId      String
  tenantId        String
  
  itemName        String
  quantity        Float
  unit            String
  unitPrice       Float
  subtotal        Float
  notes           String?  @db.Text
  
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  planning        Planning @relation(fields: [planningId], references: [id], onDelete: Cascade)
  
  @@index([planningId])
  @@index([tenantId])
}
```

### Table: `planning_milestones` (Timeline Phases)

```prisma
model PlanningMilestone {
  id                String   @id
  planningId        String
  tenantId          String
  
  name              String
  description       String?  @db.Text
  
  targetStartDate   DateTime
  targetEndDate     DateTime
  actualStartDate   DateTime?
  actualEndDate     DateTime?
  
  status            MilestoneStatus @default(PENDING)
  completionNotes   String?         @db.Text
  
  sortOrder         Int             @default(0)
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  tenant            Tenant          @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  planning          Planning        @relation(fields: [planningId], references: [id], onDelete: Cascade)
  
  @@index([planningId])
  @@index([tenantId])
}

enum MilestoneStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  BLOCKED
}
```

### Table: `planning_documents` (File Attachments)

```prisma
model PlanningDocument {
  id              String   @id
  planningId      String
  tenantId        String
  
  fileName        String
  filePath        String
  fileSize        Int
  fileType        String
  
  category        DocumentCategory
  description     String?  @db.Text
  
  uploadedById    String?
  uploadedAt      DateTime @default(now())
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  planning        Planning @relation(fields: [planningId], references: [id], onDelete: Cascade)
  uploadedBy      User?    @relation(fields: [uploadedById], references: [id])
  
  @@index([planningId])
  @@index([tenantId])
  @@index([uploadedAt])
}

enum DocumentCategory {
  SURVEY_PHOTO
  NETWORK_DIAGRAM
  TECHNICAL_DRAWING
  APPROVAL_DOCUMENT
  COMPLETION_PHOTO
  OTHER
}
```

### Table: `planning_audit_logs` (History Tracking)

```prisma
model PlanningAuditLog {
  id              String   @id
  planningId      String
  tenantId        String
  
  action          AuditAction
  fieldChanged    String?
  oldValue        String?  @db.Text
  newValue        String?  @db.Text
  notes           String?  @db.Text
  
  performedById   String?
  performedAt     DateTime @default(now())
  ipAddress       String?
  userAgent       String?
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  planning        Planning @relation(fields: [planningId], references: [id], onDelete: Cascade)
  performedBy     User?    @relation(fields: [performedById], references: [id])
  
  @@index([planningId])
  @@index([tenantId])
  @@index([performedAt])
}

enum AuditAction {
  CREATED
  UPDATED
  SUBMITTED
  APPROVED
  REJECTED
  CANCELLED
  STATUS_CHANGED
  ITEM_ADDED
  ITEM_REMOVED
  ITEM_UPDATED
  MILESTONE_UPDATED
  DOCUMENT_UPLOADED
  DOCUMENT_DELETED
}
```

---

## API Endpoints

### Public Planning Endpoints (`/api/planning`)

```
GET    /api/planning                    # List all planning
POST   /api/planning                    # Create new planning
GET    /api/planning/[id]               # Get detail
PUT    /api/planning/[id]               # Update planning
DELETE /api/planning/[id]               # Soft delete

GET    /api/planning/[id]/items         # List items
POST   /api/planning/[id]/items         # Add item
PUT    /api/planning/[id]/items/[itemId] # Update item
DELETE /api/planning/[id]/items/[itemId] # Delete item

GET    /api/planning/[id]/milestones    # List milestones
PUT    /api/planning/[id]/milestones    # Bulk update
PUT    /api/planning/[id]/milestones/[milestoneId] # Update specific

GET    /api/planning/[id]/documents     # List documents
POST   /api/planning/[id]/documents     # Upload
DELETE /api/planning/[id]/documents/[docId] # Delete

GET    /api/planning/[id]/export        # Export PDF

GET    /api/planning/kanban             # Kanban board
POST   /api/planning/kanban/move        # Move card status
```

### Admin Planning Endpoints (`/api/admin/planning`)

```
GET    /api/admin/planning              # List all (admin view)
GET    /api/admin/planning/[id]         # Admin detail
PUT    /api/admin/planning/[id]         # Admin update
DELETE /api/admin/planning/[id]         # Hard delete

GET    /api/admin/planning/dashboard    # Dashboard metrics
GET    /api/admin/planning/analytics    # Analytics
GET    /api/admin/planning/analytics/status-distribution
GET    /api/admin/planning/analytics/budget-summary
GET    /api/admin/planning/analytics/timeline-summary

POST   /api/admin/planning/approval/submit   # Submit for approval
POST   /api/admin/planning/approval/approve  # Approve
POST   /api/admin/planning/approval/reject   # Reject

POST   /api/admin/planning/[id]/cancel  # Cancel planning
GET    /api/admin/planning/audit-logs/[id] # Audit history
```

---

## Permissions (RBAC)

```typescript
const PLANNING_PERMISSIONS = {
  // Basic CRUD
  "planning:read",           // View planning list & detail
  "planning:create",         // Create new planning
  "planning:update",         // Update own planning
  "planning:delete",         // Delete own planning
  
  // Items
  "planning:items:manage",   // Add/update/delete items
  
  // Documents
  "planning:documents:upload",   // Upload documents
  "planning:documents:delete",   // Delete documents
  
  // Approval workflow
  "planning:submit",         // Submit for approval
  "planning:approve",        // Approve planning (Manager)
  "planning:reject",         // Reject planning (Manager)
  
  // Admin
  "planning:admin:read",     // View all planning
  "planning:admin:update",   // Update any planning
  "planning:admin:delete",   // Hard delete
  "planning:cancel",         // Cancel planning
  
  // Analytics
  "planning:analytics:view", // Dashboard & analytics
  "planning:audit:view",     // Audit logs
  
  // Export
  "planning:export",         // Export PDF
}
```

---

## UI/UX Flow

### Key Screens

#### 1. Dashboard View
- 4 metric cards (Total, Budget, Pending, Deadline)
- Status distribution chart
- Recent activity timeline
- Deadline pressure table

#### 2. List View
- Table layout dengan filters (status, type, date range)
- Status badges, progress bars inline
- Sortable columns
- Pagination

#### 3. Create/Edit Form
- **Map picker hero element** (50% width desktop)
- Form kiri: title, area, units, budget, dates
- Coordinates auto-populate from map click
- Multi-step: Basic Info → Items → Milestones → Review

#### 4. Detail View dengan Tabs
- Overview: key info + mini map + approval history
- Material Items: table (editable inline)
- Milestones: horizontal timeline
- Dokumentasi: grid file cards
- Audit Log: chronological timeline

#### 5. Kanban Board
- 5 columns equal width
- Drag & drop cards
- Card shows: title, ID, budget, units, deadline, progress

#### 6. Approval Workflow
- Submit button (staff)
- Approve/Reject modal (manager)
- Approval notes optional, rejection reason wajib

---

## Component Architecture

### Reuse Existing Components

```typescript
// From components/ui/
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';

// From components/common/
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import MapPicker from '@/components/common/MapPicker';
```

### New Components to Create

```typescript
// components/planning/
PlanningStatusBadge.tsx    // Extend StatusBadge untuk planning status
PlanningList.tsx           // List view dengan table
PlanningForm.tsx           // Create/edit form
PlanningDetail.tsx         // Detail view dengan tabs
PlanningKanbanBoard.tsx    // Kanban board
PlanningDashboard.tsx      // Dashboard analytics
PlanningApprovalModal.tsx  // Approve/reject modal
PlanningItemsTable.tsx     // Material items table
PlanningMilestoneTimeline.tsx // Milestone horizontal timeline
PlanningDocumentGrid.tsx   // Document cards grid
PlanningAuditTimeline.tsx  // Audit log timeline
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Target Coverage: 70% minimum**

#### Service Layer Tests
```typescript
// modules/planning/services/__tests__/PlanningService.test.ts
describe('PlanningService', () => {
  it('should create planning with valid data');
  it('should throw error if title is empty');
  it('should calculate total budget from items');
  it('should not allow duplicate planning for same area');
});

// modules/planning/services/__tests__/PlanningApprovalService.test.ts
describe('PlanningApprovalService', () => {
  it('should submit planning for approval');
  it('should approve planning and update status');
  it('should reject planning with mandatory notes');
  it('should not approve planning in wrong status');
  it('should log audit trail on approval/reject');
});
```

#### Repository Layer Tests
```typescript
// modules/planning/repositories/__tests__/PlanningRepository.test.ts
describe('PlanningRepository', () => {
  it('should create planning and return entity');
  it('should find planning by ID');
  it('should filter by status');
  it('should filter by tenantId');
  it('should soft delete planning (set deletedAt)');
});
```

### Integration Tests (Vitest + Real Test DB)

```typescript
// app/api/planning/__tests__/route.test.ts
describe('GET /api/planning', () => {
  it('should return 403 without permission');
  it('should return planning list filtered by tenantId');
  it('should return 401 if not authenticated');
});

describe('POST /api/planning', () => {
  it('should create planning with valid data');
  it('should return 400 for invalid data');
  it('should log activity after creation');
});
```

### E2E Tests (Playwright)

```typescript
// e2e/planning.spec.ts
test('Create planning flow', async ({ page }) => {
  await page.goto('/admin/planning/baru');
  await page.fill('[name="title"]', 'Ekspansi Test');
  await page.click('.map-container'); // click map
  await page.fill('[name="estimatedUnits"]', '100');
  await page.click('button:has-text("Simpan")');
  await expect(page).toHaveURL(/\/admin\/planning\/PLN-/);
});

test('Approval workflow', async ({ page }) => {
  // Submit as staff
  await loginAsStaff(page);
  await page.goto('/admin/planning/PLN-001');
  await page.click('button:has-text("Submit for Approval")');
  await expect(page.locator('[data-status="PENDING_APPROVAL"]')).toBeVisible();
  
  // Approve as manager
  await loginAsManager(page);
  await page.goto('/admin/planning/PLN-001');
  await page.click('button:has-text("Approve")');
  await page.fill('[name="notes"]', 'Approved');
  await page.click('button:has-text("Approve Planning")');
  await expect(page.locator('[data-status="APPROVED"]')).toBeVisible();
});
```

---

## Acceptance Criteria

### Must Have (MVP)

- [ ] CRUD planning (create, read, update, soft delete)
- [ ] Approval workflow (submit → approve/reject)
- [ ] Material items management (add, edit, delete, calculate subtotal)
- [ ] Milestone tracking (4 default phases, target dates, actual dates)
- [ ] Map picker integration (click to set coordinates)
- [ ] File upload (multi-file, categorization)
- [ ] Audit log (all changes tracked with field-level detail)
- [ ] Kanban board (5 columns, drag & drop)
- [ ] Dashboard (metrics, status distribution, timeline pressure)
- [ ] List view dengan filters (status, type, date range)
- [ ] Detail view dengan tabs (overview, items, milestones, docs, audit)
- [ ] Permissions enforcement (RBAC)
- [ ] PDF export (planning detail dengan items & milestones)

### Nice to Have (Fase 2)

- [ ] Notifikasi (email/WhatsApp on approval submit)
- [ ] Budget comparison chart (estimated vs actual)
- [ ] Timeline Gantt chart view
- [ ] Material template (preset item lists)
- [ ] Batch operations (bulk status change)
- [ ] Excel import/export material items
- [ ] Map layer untuk multiple plannings (cluster view)
- [ ] Mobile app view (responsive sudah ada, tapi dedicated mobile UI)

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Database schema & migrations
- [ ] Domain entities & repository interfaces
- [ ] Repository implementations
- [ ] Core service layer (PlanningService CRUD)
- [ ] Unit tests untuk services & repositories

### Phase 2: API Layer (Week 1-2)
- [ ] API routes (public & admin endpoints)
- [ ] Zod validation schemas
- [ ] API integration tests
- [ ] Service factories & DI setup

### Phase 3: UI Components (Week 2-3)
- [ ] Planning list view
- [ ] Create/edit form dengan map picker
- [ ] Detail view dengan tabs
- [ ] Material items table (editable)
- [ ] Milestone timeline component

### Phase 4: Advanced Features (Week 3-4)
- [ ] Approval workflow service & UI
- [ ] Kanban board dengan drag & drop
- [ ] Dashboard analytics
- [ ] Audit log service & UI
- [ ] File upload & management

### Phase 5: Export & Polish (Week 4)
- [ ] PDF export service (puppeteer/pdfmake)
- [ ] E2E tests (Playwright)
- [ ] Performance optimization
- [ ] Mobile responsive polish
- [ ] Documentation

---

## Risk & Mitigation

### Risk 1: Map picker performance dengan banyak markers
**Mitigation:** Clustering untuk markers, lazy load tiles, limit zoom extent

### Risk 2: PDF export timeout untuk planning besar
**Mitigation:** Background job dengan queue, pagination untuk long reports

### Risk 3: File upload size & storage
**Mitigation:** File size limit 10MB per file, compress images server-side, S3/CloudFlare R2 integration

### Risk 4: Approval workflow bottleneck (1 approver)
**Mitigation:** Multi-level approval di fase 2, notification urgent untuk pending > 3 hari

### Risk 5: Audit log table growth
**Mitigation:** Partitioning by month, archival strategy untuk audit > 1 tahun

---

## Dependencies

### External Libraries
- `ol` (OpenLayers) - ✅ sudah ada untuk MapPicker
- `@tanstack/react-query` - ✅ sudah ada untuk data fetching
- `zod` - ✅ sudah ada untuk validation
- `@dnd-kit/core` + `@dnd-kit/sortable` - 🆕 untuk kanban drag & drop
- `pdfmake` + `pdfmake-wrapper` - 🆕 untuk PDF export (client-side generation)

### Internal Modules
- `modules/database` - shared Prisma client
- `modules/events` - domain events (optional untuk notifikasi fase 2)
- `lib/auth` - authentication
- `lib/rbac` - authorization
- `lib/api` - API utilities
- `lib/logger` - activity logging
- `lib/upload` - file upload utilities (jika ada)
- `components/common/MapPicker` - existing OpenLayers integration

---

## Performance Targets

- **API Response Time:**
  - List endpoint: p95 < 200ms
  - Detail endpoint: p95 < 150ms
  - Create/Update: p95 < 300ms
  - Dashboard analytics: p95 < 500ms

- **Database Queries:**
  - Simple queries: < 10ms
  - Complex aggregations: < 100ms
  - Pagination: offset-based (limit 50 per page)

- **File Upload:**
  - Max file size: 10MB per file
  - Max files per planning: 20 files
  - Upload timeout: 30s

- **PDF Export:**
  - Generation time: < 5s untuk planning standar
  - Max size: 5MB per PDF

---

## Security Considerations

- **Authentication:** Session-based (existing)
- **Authorization:** RBAC per-endpoint (existing pattern)
- **Input Validation:** Zod schemas untuk semua input
- **SQL Injection:** Prisma ORM (parameterized queries)
- **XSS:** React auto-escaping + sanitize HTML di rich text editor (jika ada)
- **File Upload:** Validate MIME type, scan malware (ClamAV), rename files
- **Audit Trail:** IP address, User Agent, field-level changes
- **Tenant Isolation:** tenantId filter di semua queries

---

## Monitoring & Observability

- **Metrics to Track:**
  - Planning creation rate (per day)
  - Approval turnaround time (submit → approved)
  - Planning completion rate (%)
  - Budget variance (estimated vs actual)
  - File upload failures
  - PDF export errors

- **Logging:**
  - All approval actions (submit, approve, reject)
  - Planning status changes
  - File uploads/deletes
  - Export PDF requests

- **Alerts:**
  - Pending approval > 7 hari
  - PDF export timeout
  - File upload failures > 5% rate

---

## Technical Decisions (MVP)

### 1. File Storage: **Local Filesystem**
**Decision:** Local filesystem di `/uploads/planning/` untuk MVP
**Rationale:**
- Lebih simple setup (tidak perlu S3 credentials)
- Cukup untuk volume awal (< 1000 planning per tahun)
- Migration ke S3 straightforward nanti jika perlu scale
**Fase 2:** CloudFlare R2 integration untuk durability & CDN

### 2. PDF Library: **pdfmake**
**Decision:** pdfmake (client-side generation)
**Rationale:**
- Tidak perlu puppeteer (heavy dependency + resource intensive)
- Template-based, lebih maintainable
- Sudah cukup untuk business document (bukan pixel-perfect print)
**Trade-off:** Limited custom styling vs puppeteer, tapi sufficient untuk planning report

### 3. Drag-Drop Library: **@dnd-kit/core**
**Decision:** @dnd-kit/core + @dnd-kit/sortable
**Rationale:**
- Modern, actively maintained (react-beautiful-dnd deprecated)
- Better accessibility & mobile touch support
- Modular (hanya install yang dipakai)
**Learning Curve:** API berbeda dari react-beautiful-dnd, tapi documentation bagus

### 4. Notification Channel: **In-App Only (MVP)**
**Decision:** Bell icon notification di navbar, no email/WhatsApp
**Rationale:**
- Simplify MVP scope
- Infrastructure email/WhatsApp sudah ada di `modules/notification`, tinggal integrate di fase 2
**Fase 2:** Email for approval submit, WhatsApp for deadline alerts

### 5. Mobile App: **Responsive Web Only**
**Decision:** Responsive Tailwind layout, no dedicated mobile UI
**Rationale:**
- Primary use case: desktop (staff di kantor)
- Mobile view untuk approval on-the-go (manager)
- React Native view tidak worth effort untuk use case ini

---

## Open Questions for User

1. **Approval Multi-Level:** Apakah perlu approval 2-tier (Supervisor → Manager) atau cukup 1-tier (Staff → Manager)?
2. **Budget Threshold:** Apakah planning > X rupiah butuh approval khusus Director?
3. **Material Template:** Apakah ada preset material list yang sering dipakai (misal: "Paket 100 Unit Standard")?

---

## References

- **Architecture Doc:** `docs/architecture/clean-architecture.md`
- **Error Handling:** `docs/standards/error-handling.md`
- **Authorization:** `docs/standards/authorization.md`
- **Testing:** `docs/standards/testing.md`
- **Events:** `docs/standards/events.md`
- **Changelog:** `docs/CHANGELOG.md`

---

**End of Design Specification**
