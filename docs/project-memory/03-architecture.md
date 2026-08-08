# Architecture Deep Dive

**Last Updated:** 2026-08-09  
**Architecture Style:** Modular Monolith + Layered + Clean Architecture (migration in progress)

---

## Architectural Overview

NetManager menggunakan **Modular Monolith** architecture — single deployable unit yang terorganisasi dalam domain modules yang terdefinisi dengan baik. Ini memberikan keseimbangan antara:
- **Simplicity:** Single codebase, single deployment
- **Modularity:** Clear boundaries antar domain
- **Performance:** In-process communication (no network overhead)
- **Scalability:** Dapat di-scale horizontal via Kubernetes

### Current State: Hybrid Architecture

**30% Clean Architecture** (New modules: accounting, pelanggan, planning)  
**70% Legacy Layered** (Existing modules: finance, network, attendance, dll)

---

## Layering Strategy

### Layer 1: Presentation Layer (`app/`)
**Technology:** Next.js App Router (React Server Components + API Routes)

```
app/
├── (auth)/          # Authentication pages
├── (customer)/      # Customer portal UI
├── admin/           # Admin portal UI
├── karyawan/        # Employee portal UI
└── api/             # HTTP API endpoints (599 routes)
```

**Responsibilities:**
- Render UI components (RSC + Client Components)
- Handle HTTP requests/responses
- Parse request bodies & validate inputs
- Enforce authentication & authorization
- Route to appropriate service layer
- Transform service responses to DTOs
- Return JSON or HTML

**Dependencies:**
- Can import from: `modules/*/index.ts` (public API only)
- Can import from: `lib/*` (utilities, middleware)
- **Cannot import:** Internal module files (repositories, mappers)

**Example API Route Flow:**
```typescript
// app/api/admin/pelanggan/route.ts
export async function GET(request: NextRequest) {
  // 1. Middleware enforcement (auth, RBAC, tenant context)
  const session = await getServerSession()
  if (!session) return ApiResponse.unauthorized()
  
  const hasAccess = await hasPermission('pelanggan:read', session.user)
  if (!hasAccess) return ApiResponse.forbidden()
  
  // 2. Get tenant context
  const tenantId = await getTenantContext(request)
  
  // 3. Call service (imported from module public API)
  const pelangganService = new PelangganService()
  const customers = await pelangganService.getAllPelanggan({ tenantId })
  
  // 4. Return DTO (already from service)
  return ApiResponse.success(customers)
}
```

---

### Layer 2: Business Logic Layer (`modules/*/services/`)
**Technology:** TypeScript classes with dependency injection

```
modules/<domain>/services/
├── XxxService.ts           # Main service orchestration
├── XxxService.helpers.ts   # Helper functions
└── XxxService.contracts.ts # Input/output types
```

**Responsibilities:**
- Implement business rules
- Orchestrate multiple repositories
- Validate business constraints
- Emit domain events
- Handle transactions
- Transform data (via mappers)
- Apply business calculations

**Dependencies:**
- Can import from: Same module's repositories, DTOs, mappers, validators
- Can import from: Other modules via `modules/*/index.ts` (public API only)
- Can import from: `lib/*` utilities
- **Cannot import:** UI components, API routes
- **Should depend on:** Repository interfaces (ports), not concrete implementations

**Example Service (Clean Architecture):**
```typescript
// modules/pelanggan/services/PelangganService.ts
export class PelangganService {
  private pelangganRepository: IPelangganRepository
  
  constructor(
    pelangganRepository: IPelangganRepository = new PelangganRepository()
  ) {
    this.pelangganRepository = pelangganRepository
  }
  
  async createPelanggan(data: CreatePelangganInput): Promise<PelangganWithPackageEntity> {
    // 1. Validate business rules
    await validateCreatePelangganInput(this.pelangganRepository, data)
    
    // 2. Build domain entity
    const createData = await buildCreatePelangganData(data)
    
    // 3. Persist via repository
    const pelanggan = await this.pelangganRepository.create(createData)
    
    // 4. Side effects (emit events, sync external systems)
    await syncCreatedCustomerToRadius(this.pelangganRepository, pelanggan)
    await triggerCustomerBilling(pelanggan.id, data.billingAction)
    
    // 5. Return domain entity (mapper transforms to DTO at API layer)
    return pelanggan
  }
}
```

---

### Layer 3: Data Access Layer (`modules/*/repositories/`)
**Technology:** Prisma ORM with Repository Pattern

```
modules/<domain>/repositories/
├── XxxRepository.ts           # Concrete implementation
├── XxxRepository.helpers.ts   # Query builders, filters
└── IXxxRepository.ts (or domain/ports/) # Interface definition
```

**Responsibilities:**
- CRUD operations
- Complex queries with joins
- Filtering, sorting, pagination
- Transaction management
- Tenant isolation enforcement
- Map Prisma models to Domain entities (Clean Architecture)

**Dependencies:**
- Can import from: Prisma clients (`@prisma/client`, `@prisma/client-radius`, etc.)
- Can import from: Same module's entities, mappers
- Can import from: `lib/prisma*.ts` (database clients)
- **Cannot import:** Services, API routes, UI components

**Example Repository (Clean Architecture):**
```typescript
// modules/pelanggan/repositories/PelangganRepository.ts
export class PelangganRepository implements IPelangganRepository {
  async findById(id: string): Promise<PelangganEntity | null> {
    const record = await prisma.pelanggan.findUnique({
      where: { id },
      include: { hargaPaket: true, profilePPP: true }
    })
    
    if (!record) return null
    
    // Transform Prisma model → Domain Entity
    return PelangganMapper.toDomainEntity(record)
  }
  
  async create(data: CreatePelangganData): Promise<PelangganWithPackageEntity> {
    const record = await prisma.pelanggan.create({
      data: {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: { hargaPaket: true, profilePPP: true }
    })
    
    return PelangganMapper.toDomainEntityWithPackage(record)
  }
}
```

**Example Repository (Legacy Pattern):**
```typescript
// Older modules might return Prisma types directly
export class FinanceRepository {
  async findInvoiceById(id: string) {
    return prisma.invoice.findUnique({ where: { id } })
    // Returns Prisma.Invoice type — service handles mapping to DTO
  }
}
```

---

### Layer 4: Domain Layer (`modules/*/domain/`) — Clean Architecture Only
**Technology:** Pure TypeScript (no framework dependencies)

```
modules/<domain>/domain/
├── entities/
│   └── XxxEntity.ts      # Domain entity (pure interface/class)
└── ports/
    └── IXxxRepository.ts # Repository interface (abstraction)
```

**Responsibilities:**
- Define domain entities (business concepts)
- Define repository interfaces (ports)
- **Zero external dependencies** (no Prisma, no framework)

**Example Domain Entity:**
```typescript
// modules/pelanggan/domain/entities/PelangganEntity.ts
export interface PelangganEntity {
  id: string
  idPelanggan: string
  nama: string
  username: string
  email: string | null
  nomorHp: string | null
  alamat: string | null
  status: Status
  paketId: string
  createdAt: Date
  updatedAt: Date
  tenantId: string | null
}

// With relations
export interface PelangganWithPackageEntity extends PelangganEntity {
  hargaPaket: {
    id: string
    name: string
    harga: number
    // ... other package fields
  }
}
```

**Example Repository Port:**
```typescript
// modules/pelanggan/domain/ports/IPelangganRepository.ts
export interface IPelangganRepository {
  findById(id: string): Promise<PelangganEntity | null>
  findAll(filter?: FilterOptions): Promise<PelangganWithPackageEntity[]>
  create(data: CreatePelangganData): Promise<PelangganWithPackageEntity>
  update(id: string, data: UpdatePelangganData): Promise<PelangganEntity>
  delete(id: string): Promise<PelangganEntity>
}
```

---

### Supporting Layers

#### Mappers (`modules/*/mappers/`)
**Purpose:** Transform data between layers

```typescript
// modules/pelanggan/mappers/PelangganMapper.ts
export class PelangganMapper {
  // Prisma → Domain Entity
  static toDomainEntity(prisma: PrismaCustomer): PelangganEntity {
    return {
      id: prisma.id,
      idPelanggan: prisma.idPelanggan,
      nama: prisma.nama,
      username: prisma.username,
      // ... map all fields
    }
  }
  
  // Domain Entity → DTO (for API responses)
  static toDTO(entity: PelangganEntity): PelangganDTO {
    return {
      id: entity.id,
      customerId: entity.idPelanggan,
      name: entity.nama,
      username: entity.username,
      // ... transform to API shape
    }
  }
  
  // DTO → Domain Entity (for API inputs)
  static fromDTO(dto: CreatePelangganDTO): Partial<PelangganEntity> {
    return {
      nama: dto.name,
      username: dto.username,
      // ... reverse transformation
    }
  }
}
```

#### DTOs (`modules/*/dto/`)
**Purpose:** Define data transfer contracts

```typescript
// modules/pelanggan/dto/PelangganDTO.ts
export interface PelangganDTO {
  id: string
  customerId: string          // idPelanggan internal → customerId public
  name: string                // nama → name
  username: string
  email: string | null
  phone: string | null        // nomorHp → phone
  address: string | null      // alamat → address
  status: string
  packageName: string
  packagePrice: number
  createdAt: string           // Date → ISO string
}

export interface CreatePelangganDTO {
  name: string
  username: string
  email?: string
  phone?: string
  address?: string
  packageId: string
  tenantId?: string
}
```

#### Validators (`modules/*/validators/`)
**Purpose:** Input validation with Zod

```typescript
// modules/pelanggan/validators/pelanggan.validator.ts
import { z } from 'zod'

export const createPelangganSchema = z.object({
  name: z.string().min(3).max(100),
  username: z.string().min(3).max(50).regex(/^[a-z0-9_-]+$/),
  email: z.string().email().optional(),
  phone: z.string().regex(/^(\+62|62|0)[0-9]{9,13}$/).optional(),
  address: z.string().max(500).optional(),
  packageId: z.string().uuid(),
  tenantId: z.string().uuid().optional()
})

export type CreatePelangganInput = z.infer<typeof createPelangganSchema>
```

---

## Request Lifecycle

### 1. HTTP Request → Next.js App Router
```
Client (Browser/Mobile)
  ↓
HTTPS Request to https://radpro.id/api/admin/pelanggan
  ↓
Ingress (K8s) → LoadBalancer
  ↓
Service → Pod
  ↓
Custom Node Server (server.ts)
  ↓
Next.js Request Handler
```

### 2. Middleware Stack
```
Request
  ↓
Next.js Middleware (app-level)
  ├── CORS headers
  ├── Security headers (Helmet)
  └── Rate limiting
  ↓
Route-specific Middleware
  ├── Authentication (NextAuth session check)
  ├── Tenant Context Resolution (subdomain/session/header)
  ├── Authorization (RBAC permission check)
  └── Request logging
  ↓
API Route Handler
```

### 3. Service Layer Execution
```
API Route
  ↓
Parse & Validate Input (Zod)
  ↓
Call Service Method
  ├── Business Validation
  ├── Call Repository (via interface)
  │   ├── Prisma Query (with tenant filter)
  │   └── Map Prisma → Domain Entity
  ├── Apply Business Logic
  ├── Emit Domain Events (if needed)
  └── Return Domain Entity/DTO
  ↓
Transform to API Response
  ├── Success: HTTP 200 with DTO
  ├── Validation Error: HTTP 400
  ├── Auth Error: HTTP 401
  ├── Authorization Error: HTTP 403
  └── Server Error: HTTP 500
```

### 4. Response
```
API Route
  ↓
JSON Serialization
  ↓
Next.js Response Handler
  ↓
Custom Server
  ↓
Kubernetes Service → Ingress
  ↓
Client
```

---

## Event-Driven Architecture

### Event Bus Implementation
```
modules/events/
├── dispatchers/
│   ├── BillingEventDispatcher.ts
│   ├── CustomerEventDispatcher.ts
│   ├── AttendanceEventDispatcher.ts
│   ├── InventoryEventDispatcher.ts
│   ├── NetworkEventDispatcher.ts
│   ├── TicketEventDispatcher.ts
│   └── WorkOrderEventDispatcher.ts
└── index.ts

lib/event-bus/
├── event-bus.ts        # EventBus singleton class
├── event-handlers.ts   # Registered handlers
└── types.ts            # Event definitions & metadata
```

### Event Flow
```
Business Action (e.g., Invoice Paid)
  ↓
Service emits event:
  eventBus.publish('billing:invoice.paid', payload)
  ↓
EventBus processes:
  ├── Synchronous handlers (in-memory)
  │   └── Immediate side effects
  └── Asynchronous handlers (BullMQ)
      ├── Persistent queue (Redis)
      ├── Retry on failure (exponential backoff)
      └── Dead letter queue
  ↓
Event Handlers:
  ├── Update customer status
  ├── Send notification
  ├── Sync to network devices
  ├── Update accounting GL
  └── Generate reports
```

### Event Types
```typescript
// lib/event-bus/types.ts
export type EventName =
  | 'billing:invoice.created'
  | 'billing:invoice.paid'
  | 'billing:payment.received'
  | 'customer:created'
  | 'customer:updated'
  | 'customer:deleted'
  | 'customer:status.changed'
  | 'attendance:checked-in'
  | 'attendance:checked-out'
  | 'work-order:created'
  | 'work-order:assigned'
  | 'work-order:completed'
  | 'inventory:stock.low'
  // ... 50+ event types

export interface EventMetadata {
  priority: 'low' | 'normal' | 'high' | 'critical'
  persistent: boolean  // Should persist to outbox
  async: boolean       // Should process via BullMQ
  retryable: boolean   // Should retry on failure
}
```

---

## Data Flow Patterns

### Pattern 1: CRUD Operations
```
Client Request (Create Customer)
  ↓
API Route validates input (Zod)
  ↓
Service.createPelanggan()
  ├── validateCreatePelangganInput() — business rules
  ├── Repository.create() — persist to DB
  ├── Emit event: 'customer:created'
  └── Return PelangganEntity
  ↓
Mapper.toDTO() — transform for API
  ↓
API Response (HTTP 201 with PelangganDTO)

Background (async):
  ↓
Event handlers triggered
  ├── Sync to RADIUS database
  ├── Provision MikroTik PPP secret
  ├── Send welcome email
  └── Create initial invoice
```

### Pattern 2: Complex Business Operations
```
Payment Processing Flow:
  ↓
1. API receives payment webhook (Xendit/Midtrans)
   ├── Verify webhook signature
   ├── Validate payment data
   └── Call PaymentService.processPayment()
  ↓
2. PaymentService orchestrates:
   ├── Find related invoice (InvoiceRepository)
   ├── Validate payment amount matches invoice
   ├── Create payment record (PaymentRepository)
   ├── Update invoice status → PAID
   ├── Emit 'billing:payment.received' event
   └── Transaction commit
  ↓
3. Event handlers (async):
   ├── Update customer status → AKTIF
   ├── Sync to MikroTik (enable PPP secret)
   ├── Update accounting GL entries
   ├── Send payment receipt (email + WhatsApp)
   └── Create next recurring invoice (if subscription)
```

### Pattern 3: External Service Integration
```
Network Provisioning Flow:
  ↓
1. Customer Status Changed → AKTIF
   ↓
2. Event: 'customer:status.changed'
   ↓
3. NetworkEventDispatcher.onStatusChanged()
   ├── Call MikrotikService.provisionPPPSecret()
   │   ├── Connect to RouterOS API
   │   ├── Create/Update PPP secret
   │   ├── Apply bandwidth profile
   │   └── Disconnect
   ├── Call RADIUSService.syncCustomer()
   │   ├── Insert/Update radcheck table
   │   ├── Insert/Update radreply table
   │   └── Update radgroupcheck
   └── Emit 'network:provisioned' event
  ↓
4. On failure:
   ├── Retry (3 attempts with exp backoff)
   ├── Log error with context
   └── Move to dead letter queue
   ↓
5. Admin notification:
   └── "Manual intervention required for customer X"
```

---

## Multi-Tenancy Implementation

### Tenant Context Resolution
```
Request arrives
  ↓
Middleware: getTenantContext()
  ├── Strategy 1: Subdomain
  │   └── Extract from host header (admin.tenant1.radpro.id)
  ├── Strategy 2: Session
  │   └── User's tenant from database
  ├── Strategy 3: Header
  │   └── x-tenant-id header (mobile app)
  └── Strategy 4: Super Admin Bypass
      └── SUPER_ADMIN can access all tenants
  ↓
Inject into Request Context
  ↓
Repository auto-filters by tenantId
  ↓
All queries: WHERE tenantId = ?
```

### Data Isolation
```typescript
// Automatic tenant filtering in repository
export class PelangganRepository {
  async findAll(filter?: FilterOptions) {
    const tenantId = await getTenantContext()
    
    return prisma.pelanggan.findMany({
      where: {
        tenantId,  // ← Automatically injected
        ...filter
      }
    })
  }
}
```

### Tenant-Aware Tables
- All business data tables have `tenantId` field (nullable for global data)
- Unique constraints include `tenantId`: `@@unique([tenantId, code])`
- Indexes include `tenantId`: `@@index([tenantId])`
- Foreign keys respect tenant boundaries

---

## Dependency Injection

### Current State: Constructor Injection
```typescript
// Service depends on repository interface
export class PelangganService {
  constructor(
    private pelangganRepository: IPelangganRepository = new PelangganRepository()
  ) {}
}

// API Route instantiates with default
const service = new PelangganService()
// Or with mock for testing
const service = new PelangganService(mockRepository)
```

### Future: Potential DI Container
Not currently implemented, but architecture supports it.

---

## Error Handling Strategy

### API Layer
```typescript
try {
  const result = await service.operation()
  return ApiResponse.success(result)
} catch (error) {
  if (error instanceof ValidationError) {
    return ApiResponse.badRequest(error.message)
  }
  if (error instanceof NotFoundError) {
    return ApiResponse.notFound(error.message)
  }
  logger.error('[API] Unexpected error:', error)
  return ApiResponse.internalError()
}
```

### Service Layer
```typescript
// Use Result pattern for business operations
import { Result } from '@/lib/result'

async createCustomer(data: Input): Promise<Result<Customer, Error>> {
  const validation = validateInput(data)
  if (!validation.isValid) {
    return Result.fail(new ValidationError(validation.error))
  }
  
  const customer = await repository.create(data)
  return Result.ok(customer)
}
```

---

## Security Architecture

### Authentication Flow
```
User submits credentials
  ↓
API Route: /api/auth/login
  ↓
NextAuth.js validates
  ├── Check credentials (bcrypt)
  ├── Load user + role + permissions
  └── Create session (Redis)
  ↓
Set secure HTTP-only cookie
  ↓
Subsequent requests:
  ├── Cookie sent automatically
  ├── Session validated via NextAuth
  └── User context injected
```

### Authorization (RBAC)
```
Middleware: hasPermission('pelanggan:create')
  ↓
Load user permissions (cached)
  ├── Direct permissions
  ├── Role permissions
  └── Permission aliases
  ↓
Check if required permission in set
  ├── Exact match: 'pelanggan:create'
  ├── Wildcard: '*' (SUPER_ADMIN)
  ├── Resource wildcard: 'pelanggan:*'
  └── Alias expansion: 'admin:full' → includes pelanggan:create
  ↓
Allow or Deny
```

---

## Performance Optimization

### Caching Strategy
```
lib/cache.ts
  ├── L1: In-memory (LRU)
  │   └── TTL: 60 seconds
  └── L2: Redis
      └── TTL: 1 hour
      
Cache Keys:
  - User permissions: `perm:user:{userId}`
  - Role permissions: `perm:role:{roleId}`
  - Tenant config: `tenant:{tenantId}:config`
  - Reference data: `ref:{entity}:{id}`
```

### Database Optimization
- Indexes on foreign keys
- Composite indexes for common queries
- Pagination for list operations
- `SELECT` only needed fields
- Eager loading with Prisma `include`

### API Response
- Streaming for large datasets
- Compression (gzip)
- ETags for cacheable resources
- CDN for static assets

---

## Scalability Considerations

### Horizontal Scaling (Current)
- **Kubernetes Deployment:** 3 replicas (production)
- **Stateless Services:** Session in Redis
- **Load Balancing:** K8s Service + Ingress
- **Database:** Single PostgreSQL (vertical scaling)
- **Redis:** Single instance (vertical scaling)

### Future Scaling Options
1. **Database:** Read replicas for reporting
2. **Redis:** Redis Sentinel/Cluster
3. **Microservices:** Extract high-load domains
4. **Message Queue:** RabbitMQ/Kafka for events
5. **CQRS:** Separate read/write models

---

## Architecture Decision Records (ADRs)

### ADR-001: Modular Monolith over Microservices
**Decision:** Stay monolith initially  
**Rationale:** Faster development, simpler deployment, sufficient scale  
**Status:** Accepted  
**Date:** 2024

### ADR-002: Clean Architecture Migration
**Decision:** Gradual migration to Clean Architecture  
**Rationale:** Improve testability, maintainability, future-proof  
**Status:** In Progress (30% complete)  
**Date:** 2026

### ADR-003: Multi-Database Strategy
**Decision:** Separate databases for RADIUS, Billing, Mitra  
**Rationale:** Data isolation, independent scaling, audit requirements  
**Status:** Accepted  
**Date:** 2025

### ADR-004: Event-Driven for Side Effects
**Decision:** Use event bus for async operations  
**Rationale:** Decoupling, reliability, audit trail  
**Status:** Accepted  
**Date:** 2025

---

## Migration Roadmap

### Phase 1: Foundation (DONE)
- ✅ Module structure standardization
- ✅ Repository pattern adoption
- ✅ Event bus implementation

### Phase 2: Clean Architecture Pilot (IN PROGRESS)
- ✅ Migrate `accounting` module
- ✅ Migrate `pelanggan` module
- ⏳ Migrate `finance` module
- ⏳ Migrate `network` module

### Phase 3: Core Modules (PLANNED)
- ⏳ Migrate `attendance` module
- ⏳ Migrate `work-order` module
- ⏳ Migrate `inventory` module

### Phase 4: Supporting Modules (PLANNED)
- Remaining 25+ modules

---

**Architecture Analysis:** COMPLETED  
**Confidence:** 85% — Major patterns identified, some details need verification
