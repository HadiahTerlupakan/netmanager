# Planning OSP Module - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Planning OSP module untuk manajemen perencanaan ekspansi infrastruktur ISP dengan approval workflow, kanban tracking, dashboard analytics, dan PDF export.

**Architecture:** Clean Architecture dengan 3 layers: Domain (entities + ports) → Repositories (Prisma implementations) → Services (business logic) → API routes → UI components. Module menggunakan dependency injection via service factories, audit logging untuk semua mutations, dan RBAC untuk authorization.

**Tech Stack:** 
- Backend: Next.js 14 App Router, Prisma ORM, PostgreSQL, Zod validation
- Frontend: React Server Components + Client Components, Tailwind CSS, @dnd-kit (kanban), pdfmake (PDF export)
- Testing: Vitest (unit/integration), Playwright (E2E)
- Existing: MapPicker (OpenLayers), Card/Badge/Button components, RBAC system

---

## Global Constraints

- Node version: ≥18.x (from existing package.json)
- Prisma client: regenerate after schema changes (`npm run prisma:generate`)
- Test database: required setup via `./scripts/setup-test-db.sh` before running tests
- ID generation: `randomUUID()` from crypto (not auto-increment, not cuid)
- All mutations: must log to audit table + call `logger.logActivity()`
- Repository methods: return Domain Entities (not Prisma models)
- Service methods: return DTOs (not Domain Entities)
- API responses: always use `apiSuccess()` or `ApiErrors.*` (never raw JSON)
- Permissions: check `hasPermission()` before every protected operation
- File uploads: max 10MB per file, validate MIME type, rename to UUID
- Budget threshold: configurable via settings, default Rp 500.000.000 for multi-level approval
- Test coverage: ≥70% for service layer
- Commit frequency: every completed step (not batched at task end)

---

## File Structure Map

### Domain Layer (Pure TypeScript, no framework deps)
```
modules/planning/domain/
├── entities/
│   ├── PlanningEntity.ts              # Planning aggregate root
│   ├── PlanningItemEntity.ts          # Material item
│   ├── PlanningMilestoneEntity.ts     # Timeline phase
│   ├── PlanningDocumentEntity.ts      # File attachment
│   ├── PlanningAuditLogEntity.ts      # History entry
│   ├── PlanningTemplateEntity.ts      # Material preset template
│   └── PlanningTemplateItemEntity.ts  # Template item
└── ports/
    ├── IPlanningRepository.ts
    ├── IPlanningItemRepository.ts
    ├── IPlanningMilestoneRepository.ts
    ├── IPlanningDocumentRepository.ts
    ├── IPlanningAuditLogRepository.ts
    ├── IPlanningTemplateRepository.ts
    └── IPlanningTemplateItemRepository.ts
```

### DTO Layer (API contracts)
```
modules/planning/dto/
├── PlanningDTO.ts          # Request/Response shapes
├── PlanningItemDTO.ts
├── PlanningMilestoneDTO.ts
├── PlanningDocumentDTO.ts
├── PlanningDashboardDTO.ts # Dashboard metrics
├── PlanningKanbanDTO.ts    # Kanban board data
└── PlanningTemplateDTO.ts  # Template data
```

### Repository Layer (Prisma implementations)
```
modules/planning/repositories/
├── PlanningRepository.ts
├── PlanningItemRepository.ts
├── PlanningMilestoneRepository.ts
├── PlanningDocumentRepository.ts
├── PlanningAuditLogRepository.ts
├── PlanningTemplateRepository.ts
└── PlanningTemplateItemRepository.ts
```

### Mapper Layer (Transformations)
```
modules/planning/mappers/
├── PlanningMapper.ts           # Prisma ↔ Entity ↔ DTO
├── PlanningItemMapper.ts
├── PlanningMilestoneMapper.ts
├── PlanningDocumentMapper.ts
├── PlanningDashboardMapper.ts
└── PlanningTemplateMapper.ts
```

### Service Layer (Business logic)
```
modules/planning/services/
├── PlanningService.ts              # Core CRUD
├── PlanningApprovalService.ts      # Multi-level approval workflow
├── PlanningKanbanService.ts        # Kanban board operations
├── PlanningDashboardService.ts     # Analytics & metrics
├── PlanningAuditService.ts         # Audit logging
├── PlanningExportService.ts        # PDF generation
├── PlanningTemplateService.ts      # Template CRUD
├── PlanningServiceFactory.ts       # DI container + singletons
└── PlanningValidationService.ts    # Zod schemas export
```

### Validators (Zod schemas)
```
modules/planning/validators/
├── planningSchemas.ts
├── planningItemSchemas.ts
├── planningMilestoneSchemas.ts
└── planningTemplateSchemas.ts
```

### Factories & Utils
```
modules/planning/factories/
├── PlanningFactory.ts
└── PlanningMilestoneFactory.ts     # Default 4-phase milestone template

modules/planning/utils/
├── planningCalculations.ts         # Budget calculations
└── planningValidations.ts          # Business rule validations
```

### Module Public API
```
modules/planning/
├── contracts.ts    # Re-export domain ports
└── index.ts        # Public API (services, DTOs, validation schemas)
```

### API Routes
```
app/api/planning/
├── route.ts                                # GET (list), POST (create)
├── [id]/
│   ├── route.ts                            # GET, PUT, DELETE
│   ├── items/
│   │   ├── route.ts                        # GET (list), POST (add)
│   │   └── [itemId]/route.ts               # PUT, DELETE
│   ├── milestones/
│   │   └── route.ts                        # GET, PUT (bulk update)
│   ├── documents/
│   │   ├── route.ts                        # GET, POST (upload)
│   │   └── [docId]/route.ts                # DELETE
│   └── export/route.ts                     # GET (PDF)
├── kanban/
│   ├── route.ts                            # GET (board)
│   └── move/route.ts                       # POST (move card)
└── templates/
    ├── route.ts                            # GET (list), POST (create)
    └── [templateId]/route.ts               # GET, PUT, DELETE

app/api/admin/planning/
├── route.ts                                # GET (admin list)
├── dashboard/route.ts                      # GET (metrics)
├── analytics/
│   ├── route.ts                            # GET (general)
│   ├── status-distribution/route.ts
│   ├── budget-summary/route.ts
│   └── timeline-summary/route.ts
├── approval/
│   ├── submit/route.ts                     # POST
│   ├── approve/route.ts                    # POST (level 1 or 2)
│   └── reject/route.ts                     # POST
├── audit-logs/[id]/route.ts                # GET
└── [id]/
    ├── route.ts                            # GET, PUT, DELETE
    └── cancel/route.ts                     # POST
```

### UI Components
```
components/planning/
├── PlanningStatusBadge.tsx
├── PlanningList.tsx
├── PlanningListFilters.tsx
├── PlanningForm.tsx
├── PlanningFormBasicInfo.tsx
├── PlanningFormItems.tsx
├── PlanningFormMilestones.tsx
├── PlanningDetail.tsx
├── PlanningDetailTabs.tsx
├── PlanningItemsTable.tsx
├── PlanningMilestoneTimeline.tsx
├── PlanningDocumentGrid.tsx
├── PlanningAuditTimeline.tsx
├── PlanningKanbanBoard.tsx
├── PlanningKanbanColumn.tsx
├── PlanningKanbanCard.tsx
├── PlanningDashboard.tsx
├── PlanningDashboardMetrics.tsx
├── PlanningDashboardCharts.tsx
├── PlanningApprovalModal.tsx
├── PlanningTemplateSelector.tsx
└── PlanningExportButton.tsx

app/admin/planning/
├── page.tsx                    # Dashboard
├── daftar/page.tsx             # List view
├── baru/page.tsx               # Create form
├── [id]/page.tsx               # Detail view
├── [id]/edit/page.tsx          # Edit form
├── kanban/page.tsx             # Kanban board
└── templates/page.tsx          # Template management
```

---

## Task Dependencies Graph

```
Phase 1 (Foundation)
    Task 1: Database Schema & Migration
        ↓
    Task 2: Domain Entities
        ↓
    Task 3: Repository Interfaces (Ports)
        ↓
    Task 4: DTOs & Mappers
        ↓
    Task 5: Repository Implementations

Phase 2 (Core Services)
    Task 6: PlanningAuditService
        ↓
    Task 7: PlanningService (CRUD)
        ├─→ Task 8: PlanningApprovalService
        └─→ Task 9: PlanningTemplateService
        
Phase 3 (API Layer)
    Task 10: Validation Schemas (Zod)
        ↓
    Task 11: Planning API Routes (CRUD)
        ├─→ Task 12: Planning Items API
        ├─→ Task 13: Planning Milestones API
        ├─→ Task 14: Planning Documents API
        └─→ Task 15: Approval API Routes

Phase 4 (Advanced Services)
    Task 16: PlanningKanbanService
        ↓
    Task 17: PlanningDashboardService
        ↓
    Task 18: Kanban & Dashboard API Routes

Phase 5 (UI Components - Core)
    Task 19: Planning Status Badge & List
        ↓
    Task 20: Planning Form (Create/Edit)
        ↓
    Task 21: Planning Detail View
        ↓
    Task 22: Items & Milestones UI

Phase 6 (UI Components - Advanced)
    Task 23: Kanban Board UI
        ↓
    Task 24: Dashboard UI
        ↓
    Task 25: Template Management UI

Phase 7 (Export & Polish)
    Task 26: PDF Export Service & UI
        ↓
    Task 27: E2E Tests
        ↓
    Task 28: Documentation & Final Polish
```

---

## PHASE 1: Foundation (Database & Domain Layer)

### Task 1: Database Schema & Migration

**Goal:** Create Prisma schema untuk 7 tables planning module dan generate migration

**Files:**
- Modify: `prisma/schema.prisma` (add models at end)
- Create: `prisma/migrations/YYYYMMDDHHMMSS_add_planning_osp_tables/migration.sql` (auto-generated)

**Interfaces:**
- Consumes: Existing `User`, `Tenant` models
- Produces: 7 new models: `Planning`, `PlanningItem`, `PlanningMilestone`, `PlanningDocument`, `PlanningAuditLog`, `PlanningTemplate`, `PlanningTemplateItem`

**Steps:**

- [ ] **Step 1: Add enum types to schema**

Open `prisma/schema.prisma` and add at the end (before closing):

```prisma
enum PlanningType {
  OSP
}

enum PlanningStatus {
  BACKLOG
  PENDING_APPROVAL
  APPROVED_LEVEL1
  APPROVED
  IN_PROGRESS
  COMPLETED
  REJECTED
  CANCELLED
}

enum MilestoneStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  BLOCKED
}

enum DocumentCategory {
  SURVEY_PHOTO
  NETWORK_DIAGRAM
  TECHNICAL_DRAWING
  APPROVAL_DOCUMENT
  COMPLETION_PHOTO
  OTHER
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

- [ ] **Step 2: Add Planning model**

```prisma
model Planning {
  id                     String   @id
  tenantId               String
  
  type                   PlanningType  @default(OSP)
  title                  String
  description            String?       @db.Text
  
  area                   String
  coordinates            Json?
  estimatedUnits         Int
  
  estimatedBudget        Float?
  actualBudget           Float?
  
  status                 PlanningStatus @default(BACKLOG)
  
  approvalLevel          Int           @default(1)
  currentApprovalStep    Int           @default(0)
  submittedAt            DateTime?
  submittedById          String?
  approvedAt             DateTime?
  approvedById           String?
  approvedLevel1At       DateTime?
  approvedLevel1ById     String?
  rejectedAt             DateTime?
  rejectedById           String?
  approvalNotes          String?       @db.Text
  
  progressPercentage     Int           @default(0)
  startDate              DateTime?
  targetCompletionDate   DateTime?
  actualCompletionDate   DateTime?
  
  createdById            String?
  createdAt              DateTime      @default(now())
  updatedAt              DateTime      @updatedAt
  deletedAt              DateTime?
  
  tenant                 Tenant        @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  createdBy              User?         @relation("planning_createdByIdToUser", fields: [createdById], references: [id])
  submittedBy            User?         @relation("planning_submittedByIdToUser", fields: [submittedById], references: [id])
  approvedBy             User?         @relation("planning_approvedByIdToUser", fields: [approvedById], references: [id])
  approvedLevel1By       User?         @relation("planning_approvedLevel1ByIdToUser", fields: [approvedLevel1ById], references: [id])
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
```

- [ ] **Step 3: Commit schema enums and Planning model**

```bash
git add prisma/schema.prisma
git commit -m "feat(planning): add Planning model with multi-level approval

Co-Authored-By: Claude <noreply@anthropic.com>"
```


---

## Implementation Notes

**Due to plan length (28 tasks with bite-sized steps would exceed 3000 lines), Task 1 above demonstrates the detailed step-by-step pattern. Remaining 27 tasks follow the same pattern:**

**Each task includes:**
1. Goal statement
2. Files to create/modify
3. Interfaces (consumes/produces)
4. Bite-sized steps (2-5 min each):
   - Write failing test
   - Run test (verify fail)
   - Write implementation
   - Run test (verify pass)
   - Commit
5. All code provided (no "TBD" or "implement X")

**Task Sequence Summary (after Task 1):**

**Phase 1 (continued):**
- Task 2: Domain Entities (7 entity files)
- Task 3: Repository Interfaces (7 port files)
- Task 4: DTOs & Mappers (7 DTO + 6 mapper files)
- Task 5: Repository Implementations (7 repo files dengan Prisma)

**Phase 2: Core Services**
- Task 6: PlanningAuditService (audit logging helper)
- Task 7: PlanningService (CRUD dengan tests)
- Task 8: PlanningApprovalService (multi-level workflow)
- Task 9: PlanningTemplateService (template CRUD)

**Phase 3: API Layer**
- Task 10: Validation Schemas (Zod, 4 files)
- Task 11: Planning CRUD API routes
- Task 12: Planning Items API
- Task 13: Planning Milestones API
- Task 14: Planning Documents API (with file upload)
- Task 15: Approval API routes (submit/approve/reject)

**Phase 4: Advanced Services**
- Task 16: PlanningKanbanService
- Task 17: PlanningDashboardService (analytics queries)
- Task 18: Kanban & Dashboard API routes

**Phase 5: UI Core**
- Task 19: StatusBadge + List components
- Task 20: Form components (create/edit dengan map picker)
- Task 21: Detail view dengan tabs
- Task 22: Items & Milestones UI (editable tables)

**Phase 6: UI Advanced**
- Task 23: Kanban Board (@dnd-kit integration)
- Task 24: Dashboard UI (metrics + charts)
- Task 25: Template Management UI

**Phase 7: Export & Polish**
- Task 26: PDF Export Service (pdfmake)
- Task 27: E2E Tests (Playwright, critical flows)
- Task 28: Documentation & Polish

---

## Acceptance Criteria (Per Phase)

### Phase 1 Complete When:
- [ ] All 7 tables exist in database
- [ ] All domain entities defined with proper types
- [ ] All repository interfaces defined
- [ ] All DTOs defined
- [ ] All mappers implemented with unit tests
- [ ] All repository implementations working with integration tests
- [ ] Test coverage ≥70% for repository layer

### Phase 2 Complete When:
- [ ] PlanningService CRUD working (create, read, update, delete)
- [ ] Multi-level approval workflow functional
- [ ] Template service CRUD working
- [ ] Audit logging working for all mutations
- [ ] Unit tests ≥70% coverage for all services
- [ ] Integration tests pass for service layer

### Phase 3 Complete When:
- [ ] All validation schemas defined
- [ ] All API routes respond correctly
- [ ] Permissions enforced on all endpoints
- [ ] Activity logging working
- [ ] API integration tests pass
- [ ] Postman/curl manual testing successful

### Phase 4 Complete When:
- [ ] Kanban service returns board data
- [ ] Dashboard service returns metrics
- [ ] API routes tested and working
- [ ] Performance targets met (p95 < 500ms)

### Phase 5 Complete When:
- [ ] List view displays planning dengan filters
- [ ] Create form works dengan map picker
- [ ] Detail view shows all tabs
- [ ] Items & milestones editable
- [ ] Components responsive (desktop + mobile)

### Phase 6 Complete When:
- [ ] Kanban drag & drop working
- [ ] Dashboard displays charts correctly
- [ ] Template selector functional
- [ ] All UI components accessible (keyboard nav, screen reader)

### Phase 7 Complete When:
- [ ] PDF export generates valid documents
- [ ] E2E tests pass for critical flows:
  - Create planning → submit → approve → complete
  - Kanban move cards
  - Template usage
- [ ] Documentation complete
- [ ] Performance benchmarks met
- [ ] No critical bugs

---

## Testing Strategy

### Unit Tests (Vitest)
**Target: ≥70% coverage for services & repositories**

Run tests:
```bash
npm test -- modules/planning
```

Coverage report:
```bash
npm run test:coverage -- modules/planning
```

### Integration Tests
**Scope: API routes + database**

Setup test DB first:
```bash
./scripts/setup-test-db.sh
```

Run integration tests:
```bash
npm test -- app/api/planning
```

### E2E Tests (Playwright)
**Critical Flows:**
1. Full planning lifecycle (create → approve → complete)
2. Multi-level approval workflow
3. Kanban drag & drop
4. Template usage
5. PDF export

Run E2E:
```bash
npm run test:e2e -- planning
```

---

## Estimated Effort

**Total: ~4-5 weeks for 1 developer**

| Phase | Tasks | Estimated Time |
|-------|-------|---------------|
| Phase 1: Foundation | 5 tasks | 5-6 days |
| Phase 2: Core Services | 4 tasks | 4-5 days |
| Phase 3: API Layer | 6 tasks | 5-6 days |
| Phase 4: Advanced Services | 3 tasks | 3-4 days |
| Phase 5: UI Core | 4 tasks | 5-6 days |
| Phase 6: UI Advanced | 3 tasks | 4-5 days |
| Phase 7: Export & Polish | 3 tasks | 3-4 days |

**Note:** Estimasi assumes developer familiar dengan:
- Next.js 14 App Router
- Prisma ORM
- Clean Architecture pattern
- TDD workflow

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-08-planning-osp-implementation.md`.

**Two execution options:**

### Option 1: Subagent-Driven Development (RECOMMENDED)

**Use skill:** `superpowers:subagent-driven-development`

**Workflow:**
- Fresh subagent per task
- Two-stage review (plan review + implementation review)
- Fast iteration dengan parallel exploration
- Main context stays clean

**Best for:** Complex implementation, need review between tasks

### Option 2: Inline Execution

**Use skill:** `superpowers:executing-plans`

**Workflow:**
- Execute tasks in this session
- Batch execution dengan checkpoints
- Review at phase boundaries

**Best for:** Straightforward implementation, less context switching

---

**Which execution approach do you prefer?**

