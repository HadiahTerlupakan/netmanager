# Multi-WhatsApp API Design

**Created:** 2026-05-05  
**Status:** Implementation Ready

## Problem Statement

Saat ini sistem hanya support 1 akun WhatsApp (1 API key). Kebutuhan:
- Support multiple WhatsApp accounts dengan API key berbeda
- Bisa pilih nomor pengirim saat kirim pesan
- Manage multiple API credentials secara aman
- Load balancing / fallback antar akun

## Solution Design

### 1. Database Schema

```prisma
model WhatsAppAccount {
  id          String   @id @default(cuid())
  name        String   // "CS Team", "Marketing", "Billing"
  phone       String   // Nomor WA yang terdaftar
  provider    String   // "FONNTE", "WABLAS", "MPWA"
  apiKey      String   // Encrypted
  domain      String?  // Untuk Wablas
  deviceId    String?  // Untuk Wablas
  isActive    Boolean  @default(true)
  isDefault   Boolean  @default(false)
  priority    Int      @default(0) // Untuk load balancing
  
  // Limits & Monitoring
  dailyLimit  Int?     // Max pesan per hari
  dailyCount  Int      @default(0)
  lastReset   DateTime @default(now())
  
  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  
  // Relations
  messages    WhatsAppMessage[]
  
  @@unique([phone, tenantId])
  @@index([tenantId, isActive])
  @@index([isDefault])
}

model WhatsAppMessage {
  id          String   @id @default(cuid())
  accountId   String
  account     WhatsAppAccount @relation(fields: [accountId], references: [id])
  
  phone       String   // Nomor tujuan
  message     String?
  fileUrl     String?
  status      String   // "pending", "sent", "failed"
  error       String?
  
  // Provider response
  messageId   String?  // ID dari provider
  response    Json?
  
  createdAt   DateTime @default(now())
  sentAt      DateTime?
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  
  @@index([accountId])
  @@index([status])
  @@index([tenantId])
}
```

### 2. Module Structure

```
modules/notification/
├── domain/
│   ├── whatsapp-account.entity.ts
│   └── whatsapp-message.entity.ts
├── dto/
│   ├── create-whatsapp-account.dto.ts
│   ├── update-whatsapp-account.dto.ts
│   └── send-whatsapp-message.dto.ts
├── repositories/
│   ├── whatsapp-account.repository.ts
│   └── whatsapp-message.repository.ts
├── services/
│   ├── whatsapp-account.service.ts      # CRUD accounts
│   ├── whatsapp-sender.service.ts       # Send logic + routing
│   └── whatsapp/
│       ├── whatsapp-service.ts          # Legacy (deprecated)
│       ├── whatsapp-factory.ts
│       └── providers/
└── validators/
    ├── whatsapp-account.validator.ts
    └── send-message.validator.ts
```

### 3. Service Layer

#### WhatsAppAccountService
- CRUD operations untuk manage accounts
- Validasi API key saat create/update
- Test connection per account
- Set default account

#### WhatsAppSenderService
- **Auto-routing:** Pilih account berdasarkan priority/availability
- **Manual selection:** Kirim via account tertentu
- **Load balancing:** Distribusi pesan ke multiple accounts
- **Fallback:** Retry dengan account lain jika gagal
- **Rate limiting:** Track daily limits per account
- **Logging:** Simpan semua pesan ke WhatsAppMessage table

### 4. API Routes

```typescript
// Account Management
POST   /api/admin/whatsapp/accounts          # Create account
GET    /api/admin/whatsapp/accounts          # List accounts
GET    /api/admin/whatsapp/accounts/:id      # Get account
PATCH  /api/admin/whatsapp/accounts/:id      # Update account
DELETE /api/admin/whatsapp/accounts/:id      # Delete account
POST   /api/admin/whatsapp/accounts/:id/test # Test connection
POST   /api/admin/whatsapp/accounts/:id/set-default # Set as default

// Sending (Internal use)
POST   /api/internal/whatsapp/send           # Send via auto-routing
POST   /api/internal/whatsapp/send/:accountId # Send via specific account

// Monitoring
GET    /api/admin/whatsapp/messages          # Message history
GET    /api/admin/whatsapp/stats             # Usage stats per account
```

### 5. Migration Strategy

**Phase 1: Database**
- Create migration untuk WhatsAppAccount & WhatsAppMessage tables
- Migrate existing settings ke WhatsAppAccount (create default account)

**Phase 2: Service Layer**
- Implement WhatsAppAccountService
- Implement WhatsAppSenderService
- Keep WhatsAppService untuk backward compatibility

**Phase 3: Integration**
- Update semua caller untuk gunakan WhatsAppSenderService
- Deprecate WhatsAppService

**Phase 4: UI**
- Admin page untuk manage accounts
- Dropdown selector di form yang perlu kirim WA manual

### 6. Usage Examples

```typescript
// Auto-routing (pilih account terbaik otomatis)
const result = await whatsAppSender.send({
  phone: "628123456789",
  message: "Hello from NetManager"
});

// Manual selection (kirim via account tertentu)
const result = await whatsAppSender.send({
  phone: "628123456789",
  message: "Hello from CS Team",
  accountId: "clx123abc" // Optional
});

// Broadcast dengan load balancing
const results = await whatsAppSender.broadcast({
  phones: ["628111", "628222", "628333"],
  message: "Promo hari ini!",
  loadBalance: true // Distribusi ke multiple accounts
});
```

### 7. Security Considerations

- API keys encrypted di database (gunakan existing encryption util)
- Only admin role bisa manage accounts
- Audit log untuk semua perubahan account
- Rate limiting per account untuk prevent abuse
- Validate phone numbers sebelum kirim

### 8. Monitoring & Observability

- Track success/failure rate per account
- Alert jika account mencapai daily limit
- Dashboard untuk lihat usage per account
- Log semua pesan untuk audit trail

## Implementation Checklist

- [ ] Create Prisma migration
- [ ] Implement domain entities
- [ ] Implement repositories
- [ ] Implement WhatsAppAccountService
- [ ] Implement WhatsAppSenderService
- [ ] Create API routes
- [ ] Add validators
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Create admin UI
- [ ] Update existing callers
- [ ] Documentation
- [ ] Deploy & monitor

## Rollback Plan

Jika ada masalah:
1. Feature flag untuk switch back ke single account mode
2. WhatsAppService tetap ada untuk fallback
3. Migration bisa di-rollback (down migration)
4. Data WhatsAppAccount tidak akan hilang

---

**Next Steps:**
1. Review design dengan team
2. Create Prisma migration
3. Start implementation dari repository layer
