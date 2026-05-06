# Multi-WhatsApp API - User Guide

**Created:** 2026-05-06  
**Version:** 1.0

## Overview

Fitur Multi-WhatsApp API memungkinkan sistem untuk mengelola multiple akun WhatsApp dengan API key berbeda. Sistem dapat memilih nomor pengirim secara otomatis atau manual saat mengirim pesan.

## Features

✅ **Multiple Accounts** - Kelola banyak akun WhatsApp dengan API berbeda  
✅ **Auto-Routing** - Sistem otomatis pilih akun terbaik berdasarkan priority & availability  
✅ **Load Balancing** - Distribusi pesan ke multiple accounts untuk broadcast  
✅ **Daily Limits** - Set batas harian per account untuk prevent abuse  
✅ **Fallback** - Otomatis retry dengan account lain jika gagal  
✅ **Message History** - Track semua pesan yang dikirim  
✅ **Statistics** - Monitor usage per account  

## Supported Providers

- **Fonnte** - https://fonnte.com
- **Wablas** - https://wablas.com
- **MPWA** - MPWA Gateway
- **Official WhatsApp Business API** (Coming Soon)

## Setup

### 1. Database Migration

Migration sudah dibuat dan dijalankan. Tables yang ditambahkan:
- `WhatsAppAccount` - Menyimpan konfigurasi akun
- `WhatsAppMessage` - Menyimpan history pesan

### 2. Create WhatsApp Account

**Endpoint:** `POST /api/admin/whatsapp/accounts`

**Permission Required:** `settings:write`

**Request Body:**
```json
{
  "name": "CS Team",
  "phone": "628123456789",
  "provider": "FONNTE",
  "apiKey": "your-api-key-here",
  "isActive": true,
  "isDefault": false,
  "priority": 10,
  "dailyLimit": 1000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx123abc",
    "name": "CS Team",
    "phone": "628123456789",
    "provider": "FONNTE",
    "isActive": true,
    "isDefault": false,
    "priority": 10,
    "dailyLimit": 1000,
    "dailyCount": 0,
    "createdAt": "2026-05-06T00:00:00.000Z",
    "updatedAt": "2026-05-06T00:00:00.000Z"
  }
}
```

### 3. Test Connection

**Endpoint:** `POST /api/admin/whatsapp/accounts/:id/test`

**Permission Required:** `settings:write`

**Response:**
```json
{
  "success": true,
  "message": "Test koneksi berhasil"
}
```

### 4. Set Default Account

**Endpoint:** `POST /api/admin/whatsapp/accounts/:id/set-default`

**Permission Required:** `settings:write`

**Response:**
```json
{
  "success": true,
  "message": "Akun berhasil diset sebagai default"
}
```

## Usage

### Send Single Message (Auto-Routing)

```typescript
import { WhatsAppSenderService } from "@/modules/notification";

const sender = new WhatsAppSenderService();

const result = await sender.send({
  phone: "628123456789",
  message: "Hello from NetManager!",
  tenantId: "tenant-id",
});

if (result.success) {
  console.log("Message sent:", result.messageId);
} else {
  console.error("Failed:", result.error);
}
```

### Send via Specific Account

```typescript
const result = await sender.send({
  phone: "628123456789",
  message: "Hello from CS Team",
  accountId: "clx123abc", // Specific account
  tenantId: "tenant-id",
});
```

### Broadcast with Load Balancing

```typescript
const results = await sender.broadcast({
  phones: ["628111", "628222", "628333"],
  message: "Promo hari ini!",
  loadBalance: true, // Distribusi ke multiple accounts
  tenantId: "tenant-id",
});

console.log(`Sent: ${results.filter(r => r.success).length}`);
console.log(`Failed: ${results.filter(r => !r.success).length}`);
```

### Send File

```typescript
const result = await sender.send({
  phone: "628123456789",
  fileUrl: "https://example.com/invoice.pdf",
  message: "Invoice Anda", // Optional caption
  tenantId: "tenant-id",
});
```

## API Endpoints

### Account Management

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/admin/whatsapp/accounts` | List all accounts | `settings:read` |
| POST | `/api/admin/whatsapp/accounts` | Create account | `settings:write` |
| GET | `/api/admin/whatsapp/accounts/:id` | Get account | `settings:read` |
| PATCH | `/api/admin/whatsapp/accounts/:id` | Update account | `settings:write` |
| DELETE | `/api/admin/whatsapp/accounts/:id` | Delete account | `settings:write` |
| POST | `/api/admin/whatsapp/accounts/:id/test` | Test connection | `settings:write` |
| POST | `/api/admin/whatsapp/accounts/:id/set-default` | Set as default | `settings:write` |

### Sending (Internal)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/internal/whatsapp/send` | Send message | Yes |

### Monitoring

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/admin/whatsapp/messages` | Message history | `settings:read` |
| GET | `/api/admin/whatsapp/stats` | Usage statistics | `settings:read` |

## Auto-Routing Logic

Sistem memilih account dengan urutan prioritas:

1. **Default Account** - Jika ada dan available
2. **Highest Priority** - Account dengan priority tertinggi
3. **Available** - Account yang belum mencapai daily limit
4. **Fallback** - Retry dengan account lain jika gagal

## Daily Limit & Reset

- Daily limit di-track per account
- Counter otomatis reset setiap 24 jam
- Jika account mencapai limit, sistem otomatis pilih account lain
- Admin bisa set `dailyLimit: null` untuk unlimited

## Message Status

| Status | Description |
|--------|-------------|
| `pending` | Pesan sedang diproses |
| `sent` | Pesan berhasil dikirim |
| `failed` | Pesan gagal dikirim |

## Security

- API keys di-encrypt di database menggunakan AES-256
- Only admin dengan permission `settings:write` bisa manage accounts
- Audit log untuk semua perubahan account
- Rate limiting per account

## Monitoring & Statistics

### Get Message History

```typescript
const messages = await sender.getMessages("tenant-id", 50);
```

### Get Account Stats

```typescript
const stats = await sender.getAccountStats(
  "account-id",
  new Date("2026-05-01"),
  new Date("2026-05-31")
);

console.log(stats);
// {
//   total: 1500,
//   sent: 1450,
//   failed: 50,
//   pending: 0
// }
```

## Migration from Single Account

Existing code yang menggunakan `WhatsAppService` tetap berfungsi. Untuk migrate:

**Before:**
```typescript
import { WhatsAppService } from "@/modules/notification";

const service = new WhatsAppService();
await service.sendMessage({
  phone: "628123456789",
  message: "Hello",
});
```

**After:**
```typescript
import { WhatsAppSenderService } from "@/modules/notification";

const sender = new WhatsAppSenderService();
await sender.send({
  phone: "628123456789",
  message: "Hello",
  tenantId: session.user.tenantId,
});
```

## Troubleshooting

### Account tidak terdeteksi

**Problem:** `Tidak ada akun WhatsApp yang tersedia`

**Solution:**
1. Check apakah ada account dengan `isActive: true`
2. Check apakah account sudah mencapai daily limit
3. Verify API key masih valid dengan test connection

### Pesan gagal terkirim

**Problem:** Message status `failed`

**Solution:**
1. Check error message di `WhatsAppMessage.error`
2. Test connection untuk verify API key
3. Check provider status (Fonnte/Wablas down?)
4. Verify nomor tujuan format benar (628xxx)

### Daily limit tercapai

**Problem:** `Akun telah mencapai batas harian`

**Solution:**
1. Tunggu 24 jam untuk auto-reset
2. Atau tambahkan account baru
3. Atau increase daily limit

## Best Practices

1. **Set Priority** - Account utama priority tinggi, backup priority rendah
2. **Set Daily Limits** - Prevent abuse dan over-usage
3. **Monitor Stats** - Track usage untuk capacity planning
4. **Multiple Accounts** - Minimal 2 accounts untuk redundancy
5. **Test Regularly** - Test connection setiap account secara berkala

## Next Steps

- [ ] Build admin UI untuk manage accounts
- [ ] Add webhook untuk receive delivery status
- [ ] Implement retry queue untuk failed messages
- [ ] Add template message support
- [ ] Dashboard untuk monitoring real-time

---

**Support:** Jika ada pertanyaan, hubungi tim development.
