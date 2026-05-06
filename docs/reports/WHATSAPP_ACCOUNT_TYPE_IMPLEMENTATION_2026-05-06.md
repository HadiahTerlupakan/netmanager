# WhatsApp Account Type Implementation

**Date:** 2026-05-06  
**Status:** ✅ COMPLETE

## Overview

Implementasi fitur **Account Type** untuk membedakan WhatsApp account berdasarkan penggunaan:
- **CUSTOMER**: Untuk pesan ke pelanggan (invoice, reminder, broadcast)
- **INTERNAL**: Untuk notifikasi internal (approval lembur, izin, work order)

## Problem Statement

Sebelumnya, semua notifikasi WhatsApp (customer & internal) menggunakan single account dari settings table. Ini menyebabkan:
1. Tidak ada pemisahan antara pesan customer dan internal
2. Sulit tracking usage per kategori
3. Tidak bisa set daily limit berbeda untuk internal vs customer
4. Approval notifications (overtime, leave) masih pakai old single-account system

## Solution

Menambahkan field `accountType` dengan 2 kategori:
- `CUSTOMER` (default): Untuk messaging ke pelanggan
- `INTERNAL`: Khusus untuk notifikasi approval & reminder internal

## Implementation Details

### 1. Database Schema

**Added Column:**
```sql
ALTER TABLE "WhatsAppAccount" 
ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'CUSTOMER';

CREATE INDEX "WhatsAppAccount_accountType_idx" ON "WhatsAppAccount"("accountType");
```

**Schema:**
```prisma
model WhatsAppAccount {
  id          String   @id @default(cuid())
  name        String
  phone       String
  provider    String
  apiKey      String
  domain      String?
  deviceId    String?
  accountType String   @default("CUSTOMER")  // NEW
  isActive    Boolean  @default(true)
  isDefault   Boolean  @default(false)
  priority    Int      @default(0)
  dailyLimit  Int?
  dailyCount  Int      @default(0)
  lastReset   DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenantId    String?
  
  @@index([accountType])  // NEW
}
```

### 2. Domain Layer

**Updated Entity:**
```typescript
// modules/notification/domain/whatsapp-account.entity.ts
export interface WhatsAppAccount {
  id: string;
  name: string;
  phone: string;
  provider: WhatsAppProviderId;
  apiKey: string;
  domain?: string | null;
  deviceId?: string | null;
  accountType: WhatsAppAccountType;  // NEW
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  dailyLimit?: number | null;
  dailyCount: number;
  lastReset: Date;
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string | null;
}

export type WhatsAppAccountType = "CUSTOMER" | "INTERNAL";  // NEW
```

### 3. Repository Layer

**New Methods:**
```typescript
// modules/notification/repositories/whatsapp-account.repository.ts

async findByAccountType(
  accountType: "CUSTOMER" | "INTERNAL",
  tenantId?: string
): Promise<WhatsAppAccount[]> {
  const results = await prisma.whatsAppAccount.findMany({
    where: {
      accountType,
      isActive: true,
      tenantId: tenantId ?? null,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return results as WhatsAppAccount[];
}

async findDefaultByAccountType(
  accountType: "CUSTOMER" | "INTERNAL",
  tenantId?: string
): Promise<WhatsAppAccount | null> {
  const result = await prisma.whatsAppAccount.findFirst({
    where: {
      accountType,
      isDefault: true,
      isActive: true,
      tenantId: tenantId ?? null,
    },
  });
  return result as WhatsAppAccount | null;
}
```

### 4. Service Layer

**Updated WhatsAppSenderService:**
```typescript
// modules/notification/services/whatsapp-sender.service.ts

export interface SendOptions {
  phone: string;
  message?: string;
  fileUrl?: string;
  accountId?: string;
  accountType?: "CUSTOMER" | "INTERNAL";  // NEW
  tenantId?: string;
}

async send(options: SendOptions): Promise<SendResult> {
  const account = options.accountId
    ? await this.accountRepo.findById(options.accountId)
    : await this.selectBestAccount(
        options.tenantId,
        [],
        options.accountType  // NEW: Filter by type
      );
  // ...
}

private async selectBestAccount(
  tenantId?: string,
  excludeIds: string[] = [],
  accountType?: "CUSTOMER" | "INTERNAL"  // NEW
): Promise<any | null> {
  if (accountType) {
    // Try default for that type first
    const defaultAccount = await this.accountRepo.findDefaultByAccountType(
      accountType,
      tenantId
    );
    
    if (defaultAccount && this.isAccountAvailable(defaultAccount)) {
      return defaultAccount;
    }

    // Get accounts filtered by type
    const accounts = await this.accountRepo.findByAccountType(
      accountType,
      tenantId
    );
    // Sort by priority and return best
  }
  // Original logic for no accountType filter
}
```

### 5. Migration: WhatsAppApprovalButtonService

**Before (Old Single Account):**
```typescript
export class WhatsAppApprovalButtonService {
  constructor(private readonly whatsAppService = new WhatsAppService()) {}

  async sendApprovalButton(input: ApprovalButtonNotificationInput) {
    const result = await this.whatsAppService.sendButton({
      phone,
      message: this.buildMessage(input),
      footer: APPROVAL_FOOTER,
      buttons: [this.buildApprovalButton(input.approvalUrl)],
    });
  }
}
```

**After (New Multi-Account with INTERNAL Type):**
```typescript
export class WhatsAppApprovalButtonService {
  constructor(
    private readonly whatsAppSenderService = new WhatsAppSenderService()
  ) {}

  async sendApprovalButton(input: ApprovalButtonNotificationInput) {
    const message = this.buildMessage(input);
    const result = await this.whatsAppSenderService.send({
      phone,
      message,
      accountType: "INTERNAL",  // NEW: Use INTERNAL account
      tenantId: input.tenantId,
    });
  }
}
```

### 6. Frontend UI

**Form Field:**
```tsx
<div>
  <label>Tipe Akun *</label>
  <select value={formData.accountType}>
    <option value="CUSTOMER">Customer - Untuk pesan ke pelanggan</option>
    <option value="INTERNAL">Internal - Untuk notifikasi approval & reminder</option>
  </select>
  <p className="text-xs text-gray-500">
    {formData.accountType === "CUSTOMER"
      ? "Digunakan untuk mengirim pesan ke pelanggan (invoice, reminder, broadcast)"
      : "Digunakan untuk notifikasi internal (approval lembur, izin, work order)"}
  </p>
</div>
```

**List View Badge:**
```tsx
{account.accountType === "INTERNAL" && (
  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
    Internal
  </span>
)}
```

## Usage Examples

### 1. Create INTERNAL Account

```bash
POST /api/admin/whatsapp/accounts
{
  "name": "Internal Notifications",
  "phone": "628123456789",
  "provider": "FONNTE",
  "apiKey": "xxx",
  "accountType": "INTERNAL",
  "isDefault": true,
  "priority": 10,
  "dailyLimit": null  // Unlimited for internal
}
```

### 2. Create CUSTOMER Account

```bash
POST /api/admin/whatsapp/accounts
{
  "name": "Customer Service",
  "phone": "628987654321",
  "provider": "WABLAS",
  "apiKey": "yyy",
  "domain": "console.wablas.com",
  "deviceId": "device123",
  "accountType": "CUSTOMER",
  "isDefault": true,
  "priority": 5,
  "dailyLimit": 1000
}
```

### 3. Send with Account Type

```typescript
// Internal notification (overtime approval)
await whatsAppSenderService.send({
  phone: admin.phone,
  message: "Pengajuan lembur baru dari John Doe",
  accountType: "INTERNAL",  // Auto-select INTERNAL account
  tenantId: "xxx",
});

// Customer message (invoice)
await whatsAppSenderService.send({
  phone: customer.phone,
  message: "Invoice #12345 telah dibuat",
  accountType: "CUSTOMER",  // Auto-select CUSTOMER account
  tenantId: "xxx",
});
```

## Auto-Routing Logic

**With accountType specified:**
1. Try default account for that type
2. Get all active accounts of that type
3. Filter by daily limit availability
4. Sort by priority (highest first)
5. Return best available

**Without accountType (backward compatible):**
1. Try default account (any type)
2. Get all active accounts
3. Filter by daily limit
4. Sort by priority
5. Return best available

## Current Internal Notifications Using INTERNAL Type

✅ **Overtime Approval** (`OvertimeNotificationService`)
- Notifikasi ke admin saat ada pengajuan lembur baru
- File: `modules/overtime/services/OvertimeNotificationService.ts`

✅ **Leave Approval (Mobile)** (`MobileLeaveNotificationHelper`)
- Notifikasi ke admin saat ada pengajuan izin dari mobile
- File: `modules/attendance/services/mobile-leave-notification.helpers.ts`

## Future Enhancements

**Belum menggunakan WhatsApp (masih push notification only):**
- Attendance reminder (check-in/check-out)
- Work Order notifications
- Finance/Invoice notifications
- Inventory restock alerts
- Leave approval (non-mobile)
- Support ticket replies

**Recommendation:** Migrate semua notifikasi internal di atas untuk menggunakan `WhatsAppSenderService` dengan `accountType: "INTERNAL"`.

## Benefits

1. **Separation of Concerns**: Customer messaging terpisah dari internal notifications
2. **Better Tracking**: Bisa track usage per kategori (customer vs internal)
3. **Flexible Limits**: Internal bisa unlimited, customer bisa limited
4. **Auto-Routing**: Sistem otomatis pilih account sesuai tipe
5. **Load Balancing**: Bisa multiple accounts per type dengan priority
6. **Backward Compatible**: Existing code tanpa accountType tetap jalan

## Files Modified

**Schema:**
- ✅ `prisma/schema.prisma`

**Domain:**
- ✅ `modules/notification/domain/whatsapp-account.entity.ts`

**DTO:**
- ✅ `modules/notification/dto/create-whatsapp-account.dto.ts`
- ✅ `modules/notification/dto/update-whatsapp-account.dto.ts`

**Repository:**
- ✅ `modules/notification/repositories/whatsapp-account.repository.ts`

**Service:**
- ✅ `modules/notification/services/whatsapp-sender.service.ts`
- ✅ `modules/notification/services/WhatsAppApprovalButtonService.ts`

**Callers:**
- ✅ `modules/overtime/services/OvertimeNotificationService.ts`
- ✅ `modules/attendance/services/mobile-leave-notification.helpers.ts`

**Frontend:**
- ✅ `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`

**Database:**
- ✅ Added `accountType` column with index

## Testing Checklist

- [ ] Create INTERNAL account via admin UI
- [ ] Create CUSTOMER account via admin UI
- [ ] Test overtime approval notification (should use INTERNAL)
- [ ] Test leave approval notification (should use INTERNAL)
- [ ] Test customer invoice message (should use CUSTOMER)
- [ ] Verify auto-routing selects correct account type
- [ ] Verify daily limit works per account type
- [ ] Verify priority sorting within same type
- [ ] Test backward compatibility (no accountType specified)

## Status

**Implementation:** ✅ COMPLETE  
**Build:** ✅ PASSING  
**Database Migration:** ✅ APPLIED  
**Frontend:** ✅ UPDATED  
**Documentation:** ✅ COMPLETE

---

**Next Step:** Test di browser untuk memastikan semua fitur berfungsi dengan baik.
