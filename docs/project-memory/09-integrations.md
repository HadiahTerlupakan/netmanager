# External Integrations Analysis

**Tanggal**: 2026-08-09  
**Versi**: 1.0  
**Status**: Complete Analysis

---

## Executive Summary

Aplikasi NetManager mengintegrasikan **23+ external services** yang dikategorikan dalam 6 kelompok utama:
1. **Payment Gateways** (8 providers): Xendit, Midtrans, Tripay, Duitku, BRI, BCA, DANA, Moota
2. **Network Devices** (3 protocols): MikroTik RouterOS, FreeRADIUS, OLT (SNMP)
3. **Communication Channels** (4 types): WhatsApp/Baileys, Email/SMTP, Push Notifications (Expo), Web Push
4. **Cloud Services** (3 providers): Firebase (Realtime DB + Firestore + Admin), Cloudflare R2, Kubernetes API
5. **Third-Party Systems** (1 integration): MixRadius (ISP Billing)
6. **Location Services** (2 libs): Leaflet (OSM), Geolib

**Critical Dependencies**: Payment gateways, MikroTik provisioning, Firebase realtime, WhatsApp notifications
**Single Point of Failure**: Firebase Realtime Database (untuk realtime updates), Redis (untuk session/queue)

---

## 1. Payment Gateways

### 1.1 Overview

NetManager mendukung 8 payment providers dengan arsitektur **Strategy Pattern** melalui `PaymentProvider` interface.

**Common Interface**:
```typescript
interface PaymentProvider {
  name: string;
  initialize(config: ProviderConfig): void;
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
  checkStatus(orderId: string): Promise<TransactionStatus>;
  cancelPayment(orderId: string): Promise<void>;
  verifyWebhook(payload: unknown, signature?: string, rawBody?: string): boolean;
  processWebhook(payload: unknown): Promise<WebhookResult>;
  testConnection(): Promise<TestResult>;
}
```

**Entry Point**: `modules/payment-gateway/services/provider-factory.ts`  
**Factory Pattern**: `ProviderFactory.createProvider(type: string)`

### 1.2 Xendit

**Tujuan**: Payment gateway dengan dukungan berbagai metode pembayaran (VA, e-wallet, QRIS, kartu kredit)

**Entry Points**:
- `modules/payment-gateway/services/providers/xendit-provider.ts`

**Authentication**:
- `XENDIT_API_KEY` - Secret key untuk API calls
- `XENDIT_CALLBACK_TOKEN` - Token untuk webhook verification

**SDK**: `xendit-node` v7.0.0 (lazy-loaded saat dibutuhkan)

**Request Format**:
```typescript
// Create Invoice
POST https://api.xendit.co/v2/invoices
Headers: Authorization: Bearer {secretKey}
Body: {
  external_id: orderId,
  amount: number,
  description: string,
  invoice_duration: seconds,
  customer: { givenNames, email, mobileNumber },
  success_redirect_url, failure_redirect_url
}
```

**Response Handling**:
- Success: `{ invoice_url, id, expiry_date }`
- Error: Logged + return `{ success: false, error: message }`

**Webhook Verification**:
- Metode: Callback token comparison (timing-safe)
- Header: `x-callback-token` atau field `callback_token` di payload
- Validasi: `timingSafeCompare(callbackToken, storedToken)`

**Error Handling**:
- No retry logic (one-shot request)
- Timeout: Default `fetchWithTimeout` (tidak eksplisit)
- Fallback: Return error message ke caller

**Configuration**:
```
XENDIT_API_KEY=sk_test_xxx (stored in DB per tenant)
XENDIT_CALLBACK_TOKEN=xxx (untuk webhook verification)
```

**Dependencies**: `xendit-node`, `@/lib/logger`

---

### 1.3 Midtrans

**Tujuan**: Payment gateway Indonesia dengan Snap UI dan Core API

**Entry Points**:
- `modules/payment-gateway/services/providers/midtrans-provider.ts`
- `modules/payment-gateway/services/providers/midtrans-provider-helpers.ts`

**Authentication**:
- `MIDTRANS_SERVER_KEY` - Server key untuk API auth
- `MIDTRANS_CLIENT_KEY` - Client key untuk frontend integration
- `MIDTRANS_IS_PRODUCTION` - Boolean flag untuk sandbox/production

**SDK**: `midtrans-client` v1.4.3

**Request Format**:
```typescript
// Snap Transaction
snap.createTransaction({
  transaction_details: { order_id, gross_amount },
  customer_details: { first_name, email, phone },
  item_details: [{ id, name, price, quantity }],
  callbacks: { finish, error, pending }
})
```

**Response Handling**:
- Success: `{ redirect_url, token }` (Snap payment page)
- Status check via Core API: `coreApi.transaction.status(orderId)`
- Mapping: `capture/settlement -> PAID`, `pending -> PENDING`, `deny/expire/cancel -> FAILED`

**Webhook Verification**:
- Metode: SHA512 signature
- Formula: `SHA512(order_id + status_code + gross_amount + serverKey)`
- Header: `signature_key` di payload
- Validasi: `timingSafeCompare(calculatedHash, signature_key)`

**Error Handling**:
- Transaction cancelation: `coreApi.transaction.cancel(orderId)`
- No automatic retry
- All errors logged via `logger.error`

**Configuration**:
```
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
```

**Dependencies**: `midtrans-client`, `crypto` (SHA512)

---

### 1.4 Tripay

**Tujuan**: Payment aggregator Indonesia (VA, e-wallet, retail outlet)

**Entry Points**:
- `modules/payment-gateway/services/providers/tripay-provider.ts`

**Authentication**:
- `TRIPAY_API_KEY` - API key untuk authorization header
- `TRIPAY_PRIVATE_KEY` - Private key untuk signature generation
- `TRIPAY_MERCHANT_CODE` - Merchant identifier

**SDK**: None (native fetch)

**API Base URL**:
- Production: `https://tripay.co.id/api`
- Sandbox: `https://tripay.co.id/api-sandbox`

**Request Format**:
```typescript
POST /transaction/create
Headers: { Authorization: Bearer {apiKey} }
Body: {
  method: "BRIVA",
  merchant_ref: orderId,
  amount: number,
  customer_name, customer_email, customer_phone,
  order_items: [{ sku, name, price, quantity }],
  expired_time: unix_timestamp,
  signature: HMAC_SHA256(merchant_code + merchant_ref + amount, privateKey)
}
```

**Response Handling**:
- Success: `{ checkout_url, qr_url, pay_code, reference, expired_time }`
- Status mapping: `PAID -> PAID`, `EXPIRED -> EXPIRED`, `FAILED -> FAILED`, `REFUND -> CANCELLED`

**Webhook Verification**:
- Metode: HMAC SHA256
- Input: Raw request body
- Header: Custom signature header (dari Tripay)
- Validasi: `timingSafeCompare(HMAC_SHA256(rawBody, privateKey), signature)`

**Error Handling**:
- Timeout: `fetchWithTimeout` (default)
- No retry
- Cancellation: Not supported (let expire naturally)

**Configuration**:
```
TRIPAY_API_KEY=xxx
TRIPAY_PRIVATE_KEY=xxx
TRIPAY_MERCHANT_CODE=T1234
TRIPAY_IS_PRODUCTION=false
```

**Dependencies**: `crypto` (HMAC), `@/lib/logger`

---

### 1.5 Duitku

**Tujuan**: Payment gateway Indonesia dengan berbagai channel

**Entry Points**:
- `modules/payment-gateway/services/providers/duitku-provider.ts`
- `modules/payment-gateway/services/providers/duitku-provider-helpers.ts`

**Authentication**:
- `DUITKU_MERCHANT_CODE` - Merchant identifier
- `DUITKU_API_KEY` - API key untuk signature generation

**SDK**: None (native fetch)

**API Base URL**:
- Production: `https://passport.duitku.com/webapi/api`
- Sandbox: `https://sandbox.duitku.com/webapi/api`

**Request Format**:
```typescript
POST /merchant/createinvoice
Body: {
  merchantCode, paymentAmount, paymentMethod: "VC",
  merchantOrderId, productDetails, merchantUserInfo,
  customerVaName, email, phoneNumber,
  callbackUrl, returnUrl,
  signature: MD5(merchantCode + merchantOrderId + paymentAmount + apiKey),
  expiryPeriod: minutes
}
```

**Response Handling**:
- Success code: `statusCode === "00"`
- Return: `{ paymentUrl, vaNumber, reference }`
- Status codes: `00 -> PAID`, `01 -> PENDING`, others -> FAILED`

**Webhook Verification**:
- Metode: MD5 signature
- Formula: `MD5(merchantCode + amount + merchantOrderId + apiKey)`
- Field: `signature` di payload
- Validasi: `timingSafeCompare(expectedSignature, payload.signature)`

**Error Handling**:
- Test connection: Query transaction status dengan dummy orderId
- No retry logic
- Cancellation: Not supported

**Configuration**:
```
DUITKU_MERCHANT_CODE=D1234
DUITKU_API_KEY=xxx
DUITKU_IS_PRODUCTION=false
```

**Dependencies**: `crypto` (MD5), `@/lib/utils/env`

---

### 1.6 Moota

**Tujuan**: Bank mutation checker untuk validasi transfer manual (bukan payment gateway tradisional)

**Entry Points**:
- `modules/payment-gateway/services/providers/moota-provider.ts`

**Authentication**:
- `MOOTA_API_KEY` - Bearer token untuk API authorization
- `MOOTA_WEBHOOK_SECRET` - Secret untuk HMAC verification

**SDK**: None (native fetch)

**API Base URL**: `https://app.moota.co/api/v2`

**Request Format**:
```typescript
// Moota tidak create payment (manual transfer)
// Hanya monitoring mutasi bank
GET /profile
Headers: { Authorization: Bearer {apiKey} }
```

**Response Handling**:
- **Webhook-driven**: Moota push notifikasi saat mutasi masuk
- Webhook payload: Array of mutations
- Match payment: Berdasarkan `amount` (unique amount matching)
- Status: `type === "CR" -> PAID` (Credit = uang masuk)

**Webhook Verification**:
- Metode: HMAC SHA256
- Input: Raw request body
- Validasi: `HMAC_SHA256(rawBody, webhookSecret)`

**Unique Amount Strategy**:
- Invoice amount + random 1-999 rupiah (unique code)
- Backend harus match mutation amount dengan pending payment

**Error Handling**:
- No retry (webhook-based)
- Test connection: Fetch profile endpoint

**Configuration**:
```
MOOTA_API_KEY=Bearer_xxx
MOOTA_WEBHOOK_SECRET=xxx
```

**Dependencies**: `crypto` (HMAC SHA256)

**Special Notes**:
- Bukan VA/QRIS gateway, tapi bank mutation monitoring
- Customer transfer manual ke rekening bank ISP
- System match berdasarkan unique amount
- Tidak ada payment URL generation

---

### 1.7 BRI & BCA Providers

**Entry Points**:
- `modules/payment-gateway/services/providers/bri-provider.ts`
- `modules/payment-gateway/services/providers/bca-provider.ts`

**Status**: Placeholder implementations (belum fully integrated)

**Authentication**: TBD (API credentials per bank)

**SDK**: None

**Notes**: 
- Struktur mengikuti `PaymentProvider` interface
- Implementasi aktual tergantung ketersediaan API dari bank
- Biasanya melalui virtual account atau direct API integration

---

### 1.8 DANA Provider

**Entry Points**:
- `modules/payment-gateway/services/providers/dana-provider.ts`

**Status**: Placeholder implementation

**Authentication**: TBD

**SDK**: None

**Notes**: E-wallet integration untuk DANA

---

### 1.9 Payment Gateway Architecture

**Factory Pattern**:
```typescript
// modules/payment-gateway/services/provider-factory.ts
class ProviderFactory {
  static createProvider(type: string): PaymentProvider {
    switch(type.toUpperCase()) {
      case "XENDIT": return new XenditProvider();
      case "MIDTRANS": return new MidtransProvider();
      // ... 8 providers total
    }
  }
}
```

**Webhook Processing Flow**:
```
1. Request masuk ke /api/webhooks/[provider]
2. WebhookProcessingService.process()
   - Load provider config from DB (per tenant)
   - Parse rawBody + headers
   - provider.verifyWebhook() → signature check
   - provider.processWebhook() → normalize payload
   - Update payment status di database
   - Trigger events (payment.received)
3. Return 200 OK ke payment gateway
```

**Entry Point**: `app/api/webhooks/[provider]/route.ts`

**Common Security**:
- Semua webhook verification pakai `timingSafeCompare` (constant-time)
- Raw body disimpan untuk signature verification
- Signature di header atau payload tergantung provider
- No webhook = no payment confirmation (zero trust)

**Timeout Configuration**:
- `fetchWithTimeout` utility (default ~30s, configurable)
- No automatic retry di provider layer
- Retry logic handled di application layer (service/queue)

**Error Classification**:
- Network errors: Logged + return error message
- Invalid credentials: Detected via test connection endpoint
- Webhook failures: Logged + return 200 (prevent retry storm)

**Configuration Storage**:
- Per-tenant settings di `Settings` table
- API keys encrypted at rest
- Config cached selama 1 menit (R2Settings pattern)

---

## 2. Network Device Integrations

### 2.1 MikroTik RouterOS

**Tujuan**: Provisioning PPPoE users, bandwidth management, monitoring router status

**Entry Points**:
- `modules/network/services/MikroTikMonitor.ts`
- `modules/network/services/mikrotik-router.mutations.ts`
- `modules/network/services/mikrotik-ppp-secret.operations.ts`
- `modules/network/services/mikrotik-ppp-profile.ts`
- `modules/network/services/mikrotik-ip-pool-client.ts`

**Authentication**:
- Per-router credentials stored in `MikrotikRouter` table
- Fields: `host`, `port`, `username`, `password`
- Credentials encrypted at rest

**SDK**: `node-routeros-v2` v1.6.12

**Connection Pattern**:
```typescript
import RouterOSClient from "node-routeros-v2";

const client = new RouterOSClient({
  host: router.host,
  user: router.username,
  password: router.password,
  port: router.port || 8728,
  timeout: 10000
});

await client.connect();
// Execute commands
await client.close();
```

**Key Operations**:

1. **PPPoE Secret Management**:
   ```typescript
   // Create user
   POST /ppp/secret/add
   {
     name: username,
     password: password,
     service: "pppoe",
     profile: profileName,
     comment: metadata
   }
   
   // Update user
   POST /ppp/secret/set
   { .id: secretId, password: newPassword, profile: newProfile }
   
   // Delete user
   POST /ppp/secret/remove
   { .id: secretId }
   ```

2. **PPP Profile Management**:
   ```typescript
   POST /ppp/profile/add
   {
     name: profileName,
     "local-address": ipPool,
     "remote-address": ipPool,
     "rate-limit": "10M/10M",
     comment: metadata
   }
   ```

3. **Active Session Monitoring**:
   ```typescript
   GET /ppp/active
   Response: [{ name, address, uptime, "caller-id" }]
   ```

4. **Router Health Check**:
   ```typescript
   GET /system/resource
   Response: { "cpu-load", "free-memory", "total-memory", uptime }
   ```

**Monitoring Strategy**:
- `MikroTikMonitor` polling interval: 5 minutes
- Checks router status via ping + API health
- Publishes stats ke Firebase Realtime untuk dashboard
- Auto-backoff jika error: 2^(errorCount-2) × 5 minutes (max 8×)

**Error Handling**:
- Connection timeout: 10 seconds default
- Max consecutive errors: 5 (before monitor stops)
- Error types: `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`
- Automatic reconnection dengan exponential backoff

**Provisioning Flow**:
```
1. Customer registration
2. Create PPPoE secret di all assigned routers (per site/tenant)
3. Sync profile bandwidth sesuai paket
4. Store mapping di database (Customer ↔ PPPoE Username)
5. Monitor active sessions
```

**Configuration**:
```typescript
// Per-router config di database
{
  host: "192.168.1.1",
  port: 8728,
  username: "admin",
  password: "encrypted_password",
  siteId: "site-uuid",
  tenantId: "tenant-uuid"
}
```

**Dependencies**: `node-routeros-v2`, `@/lib/logger`

**Critical Path**: Customer activation/suspension bergantung pada MikroTik API availability

---

### 2.2 FreeRADIUS

**Tujuan**: PPPoE authentication server, accounting, session management

**Entry Points**:
- `modules/network/services/RadiusMonitor.ts`
- `modules/network/repositories/RadiusRepository.ts`
- `lib/prisma-radius.ts`

**Authentication**:
- Database-level access via separate Prisma client
- Connection string: `DATABASE_RADIUS_URL`

**Database Schema**: FreeRADIUS standard schema
- `radcheck` - User authentication data
- `radreply` - User-specific attributes
- `radacct` - Accounting/session records
- `radgroupcheck`, `radgroupreply` - Group attributes

**Integration Pattern**:
- **Direct database access** (bukan API calls)
- Read-only untuk monitoring
- Write via RADIUS protocol (ports 1812/UDP auth, 1813/UDP accounting)

**Key Operations**:

1. **Session Monitoring**:
   ```sql
   SELECT * FROM radacct 
   WHERE acctstoptime IS NULL 
   ORDER BY acctstarttime DESC
   ```

2. **Dashboard Statistics**:
   ```typescript
   getDashboardStats(tenantId) {
     // Active sessions count
     // Total data usage today
     // Unique users online
   }
   ```

3. **Recent Sessions**:
   ```typescript
   getRecentSessions(tenantId, { limit: 50, status: "active" })
   ```

**Monitoring Strategy**:
- `RadiusMonitor` polling: 5 minutes
- Publishes to Firebase scope: `admin:radius:{tenantId}`
- Only publishes if there are active consumers (optimization)
- Multi-tenant isolation via tenant context

**Data Flow**:
```
MikroTik PPPoE Server → FreeRADIUS (Auth) → radacct table → RadiusMonitor → Firebase → Dashboard
```

**Configuration**:
```env
DATABASE_RADIUS_URL=postgresql://user:pass@host:5432/radius
```

**Dependencies**: `@prisma/client` (separate schema), Firebase Realtime

**Security**:
- RADIUS secrets stored per NAS (Network Access Server)
- Database credentials separate dari main DB
- Read-only access untuk monitoring queries

**Performance**:
- Indexes on: `username`, `acctstarttime`, `acctstoptime`
- Partition by date untuk `radacct` (large table)
- Query optimization: Filter by tenantId early

---

### 2.3 OLT Management (SNMP)

**Tujuan**: Optical Line Terminal management untuk Fiber network (ONT status, signal, provisioning)

**Entry Points**:
- `modules/olt/services/SnmpExplorerService.ts`
- `modules/olt/services/FirmwareUpgradeService.ts`
- `modules/olt/services/OltCardService.ts`
- `modules/olt/adapters/zte/ZteSnmpClient.ts`

**Authentication**:
- SNMP v2c community string (per OLT device)
- Stored in `Olt` table: `{ host, snmpCommunity, snmpPort }`

**SDK**: `net-snmp` v3.26.1

**Connection Pattern**:
```typescript
import * as snmp from "net-snmp";

const session = snmp.createSession(host, community, {
  port: snmpPort || 161,
  retries: 1,
  timeout: 5000,
  version: snmp.Version2c
});

session.get([oid], (error, varbinds) => {
  // Process response
});
```

**Key Operations**:

1. **OID Walk** (Discover ONTs):
   ```typescript
   walkOidTree(oltId, baseOid: "1.3.6.1.4.1.3902")
   // Returns: [{ oid, type, value }]
   ```

2. **Get OID Value** (Signal strength):
   ```typescript
   getOidValue(oltId, oid: "1.3.6.1.4.1.3902.1082.500.10.2.1.1.1.5")
   // Returns signal level in dBm
   ```

3. **ONT Status Check**:
   ```typescript
   // OID patterns untuk ZTE OLT
   ontStatus: 1.3.6.1.4.1.3902.1082.500.10.2.1.1.1.{index}
   ontRxPower: 1.3.6.1.4.1.3902.1082.500.10.2.1.1.1.5.{index}
   ```

**Supported Vendors**:
- **ZTE**: Fully implemented (`ZteSnmpClient`)
- **Huawei**: Planned (different OID tree)
- **Fiberhome**: Planned

**Value Formatting**:
```typescript
formatValue(varbind) {
  if (Buffer.isBuffer(value)) {
    return `HEX: ${hex} | ASCII: ${ascii}`;
  }
  return String(value);
}
```

**Error Handling**:
- SNMP timeout: 5 seconds
- Retries: 1 attempt
- Error codes: `SNMP_ERROR`, `NOT_FOUND`
- All errors logged dengan OLT context

**Configuration**:
```typescript
// Per-OLT config di database
{
  name: "OLT-Core-1",
  host: "10.10.10.1",
  snmpCommunity: "public",
  snmpPort: 161,
  vendor: "ZTE",
  model: "C320",
  tenantId: "xxx"
}
```

**Dependencies**: `net-snmp`, `@/lib/logger`

**Performance Considerations**:
- SNMP walk dapat memakan waktu lama (1000+ OIDs)
- Implementasi pagination untuk large OID trees
- Cache hasil walk selama 5 menit

**Security**:
- SNMP community strings encrypted at rest
- Read-only community untuk monitoring
- Write community untuk provisioning (restricted)

---

## 3. Communication Integrations

### 3.1 WhatsApp (Baileys)

**Tujuan**: Send WhatsApp notifications, invoices, customer communications

**Entry Points**:
- `modules/notification/services/whatsapp/baileys-session-manager.ts`
- `modules/notification/services/whatsapp/baileys-session-send.ts`
- `modules/notification/services/whatsapp/baileys-provider.ts`
- `modules/notification/services/whatsapp-account.service.ts`

**Authentication**:
- QR Code pairing (browser-based auth)
- Session credentials stored di `.baileys-sessions/{sessionId}/`
- Multi-device support (WhatsApp Web protocol)

**SDK**: `@whiskeysockets/baileys` v7.0.0-rc13

**Connection Pattern**:
```typescript
import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason 
} from "@whiskeysockets/baileys";

const { state, saveCreds } = await useMultiFileAuthState(authDir);
const sock = makeWASocket({
  auth: state,
  printQRInTerminal: false,
  browser: ["Chrome", "Ubuntu"],
  keepAliveIntervalMs: 15000
});

sock.ev.on("connection.update", (update) => {
  // Handle QR, connected, disconnected
});
```

**Session Management**:
- **Multi-pod coordination** via Redis locks
- Lock key: `baileys:lock:{sessionId}` → Pod ID
- Lock TTL: 60 seconds (renewed every 20s)
- Only lock owner can open socket (prevents conflict 440)

**Key Operations**:

1. **Start Session**:
   ```typescript
   startBaileysSession(sessionId, { forcePairing: false })
   // Returns: { status: "qr"|"connected", qr?: dataUrl, phone?: string }
   ```

2. **Send Message**:
   ```typescript
   sendBaileysMessage(sessionId, phone, message)
   // Returns: { success: boolean, messageId?: string }
   ```

3. **Send File/Document**:
   ```typescript
   sendBaileysFile(sessionId, phone, fileUrl, caption)
   ```

4. **Remote Command Dispatch**:
   ```typescript
   // Pod tanpa lock forward command ke pod owner via Redis queue
   dispatchRemoteCmd(sessionId, { type: "send", phone, message })
   // Timeout: 15 seconds
   // Retries: 3 attempts
   ```

**Redis-Based Architecture**:
```
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Pod A   │         │  Redis  │         │ Pod B   │
│ (owner) │◄────────┤  Queue  │◄────────┤ (caller)│
└─────────┘         └─────────┘         └─────────┘
    │                    │                    │
    ├─ Lock: baileys:lock:{sessionId} = PodA
    ├─ Session state persisted
    └─ Command loop: brpop baileys:cmd:{sessionId}
```

**Session States**:
- `disconnected` - Not started
- `connecting` - Opening socket
- `qr` - Waiting for QR scan
- `connected` - Active session
- `needs_reauth` - Logged out by WhatsApp
- `error` - Connection failed

**State Persistence**:
- Redis: `baileys:session:{sessionId}` (TTL: 180s untuk QR, 86400s untuk connected)
- Disk: `.baileys-sessions/{sessionId}/creds.json` (auth credentials)

**Monitoring & Health**:
- QR wait timeout: 25 seconds
- Refresh interval: 240 seconds (4 minutes) untuk persist state
- Lock heartbeat: 20 seconds
- Reconnect strategy: Exponential backoff (5s × 1.5^attempt, max 60s)

**Error Handling**:
- Disconnect code 440 (conflict): Another pod/device opened same session
- Disconnect logged_out: Clear auth state, require QR re-scan
- Connection failures: Auto-reconnect dengan backoff
- ENOENT creds read: Suppressed (expected pada first start)

**Multi-Account Support**:
- Per-tenant multiple WhatsApp accounts
- Account routing: `whatsapp-account-routing.service.ts`
- Selection strategy: Round-robin atau specific account per site

**Webhook/Callback Handling**:
- `messages.update` event → Update delivery status di database
- Receipt tracking: `sent`, `delivered`, `read`, `failed`

**Configuration**:
```typescript
// Per-account config di database
{
  id: "account-uuid",
  sessionId: "wa-tenant-1",
  name: "Customer Service",
  phone: "628123456789", // Auto-detected after connect
  tenantId: "tenant-uuid",
  isActive: true
}
```

**Dependencies**: `@whiskeysockets/baileys`, `qrcode`, `pino` (logger), Redis

**Performance**:
- Command queue timeout: 15 seconds
- Remote command retries: 3 attempts dengan 2s backoff
- Max 1 socket per sessionId across all pods

**Security**:
- Session credentials pada disk (file-based)
- No plaintext credentials di database
- Redis lock mencegah concurrent access

**Critical Notes**:
- WhatsApp dapat ban nomor jika spam (rate limiting penting)
- QR harus di-scan dalam 3 menit (180s TTL)
- Logout remote membutuhkan QR scan ulang
- Multi-device protocol (stable sejak 2021)

---

### 3.2 Email (Nodemailer)

**Tujuan**: Send email notifications, invoices, reports, alerts

**Entry Points**:
- `modules/notification/services/email-service.ts`
- `modules/notification/services/email-error-classifier.ts`

**Authentication**:
- Per-tenant SMTP credentials stored di `Settings` table
- Fields: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Password encrypted at rest

**SDK**: `nodemailer` v8.0.5

**Connection Pattern**:
```typescript
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort, // 587 (TLS) atau 465 (SSL)
  secure: config.smtpPort === 465,
  auth: { 
    user: config.smtpUser, 
    pass: config.smtpPass 
  }
});

await transporter.sendMail({
  from: `"${fromName}" <${fromEmail}>`,
  to: recipient,
  subject: subject,
  html: htmlBody,
  text: textBody,
  attachments: [{ filename, content: Buffer }]
});
```

**Key Operations**:

1. **Send Email**:
   ```typescript
   sendEmail({
     to: email,
     subject: string,
     html?: string,
     text?: string,
     tenantId: string,
     attachments?: Array<{filename, content, contentType}>,
     dedupeWindowMs?: number // Anti-duplicate guard
   })
   ```

2. **Test Connection**:
   ```typescript
   testConnection(tenantId, testEmail)
   // Sends test email dengan config dari DB
   ```

3. **Test With Config**:
   ```typescript
   testWithConfig(config, testEmail)
   // Test SMTP tanpa save ke DB (untuk form validation)
   ```

**Delivery Logging**:
- Repository: `EmailDeliveryLogRepository`
- States: `PENDING`, `SENT`, `FAILED`
- Flow:
  1. Create log dengan status `PENDING`
  2. Attempt send
  3. Update ke `SENT` (with messageId) atau `FAILED` (with error category)

**Error Classification**:
```typescript
// email-error-classifier.ts
classifyEmailError(error) {
  // Returns: { category, safeMessage }
  // Categories:
  // - AUTH_FAILED (Invalid credentials)
  // - CONNECTION_FAILED (Network/DNS)
  // - INVALID_RECIPIENT (Bounce)
  // - RATE_LIMITED (Quota exceeded)
  // - UNKNOWN (Other errors)
}
```

**Deduplication**:
```typescript
// Prevent double-send dalam window waktu
dedupeWindowMs: 300_000 // 5 menit
// Check: hasRecentDelivery(to, subject, tenantId, sinceMs)
```

**Attachment Limits**:
- Single file: 10 MB
- Total attachments: 10 MB
- Validation: Pre-flight check before send

**SMTP Port Validation**:
- Default: 587 (STARTTLS)
- SSL: 465
- Range: 1-65535
- Validation: `parseSmtpPort(raw)`

**Configuration Loading**:
```typescript
loadEmailConfig(tenantId) {
  // Load dari Settings table
  // Required: SMTP_HOST, SMTP_USER, SMTP_PASS
  // Optional: FROM_EMAIL (default: SMTP_USER), FROM_NAME, SMTP_PORT (default: 587)
  // Decrypt SMTP_PASS if encrypted
  // Validate FROM_EMAIL format
}
```

**Error Handling**:
- Connection timeout: Nodemailer default (~60s)
- No automatic retry (handled by caller/queue)
- Auth failures: Logged dengan category `AUTH_FAILED`
- Rate limit: Logged dengan category `RATE_LIMITED`

**Configuration**:
```env
# Per-tenant di database Settings table
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@isp.com
SMTP_PASS=encrypted_password
FROM_NAME=NetManager ISP
FROM_EMAIL=noreply@isp.com
```

**Dependencies**: `nodemailer`, `@/lib/logger`

**Security**:
- SMTP credentials encrypted at rest
- TLS/SSL support
- No credential logging (masked in errors)
- Safe error messages ke user (no internal details)

**Performance**:
- Config cache: 1 minute TTL
- Attachment size pre-validation
- Dedupe check via indexed query

**Common SMTP Providers**:
- Gmail: smtp.gmail.com:587 (App Password required)
- Office365: smtp.office365.com:587
- SendGrid: smtp.sendgrid.net:587
- Mailgun: smtp.mailgun.org:587

---

### 3.3 Push Notifications (Expo)

**Tujuan**: Send mobile push notifications ke Expo-based mobile app

**Entry Points**:
- `lib/expo.ts`
- `modules/notification/services/NotificationService.delivery.ts`
- `modules/notification/services/MobileFcmTokenCleanupService.ts`

**Authentication**:
- Expo Push Token validation (client provides token)
- No API key required (free service dari Expo)

**SDK**: `expo-server-sdk` v6.1.0

**Connection Pattern**:
```typescript
import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

// Validate token
if (!Expo.isExpoPushToken(token)) {
  throw new Error("Invalid token");
}

// Send notification
const messages: ExpoPushMessage[] = [{
  to: token,
  sound: "default",
  title: "New Invoice",
  body: "Your invoice is ready",
  data: { orderId: "123" }
}];

const chunks = expo.chunkPushNotifications(messages);
for (const chunk of chunks) {
  const tickets = await expo.sendPushNotificationsAsync(chunk);
  // Process tickets (success/error)
}
```

**Key Operations**:

1. **Send Push Notification**:
   ```typescript
   sendExpoPushNotifications(
     tokens: string[],
     title: string,
     body: string,
     data?: Record<string, unknown>
   )
   ```

2. **Token Validation**:
   ```typescript
   Expo.isExpoPushToken(token)
   // Format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
   ```

3. **Batch Processing**:
   - Expo limits: 100 notifications per request
   - SDK automatically chunks messages
   - Parallel chunk sending

**Token Management**:
- Tokens stored di `MobileFcmToken` table
- Fields: `{ userId, deviceId, token, platform: "android"|"ios" }`
- Cleanup service: Remove stale tokens (devices yang uninstall app)

**Delivery Tickets**:
```typescript
// Immediate response dari Expo
{
  status: "ok" | "error",
  id?: string, // Receipt ID untuk tracking
  message?: string, // Error message
  details?: { error: "DeviceNotRegistered" | "InvalidCredentials" | ... }
}
```

**Error Handling**:
- `DeviceNotRegistered`: Remove token dari database
- `InvalidCredentials`: Log error (config issue)
- `MessageTooBig`: Truncate payload
- `MessageRateExceeded`: Implement backoff

**Token Cleanup Strategy**:
```typescript
// MobileFcmTokenCleanupService
// Run daily: Remove tokens yang:
// - Expired (> 60 days inactive)
// - Receipt error: DeviceNotRegistered
// - User deleted
```

**Configuration**:
```typescript
// No config required (Expo free service)
// Tokens auto-generated oleh Expo SDK di mobile app
```

**Dependencies**: `expo-server-sdk`, `@/lib/logger`

**Limitations**:
- Rate limit: 600 notifications/second (per Expo account)
- Message size: 4 KB max
- TTL: 30 days (if device offline)
- Free tier: Unlimited (Expo-sponsored)

**Best Practices**:
- Batch notifications when possible
- Validate tokens before send
- Handle errors gracefully
- Remove invalid tokens immediately
- Include actionable data payload

**Data Payload Structure**:
```typescript
{
  type: "invoice" | "announcement" | "workorder",
  id: string, // Resource ID
  action?: "view" | "approve" | "reject"
}
```

---

### 3.4 Web Push (Service Worker)

**Tujuan**: Browser push notifications untuk web dashboard

**Entry Points**:
- `lib/websocket/emitter.ts` (legacy fallback)
- Firebase Cloud Messaging (FCM) untuk web push

**Authentication**:
- VAPID keys (web push standard)
- FCM Web credentials

**SDK**: `web-push` v3.6.7 (server), Firebase SDK (client)

**Configuration**:
```env
# Firebase Web Config (public)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Firebase Admin (server)
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx
FIREBASE_PRIVATE_KEY=xxx
```

**Integration Pattern**:
- Service Worker registration di `/sw.js`
- FCM token generation via `useFCM` hook
- Token storage di user session
- Notification delivery via Firebase Admin SDK

**Token Management**:
- Similar dengan Expo tokens
- Stored per device/browser
- Auto-refresh on expiry

**Dependencies**: `web-push`, `firebase`, `firebase-admin`

**Status**: Partially implemented (infrastructure ready, full integration pending)

---

## 4. Cloud Services

### 4.1 Firebase Suite

**Tujuan**: Realtime updates, presence, authentication, file storage

#### 4.1.1 Firebase Realtime Database

**Entry Points**:
- `lib/realtime/firebase-realtime-service.ts`
- `lib/realtime/RealtimeContext.tsx`
- `modules/attendance/services/LocationRealtimePublisher.ts`

**Authentication**:
- Server: Firebase Admin SDK dengan service account
- Client: Custom token generation via `/api/auth/firebase-token`

**SDK**: 
- Server: `firebase-admin` v13.0.0
- Client: `firebase` v12.11.0

**Connection Pattern**:
```typescript
// Server-side
import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();
```

**Key Operations**:

1. **Publish Event**:
   ```typescript
   publish({
     type: "mikrotik.update",
     scope: { kind: "admin", id: "notifications" },
     payload: data
   })
   // Writes to: /channels/admin:notifications/{docId}
   ```

2. **Presence Management**:
   ```typescript
   // Client-side
   const presenceRef = ref(db, `/presence/${userId}`);
   onDisconnect(presenceRef).set({ isOnline: false });
   set(presenceRef, { isOnline: true, lastSeenAt: timestamp });
   ```

3. **Check Active Consumers**:
   ```typescript
   hasActiveScopeConsumers(scope)
   // Prevents unnecessary Firestore writes
   ```

**Scope-Based Channels**:
```typescript
type RealtimeScope = 
  | { kind: "user", id: userId }
  | { kind: "admin", id: "notifications" | "notifications.site.{siteId}" }
  | { kind: "department", id: departmentId }
  | { kind: "workorder", id: workorderId }
  | { kind: "ticket", id: ticketId };

// Channel path: `/channels/${scope.kind}:${scope.id}`
```

**Event Types**:
- `mikrotik.update` - Router status changes
- `radius.stats` - RADIUS dashboard updates
- `radius.sessions` - Active PPPoE sessions
- `attendance.location` - Real-time location tracking
- `notification.*` - User notifications
- `workorder.*` - Work order updates
- `ticket.*` - Ticket updates

**Optimization Strategies**:
- **Consumer checking**: Only publish if listeners exist
- **Polling reduction**: MikroTik 30s → 5min, RADIUS 30s → 5min
- **Scope isolation**: Per-tenant/user/department channels
- **TTL management**: Old events auto-expire (Firestore TTL)

**Configuration**:
```env
# Server (Admin SDK)
FIREBASE_PROJECT_ID=netmanager-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://netmanager-prod.firebaseio.com

# Client (Web SDK)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=netmanager-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=netmanager-prod
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://netmanager-prod.firebaseio.com
NEXT_PUBLIC_FIREBASE_APP_ID=1:xxx:web:xxx
```

**Dependencies**: `firebase`, `firebase-admin`

---

#### 4.1.2 Firebase Firestore

**Tujuan**: Realtime event streaming (pub/sub pattern)

**Entry Points**:
- `lib/realtime/RealtimeContext.tsx`
- Event subscriptions via `useRealtimeSubscription` hook

**Connection Pattern**:
```typescript
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

const channelQuery = query(
  collection(firestore, buildScopeChannel(scope)),
  orderBy("createdAt", "desc"),
  limit(20)
);

const unsubscribe = onSnapshot(channelQuery, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
      const data = change.doc.data();
      handler(data.payload);
    }
  });
});
```

**Event Deduplication**:
- Track `seenDocumentIds` Set
- Skip initial hydration (20 recent docs)
- Only process `added` changes after hydration

**Error Handling**:
```typescript
onSnapshot(query, successHandler, (error) => {
  clientLogger.error("Realtime Firestore subscription failed", {
    scope: serializeScope(scope),
    event: eventType,
    code: error.code,
    message: error.message
  });
});
```

**Performance**:
- Limit: 20 recent docs per channel (reduce initial load)
- Ordered by `createdAt DESC`
- Index required: `(scope, createdAt)`

---

#### 4.1.3 Firebase Authentication

**Tujuan**: Custom token generation untuk Firebase client auth

**Entry Points**:
- `app/api/auth/firebase-token/route.ts`
- `app/api/mobile/auth/firebase-token/route.ts`

**Token Generation**:
```typescript
// Server-side
const customToken = await admin.auth().createCustomToken(userId, {
  tenantId: user.tenantId,
  role: user.role
});

// Client-side
await signInWithCustomToken(auth, customToken);
```

**Token Claims**:
- `uid` - User ID (dari session)
- `tenantId` - Tenant isolation
- `role` - User role for security rules

**Security Rules** (Firestore):
```javascript
match /channels/{channel} {
  allow read: if request.auth != null 
    && request.auth.token.tenantId == resource.data.tenantId;
}
```

---

### 4.2 Cloudflare R2 (S3-Compatible Storage)

**Tujuan**: File storage untuk uploads (images, documents, APKs)

**Entry Points**:
- `lib/utils/r2-client.ts`

**Authentication**:
- R2 Access Key ID
- R2 Secret Access Key
- Account ID

**SDK**: `@aws-sdk/client-s3` v3.1015.0

**Connection Pattern**:
```typescript
import { S3Client } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED", // R2 compatibility
  responseChecksumValidation: "WHEN_REQUIRED"
});
```

**Key Operations**:

1. **Generate Presigned URL** (Direct upload dari browser):
   ```typescript
   getPresignedUrl(key, contentType, expiresIn = 3600)
   // Returns: { uploadUrl, publicUrl }
   // Client uploads directly to R2 (no server bandwidth)
   ```

2. **Upload from Server**:
   ```typescript
   uploadToR2(buffer, key, contentType, contentDisposition?)
   // Uses @aws-sdk/lib-storage for large files
   // Returns: publicUrl
   ```

3. **Download/Stream**:
   ```typescript
   getR2ObjectBuffer(key) // Load ke memory
   streamR2ObjectToFile(key, destinationPath) // Stream ke disk
   ```

4. **Delete**:
   ```typescript
   deleteFromR2(key)
   ```

5. **Check Existence**:
   ```typescript
   hasR2Object(key) // HeadObject command
   ```

**Key Generation Strategy**:
```typescript
generateR2Key(type, filename, subFolder?)
// Examples:
// - "uploads/pelanggan/1723123456789-photo.jpg"
// - "uploads/payment-proofs/1723123456789-receipt.pdf"
// - "uploads/apk/1723123456789-app-v1.2.3.apk"
// - "uploads/inventory/masuk/item-123/1723123456789-invoice.pdf"
```

**Upload Types**:
- `pelanggan` - Customer documents
- `payment-proofs` - Payment receipts
- `logos` - Tenant logos
- `kmz` - Map overlays
- `inventory-*` - Inventory transactions
- `employee-attendance` - Attendance photos
- `workorder-completion` - Work order photos
- `tickets` - Ticket attachments
- `app-version` - Mobile APK files
- `marketing` - Marketing materials
- `map-nodes` - Network topology

**Public URL Strategies**:
1. **Custom Domain** (R2 Public Bucket):
   ```
   https://cdn.isp.com/uploads/pelanggan/123-photo.jpg
   ```

2. **R2.dev URL**:
   ```
   https://bucket.accountid.r2.cloudflarestorage.com/uploads/...
   ```

**Configuration**:
```env
# Stored in Settings table (encrypted)
R2_ACCOUNT_ID=abc123
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=encrypted_xxx
R2_BUCKET_NAME=netmanager-uploads
R2_PUBLIC_URL=https://cdn.isp.com
R2_ENABLED=true
```

**Configuration Cache**:
- TTL: 1 minute
- Global singleton pattern
- Cache invalidation: `clearR2SettingsCache()`

**Test Connection**:
```typescript
testR2Connection(settings)
// HeadBucket command untuk verify access
// Errors: NoSuchBucket, AccessDenied, InvalidAccessKeyId, SignatureDoesNotMatch
```

**Error Handling**:
- Connection test before operations
- Graceful fallback (return null jika R2 disabled)
- Error codes mapped ke user-friendly messages

**Security**:
- Credentials encrypted at rest
- Presigned URLs expire (default 1 hour)
- Public bucket untuk read-only assets
- Private bucket untuk sensitive documents

**Performance**:
- Streaming untuk large files (APK 300MB+)
- Parallel uploads via presigned URLs
- CDN caching via R2 Public Bucket

**Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner`

**S3 Compatibility Notes**:
- R2 tidak support flexible checksums (override required)
- ForcePathStyle: true (R2 requirement)
- Region: "auto" (R2 global)

---

### 4.3 Kubernetes API

**Tujuan**: Automatic SSL certificate provisioning via cert-manager

**Entry Points**:
- `modules/tenant/services/K8sCertificateService.ts`

**Authentication**:
- In-cluster service account (auto-loaded via `loadFromCluster()`)
- RBAC permissions untuk cert-manager CRDs

**SDK**: `@kubernetes/client-node` v1.4.0

**Connection Pattern**:
```typescript
import { KubeConfig, CustomObjectsApi } from "@kubernetes/client-node";

const kc = new KubeConfig();
kc.loadFromCluster(); // In-cluster auth
const customApi = kc.makeApiClient(CustomObjectsApi);
```

**Key Operations**:

1. **Create Certificate**:
   ```typescript
   createCertificate({
     slug: "tenant-abc",
     domain: "abc.isp.com",
     namespace: "netmanager-production"
   })
   ```

   Creates cert-manager Certificate resource:
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: Certificate
   metadata:
     name: tenant-abc-tls
     namespace: netmanager-production
   spec:
     secretName: tenant-abc-tls
     issuerRef:
       name: letsencrypt-production
       kind: ClusterIssuer
     dnsNames:
       - abc.isp.com
   ```

2. **Delete Certificate**:
   ```typescript
   deleteCertificate(slug)
   ```

3. **Check Certificate Ready**:
   ```typescript
   checkCertificateReady(slug)
   // Returns true if Ready=True condition exists
   ```

**Integration Flow**:
```
1. Tenant creates custom domain (abc.isp.com)
2. K8sCertificateService.createCertificate()
3. cert-manager validates domain ownership (HTTP-01/DNS-01)
4. Let's Encrypt issues certificate
5. Certificate stored in Kubernetes Secret (tenant-abc-tls)
6. Ingress controller uses secret for TLS termination
```

**Configuration**:
```env
K8S_NAMESPACE=netmanager-production
# Service account auto-detected in-cluster
```

**Prerequisites**:
- cert-manager installed di cluster
- ClusterIssuer "letsencrypt-production" configured
- Ingress controller (nginx/traefik) configured
- DNS records pointing to cluster

**Error Handling**:
- Certificate creation failures logged
- Returns boolean (success/failure)
- No automatic retry (caller responsibility)

**Security**:
- RBAC: Service account limited to cert-manager resources
- Namespace isolation
- TLS certificates auto-renewed by cert-manager (90 days)

**Dependencies**: `@kubernetes/client-node`, `@/lib/logger`

**Use Case**: Multi-tenant SaaS dengan custom domain per tenant (white-label)

---

## 5. Third-Party Systems

### 5.1 MixRadius

**Tujuan**: Sync billing data dari external ISP billing system (MixRadius)

**Entry Points**:
- `modules/integrations/services/MixRadiusSyncService.ts`
- `modules/integrations/services/mixradius-service.client.ts`
- `modules/integrations/repositories/MixRadiusRepository.ts`

**Authentication**:
- MixRadius API credentials (per tenant)
- Stored in `IntegrationSettings` table

**SDK**: None (native fetch)

**API Base URL**: Configurable per tenant (misal: `https://billing.isp.com/api`)

**Key Operations**:

1. **Fetch Customers**:
   ```typescript
   fetchCustomersPPP({ length: 10000 })
   // Returns: { data: Array<MixRadiusCustomerDetail> }
   ```

2. **Fetch Income by Period**:
   ```typescript
   fetchIncomeByPeriod({
     startDate: "2024-01-01",
     endDate: "2024-01-31",
     length: 10000
   })
   // Returns: { data: Array<MixRadiusIncomePeriodRecord> }
   ```

3. **Sync All Customers**:
   ```typescript
   syncAllCustomers()
   // Upserts ke MixRadiusCustomer table
   // Links to Pelanggan by username
   ```

4. **Sync Invoices**:
   ```typescript
   syncInvoices(startDate, endDate)
   // Upserts ke MixRadiusInvoice table
   ```

5. **Get NPL Statistics**:
   ```typescript
   getNPLStatistics(groupId?)
   // Returns: { 
   //   totalCustomers, totalNplCustomers,
   //   buckets: { "0-30": {count, amount}, "31-60": ..., ...}
   // }
   ```

**Data Mapping**:
```typescript
// MixRadius → NetManager
{
  id: record.id,
  username: record.username,
  fullName: record.fullname,
  ownerName: record.owner_name,
  planName: record.plan_name,
  authStatus: record.auth_status,
  expiredOn: parseMixRadiusDate(record.expired_on),
  // ... mapped fields
}
```

**NPL (Non-Performing Loan) Analysis**:
- Aging buckets: 0-30, 31-60, 61-90, 91-120, 121-150, 150+ days
- Calculation: `diffDays = now - expiredDate`
- Amount estimation: Per-plan average atau global average
- Filtering: By owner group (investor/mitra)

**Sync Strategy**:
- Full sync: All customers (10k limit)
- Incremental: Yesterday's settlements (daily cron)
- On-demand: Specific date ranges

**Linking Logic**:
```typescript
findLinkedPelanggan(mixRadiusData) {
  // 1. Try by mixRadiusId (existing link)
  // 2. Fallback: Match by username
  // 3. Update link if found
  // 4. Update syncedAt timestamp
}
```

**Configuration**:
```typescript
// Per-tenant di IntegrationSettings
{
  type: "MIXRADIUS",
  config: {
    apiUrl: "https://billing.isp.com/api",
    apiKey: "encrypted_xxx",
    merchantCode: "ISP001"
  },
  isActive: true,
  tenantId: "tenant-uuid"
}
```

**Error Handling**:
- `MixRadiusConfigError`: Config belum diisi atau invalid
- Sync errors: Return `{ success: false, reason: message }`
- Network errors: Logged + propagated

**Dependencies**: Native fetch, `@/lib/logger`

**Performance**:
- Batch upsert per record (no bulk insert yet)
- Large datasets (10k+) dapat memakan waktu
- Consider background job untuk full sync

**Use Case**: 
- Migrasi dari MixRadius ke NetManager
- Dual-system operation (MixRadius sebagai source of truth)
- NPL reporting untuk finance team

---

## 6. Location Services

### 6.1 Leaflet (OpenStreetMap)

**Tujuan**: Interactive maps untuk network topology, customer locations, attendance tracking

**Entry Points**:
- `components/map/` (various map components)
- `hooks/useMap*` (map state management)

**Authentication**: None (OSM tiles are free)

**SDK**: 
- `leaflet` v1.9.4 (core)
- `react-leaflet` v5.0.0 (React bindings)
- `ol` v10.8.0 (OpenLayers, alternative)

**Tile Providers**:
```typescript
// Default: OpenStreetMap
https://tile.openstreetmap.org/{z}/{x}/{y}.png

// Alternatives:
// - Mapbox (requires API key)
// - Google Maps (requires API key)
// - Custom tile server
```

**Key Features**:
- Interactive marker placement
- Polyline drawing (network cables)
- KMZ overlay import
- Geolocation tracking
- Distance calculation

**Configuration**: No API key required untuk OSM

**Dependencies**: `leaflet`, `react-leaflet`, `ol`

---

### 6.2 Geolib

**Tujuan**: Distance calculation, geofencing, location validation

**Entry Points**:
- `lib/geo-utils.ts`
- Attendance geofencing logic

**SDK**: `geolib` v3.3.4

**Key Operations**:
```typescript
import { getDistance, isPointWithinRadius } from "geolib";

// Distance between two points (meters)
const distance = getDistance(
  { latitude: -6.2, longitude: 106.8 },
  { latitude: -6.3, longitude: 106.9 }
);

// Geofencing
const isInside = isPointWithinRadius(
  userLocation,
  officeLocation,
  radiusInMeters
);
```

**Use Cases**:
- Attendance check-in validation (user harus dalam radius kantor)
- Distance-based work order assignment
- Network coverage calculation

**Configuration**: No API key required

**Dependencies**: `geolib`

---

## 7. Integration Patterns

### 7.1 Direct API Calls

**Pattern**: Synchronous HTTP requests

**Used By**:
- Payment gateways (create payment, check status)
- MixRadius sync
- Email SMTP
- SNMP queries

**Pros**:
- Simple implementation
- Immediate feedback
- Easy error handling

**Cons**:
- Blocking operations
- Timeout sensitive
- No retry built-in

**Implementation**:
```typescript
// fetchWithTimeout utility
async function fetchWithTimeout(url, options, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

### 7.2 SDK-Based Integration

**Pattern**: Use official SDK libraries

**Used By**:
- Xendit (`xendit-node`)
- Midtrans (`midtrans-client`)
- MikroTik (`node-routeros-v2`)
- Baileys (`@whiskeysockets/baileys`)
- Firebase suite
- AWS S3 / R2

**Pros**:
- Type safety (TypeScript)
- Built-in retry logic (some SDKs)
- Automatic serialization
- Version compatibility

**Cons**:
- Dependency on SDK maintenance
- Bundle size increase
- Lock-in to SDK patterns

**Best Practices**:
- Lazy-load heavy SDKs (Xendit pattern)
- Wrap SDK calls dalam repository/service layer
- Mock SDKs dalam tests

---

### 7.3 Webhook Handlers

**Pattern**: Receive callbacks from external systems

**Used By**:
- Payment gateway webhooks
- Moota bank mutations
- WhatsApp delivery receipts

**Endpoint**: `app/api/webhooks/[provider]/route.ts`

**Flow**:
```
1. External system sends POST request
2. Extract rawBody + headers
3. Load tenant config from database
4. Verify signature (HMAC/SHA/token)
5. provider.processWebhook(payload)
6. Update database (payment status, message status)
7. Trigger events (payment.received)
8. Return 200 OK (always, even on error)
```

**Security Checklist**:
- ✅ Signature verification (timing-safe compare)
- ✅ Raw body preservation (untuk signature)
- ✅ HTTPS-only (production)
- ✅ Rate limiting (per IP)
- ✅ Idempotency (duplicate webhook handling)

**Error Handling**:
- Always return 200 OK (prevent retry storm)
- Log errors internally
- Store failed webhooks untuk manual review
- Alert on repeated failures

---

### 7.4 Polling / Monitoring

**Pattern**: Periodic status checks

**Used By**:
- MikroTik router status (5 min interval)
- RADIUS session monitoring (5 min interval)
- Firebase realtime consumer checks

**Implementation**:
```typescript
class BaseMonitor {
  start() {
    this.intervalId = setInterval(() => {
      this.poll().catch(error => {
        this.errorCount++;
        if (this.errorCount >= MAX_ERRORS) {
          this.stop();
        }
      });
    }, this.getPollInterval());
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
```

**Optimization**:
- Exponential backoff on errors
- Skip polling if no active consumers
- Use Redis pub/sub untuk multi-instance coordination

---

### 7.5 Pub/Sub via Firebase

**Pattern**: Event-driven realtime updates

**Used By**:
- Dashboard realtime data
- Notifications
- Chat messages
- Presence tracking

**Architecture**:
```
Server → Firebase Firestore (publish)
  ↓
Client ← Firestore onSnapshot (subscribe)
```

**Scoping Strategy**:
- User scope: `/channels/user:{userId}`
- Admin scope: `/channels/admin:notifications`
- Site scope: `/channels/admin:notifications.site.{siteId}`
- Department scope: `/channels/department:{deptId}`

**Best Practices**:
- Limit initial fetch (20 docs)
- Deduplicate events (seen IDs)
- Skip hydration phase
- Handle reconnection gracefully
- Clean up subscriptions on unmount

---

### 7.6 Queue-Based Processing

**Pattern**: Async background jobs

**Used By**:
- Notification delivery (BullMQ)
- File processing
- Report generation
- Batch operations

**SDK**: `bullmq` v5.71.1

**Implementation**:
```typescript
// Add job
await notificationQueue.add("send-email", {
  to: email,
  subject: subject,
  body: body
});

// Worker (separate process)
const worker = new Worker("notification-queue", async (job) => {
  await emailService.sendEmail(job.data);
});
```

**Configuration**:
- Redis for queue storage
- Retry: 3 attempts dengan exponential backoff
- Job TTL: 24 hours
- Concurrency: 5 workers

---

## 8. Configuration Management

### 8.1 Environment Variables

**Server-Side** (Runtime):
```env
# Database
DATABASE_URL=postgresql://...
DATABASE_RADIUS_URL=postgresql://...

# Firebase Admin
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx
FIREBASE_PRIVATE_KEY=xxx
FIREBASE_DATABASE_URL=xxx

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=xxx

# Kubernetes
K8S_NAMESPACE=netmanager-production
```

**Client-Side** (Build-time):
```env
# Firebase Web
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_DATABASE_URL=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
```

---

### 8.2 Database Settings (Per-Tenant)

**Table**: `Settings`

**Fields**:
- `key`: Setting identifier (e.g., "SMTP_HOST")
- `value`: Setting value
- `encrypted`: Boolean flag
- `tenantId`: Tenant isolation

**Common Settings**:
```typescript
// Email
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME

// R2 Storage
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, 
R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ENABLED

// Payment Gateways (per provider)
XENDIT_API_KEY, XENDIT_CALLBACK_TOKEN
MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY
TRIPAY_API_KEY, TRIPAY_PRIVATE_KEY, TRIPAY_MERCHANT_CODE
DUITKU_MERCHANT_CODE, DUITKU_API_KEY
MOOTA_API_KEY, MOOTA_WEBHOOK_SECRET

// MixRadius
MIXRADIUS_API_URL, MIXRADIUS_API_KEY, MIXRADIUS_MERCHANT_CODE

// WhatsApp (stored per account)
// Session state di filesystem (.baileys-sessions/)
```

**Encryption**:
- `lib/utils/encryption.ts`
- AES-256-GCM encryption
- Key derived from `ENCRYPTION_KEY` env var
- Format: `{iv}:{encryptedData}:{authTag}`

**Cache Strategy**:
- Settings cache TTL: 1 minute
- Per-module cache (R2Settings, EmailConfig)
- Cache invalidation on update

---

## 9. Reliability Mechanisms

### 9.1 Timeout Configuration

| Integration | Timeout | Configurable |
|-------------|---------|--------------|
| Payment APIs | 30s | Yes (fetchWithTimeout) |
| MikroTik API | 10s | Yes (RouterOS client) |
| SNMP | 5s | Yes (session config) |
| WhatsApp remote cmd | 15s | Yes (Redis brpop) |
| Email SMTP | 60s | No (Nodemailer default) |
| Firebase | 10s | No (SDK default) |
| R2 upload | 300s | Yes (SDK config) |

### 9.2 Retry Strategies

**Payment Gateways**:
- No automatic retry di provider layer
- Retry handled by caller (service/queue)
- Idempotency via orderId

**WhatsApp Remote Commands**:
```typescript
// 3 retries dengan 2s backoff
for (attempt = 1; attempt <= 3; attempt++) {
  result = await dispatchRemoteCmd(sessionId, cmd);
  if (result.success) break;
  if (result.error.includes("lost socket") && attempt < 3) {
    await sleep(2000 * attempt);
    continue;
  }
  break;
}
```

**MikroTik Monitor**:
```typescript
// Exponential backoff on errors
interval = baseInterval * calculateBackoffMultiplier(errorCount);
// Formula: 2^(errorCount - 2), max 8x
// Examples: 0 errors = 1x, 2 errors = 1x, 3 errors = 2x, 5 errors = 8x
```

**Email Delivery**:
- No automatic retry (single attempt)
- Failed deliveries logged dengan error category
- Manual retry via admin UI

### 9.3 Circuit Breaker Patterns

**MikroTik Monitor**:
```typescript
if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
  logger.error("Stopping monitor after too many failures");
  this.stop();
  return; // Circuit open
}
```

**Baileys Session**:
```typescript
// Reconnect dengan exponential backoff
const delay = Math.min(5000 * Math.pow(1.5, attempts - 1), 60000);
setTimeout(() => startBaileysSession(sessionId), delay);
// Max delay: 60 seconds
```

### 9.4 Fallback Behaviors

**R2 Storage**:
```typescript
const client = await getR2Client();
if (!client) {
  // Fallback: Return null, caller handles gracefully
  return null;
}
```

**Firebase Realtime**:
```typescript
if (!isFirebaseReady) {
  // Fallback: Skip publish (no consumers)
  return;
}
```

**Payment Gateway**:
```typescript
if (!ProviderFactory.isSupported(providerType)) {
  throw new Error(`Unknown payment provider: ${providerType}`);
}
```

### 9.5 Health Checks

**Test Connection Endpoints**:
- `testConnection()` method di setiap provider
- Called during configuration setup
- Returns: `{ success: boolean, message: string, details?: object }`

**Examples**:
```typescript
// Xendit: Balance check
Balance.getBalance({ accountType: "CASH" })

// Midtrans: Payment channel list
GET /v1/payment/channels

// Tripay: Payment channel list
GET /merchant/payment-channel

// Duitku: Transaction status (dummy)
POST /merchant/transactionStatus

// Moota: Profile fetch
GET /profile

// Email: Send test email
sendMail({ to: testEmail, subject: "Test" })

// R2: HeadBucket command
HeadBucket({ Bucket: bucketName })
```

---

## 10. Security Considerations

### 10.1 Credential Management

**Storage**:
- Environment variables: Server secrets (Firebase, Redis)
- Database `Settings` table: Tenant-specific secrets
- Filesystem: WhatsApp session credentials (`.baileys-sessions/`)

**Encryption**:
```typescript
// Encrypt API keys before storage
const encrypted = encryptApiKey(plaintext);
// Format: {iv}:{ciphertext}:{authTag}

// Decrypt on load
const plaintext = decryptApiKey(encrypted);
```

**Encryption Key**:
```env
ENCRYPTION_KEY=base64_encoded_32_byte_key
# Generate: openssl rand -base64 32
```

**Best Practices**:
- ✅ Encrypt secrets at rest
- ✅ Use per-tenant encryption (tenantId + global key)
- ✅ Rotate keys periodically
- ✅ Never log plaintext credentials
- ✅ Use environment variables untuk server-side secrets
- ✅ Validate credentials pada setup (test connection)

### 10.2 Request Signing/Verification

**Payment Webhooks**:
| Provider | Method | Input | Header/Field |
|----------|--------|-------|--------------|
| Xendit | Token compare | callback_token | x-callback-token |
| Midtrans | SHA512 | order_id+status_code+amount+key | signature_key |
| Tripay | HMAC-SHA256 | rawBody + privateKey | custom header |
| Duitku | MD5 | merchantCode+orderId+amount+key | signature field |
| Moota | HMAC-SHA256 | rawBody + secret | custom header |

**Signature Verification**:
```typescript
// Timing-safe comparison (prevent timing attacks)
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

**MikroTik API**:
- Username/password authentication
- TLS encryption (port 8729) optional
- API port (8728) typically internal network only

**SNMP**:
- Community string authentication
- SNMPv3 dengan encryption (future)
- Read-only vs read-write communities

### 10.3 Webhook Signature Validation

**Process**:
```typescript
1. Preserve raw request body (before parsing)
2. Extract signature dari header atau payload
3. Load tenant's webhook secret
4. Calculate expected signature
5. Compare menggunakan timingSafeCompare()
6. Reject jika tidak match (return 401)
```

**Implementation**:
```typescript
// app/api/webhooks/[provider]/route.ts
const rawBody = await request.text();
const signature = request.headers.get("x-signature");

const provider = ProviderFactory.createProvider(providerType);
provider.initialize(tenantConfig);

const isValid = provider.verifyWebhook(
  JSON.parse(rawBody),
  signature,
  rawBody
);

if (!isValid) {
  logger.warn(`Webhook signature invalid: ${providerType}`);
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

### 10.4 Rate Limiting

**Outbound (API Calls)**:
- Payment gateways: No explicit limit (rely on provider limits)
- WhatsApp: Implicit (through session management)
- Email: SMTP provider limits (configurable)
- Firebase: Quota monitoring (Firestore writes)

**Inbound (Webhooks)**:
- Rate limiting via middleware (Next.js)
- Per-IP limits: 100 req/min
- Per-tenant limits: 1000 req/min

**Firebase Optimization**:
```typescript
// Before: 2880 writes/day/tenant (30s polling)
// After: 576 writes/day/tenant (5min polling)
// Reduction: 80% quota savings
```

### 10.5 Multi-Tenant Isolation

**Database Level**:
- All queries filtered by `tenantId`
- Row-level security (RLS) via Prisma middleware
- Separate RADIUS database per tenant cluster

**API Level**:
- Tenant context injection via middleware
- Settings loaded per tenant
- Webhook processing per tenant config

**Session Level**:
- WhatsApp sessions namespaced: `wa-{tenantId}-{accountId}`
- Redis keys include tenantId
- Firebase scopes include tenantId

**File Storage**:
- R2 keys prefixed dengan tenant structure
- No cross-tenant file access
- Presigned URLs scoped to tenant bucket paths

---

## 11. Critical Dependencies

### 11.1 Single Points of Failure

**Redis**:
- **Impact**: WhatsApp sessions, queue processing, cache
- **Mitigation**: Redis Sentinel untuk HA, automatic failover
- **Failure Mode**: WhatsApp routing to primary pod only, queue delays

**Firebase Realtime Database**:
- **Impact**: Dashboard realtime updates, notifications
- **Mitigation**: None (managed service)
- **Failure Mode**: Graceful degradation (polling fallback)

**Primary Database (PostgreSQL)**:
- **Impact**: All application data
- **Mitigation**: Primary-replica setup, automated backups
- **Failure Mode**: Application down

**Payment Gateways**:
- **Impact**: Customer payments
- **Mitigation**: Multiple providers configured
- **Failure Mode**: Manual payment processing

### 11.2 Provider Lock-In

**High Lock-In**:
- Firebase (Realtime DB + Firestore): Proprietary APIs
- Baileys (WhatsApp): Unofficial protocol (risk of ban)
- Cloudflare R2: S3-compatible (easy migration)

**Medium Lock-In**:
- Payment gateways: Standard interfaces implemented
- Email SMTP: Standard protocol
- MikroTik: API-based (vendor-specific)

**Low Lock-In**:
- PostgreSQL: Standard SQL
- Redis: Standard protocol
- OpenStreetMap: Open tiles

**Migration Paths**:
- Firebase → Self-hosted realtime (Socket.IO + PostgreSQL pub/sub)
- R2 → AWS S3, MinIO, any S3-compatible
- Baileys → Official WhatsApp Business API (paid)

### 11.3 Vendor Rate Limits

**Payment Gateways**:
- Xendit: 100 req/sec (per account)
- Midtrans: 50 req/sec
- Tripay: Undocumented
- Duitku: Undocumented

**Communication**:
- WhatsApp: No official limit (unofficial API)
- Expo Push: 600 notif/sec (free tier)
- Email: Provider-dependent (Gmail: 500/day untuk free)

**Cloud Services**:
- Firebase Firestore: 10k writes/sec, 100k reads/sec (per database)
- Firebase Realtime DB: 1k concurrent connections/database
- R2: Unlimited bandwidth (zero egress fees)

**Network Devices**:
- MikroTik API: No documented limit
- SNMP: Device-dependent (typically 10-100 req/sec)

---

## 12. Configuration Requirements

### 12.1 Essential Integrations

**Must Configure** (untuk production):
1. ✅ **Payment Gateway** (minimal 1 provider)
2. ✅ **Email SMTP** (untuk notifications)
3. ✅ **Firebase** (untuk realtime features)
4. ✅ **PostgreSQL** (main + radius)
5. ✅ **Redis** (untuk sessions/queue)

**Optional Integrations**:
- WhatsApp (dapat pakai email fallback)
- R2 Storage (dapat pakai local disk)
- MixRadius (jika migrasi dari system lama)
- Push Notifications (nice-to-have)
- Kubernetes API (jika multi-tenant white-label)

### 12.2 Environment Setup Checklist

**Server Environment**:
```bash
# Core
DATABASE_URL=postgresql://...
DATABASE_RADIUS_URL=postgresql://...
REDIS_HOST=localhost
REDIS_PORT=6379
ENCRYPTION_KEY=base64_encoded_key

# Firebase Admin
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxx"
FIREBASE_DATABASE_URL=https://xxx.firebaseio.com

# Session
NEXTAUTH_SECRET=random_32_char_string
NEXTAUTH_URL=https://app.isp.com
```

**Client Environment** (build-time):
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_DATABASE_URL=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
```

**Per-Tenant Configuration** (via admin UI):
1. Payment gateway credentials (pilih provider)
2. SMTP settings
3. R2 storage (optional)
4. WhatsApp accounts (optional)
5. MikroTik routers (untuk provisioning)
6. RADIUS server (jika terpisah)
7. MixRadius integration (jika migrasi)

---

## 13. Risk Assessment

### 13.1 Integration Risks

| Integration | Risk Level | Impact | Mitigation |
|-------------|-----------|--------|------------|
| Payment Gateways | 🔴 High | Revenue loss | Multiple providers, webhook logging |
| WhatsApp (Baileys) | 🟠 Medium | Account ban | Official API migration plan, rate limiting |
| MikroTik Provisioning | 🔴 High | Service disruption | Connection pooling, retry logic, monitoring |
| Firebase Realtime | 🟡 Low | UX degradation | Polling fallback, graceful degradation |
| Email SMTP | 🟡 Low | Missed notifications | Queue retry, multiple SMTP accounts |
| R2 Storage | 🟡 Low | Upload failures | Local disk fallback, S3 migration path |
| RADIUS | 🔴 High | Auth failures | High-availability setup, monitoring |
| MixRadius | 🟢 Very Low | Sync delays | Optional integration, manual override |

### 13.2 Failure Scenarios

**Scenario 1: Payment Gateway Down**
- **Impact**: Customer tidak bisa bayar via gateway tersebut
- **Detection**: Test connection gagal, webhook timeout
- **Response**: Switch ke backup provider, notifikasi admin
- **Recovery**: Automatic (provider up) atau manual (switch permanent)

**Scenario 2: WhatsApp Account Banned**
- **Impact**: Notifikasi WhatsApp gagal
- **Detection**: Connection disconnect dengan specific code
- **Response**: Fallback ke email/SMS, notifikasi admin
- **Recovery**: Setup account baru, re-pair

**Scenario 3: MikroTik Router Unreachable**
- **Impact**: Provisioning gagal, monitoring loss
- **Detection**: Connection timeout, ping failed
- **Response**: Retry dengan exponential backoff, alert admin
- **Recovery**: Fix network connectivity, router reboot

**Scenario 4: Firebase Quota Exceeded**
- **Impact**: Realtime updates stop
- **Detection**: Quota monitoring, error logs
- **Response**: Reduce polling frequency, upgrade plan
- **Recovery**: Quota reset (monthly) atau plan upgrade

**Scenario 5: Redis Down**
- **Impact**: WhatsApp sessions fail, queue processing stops
- **Detection**: Connection refused errors
- **Response**: Failover to replica (if Sentinel), restart service
- **Recovery**: Redis restart, session restoration

### 13.3 Monitoring Requirements

**Critical Metrics**:
1. **Payment Success Rate**: Target > 98%
2. **WhatsApp Delivery Rate**: Target > 95%
3. **Email Delivery Rate**: Target > 99%
4. **MikroTik Provisioning Success**: Target > 99%
5. **API Response Time**: p95 < 500ms, p99 < 2s
6. **Webhook Processing Time**: p95 < 200ms

**Alerting Thresholds**:
- Payment failure > 5 dalam 5 menit
- Email send failure > 10 dalam 10 menit
- MikroTik unreachable > 3 menit
- Firebase quota > 80%
- Redis down > 30 detik
- Database connection pool > 80%

**Log Aggregation**:
- All external API calls logged (with masking)
- Webhook payloads stored (for replay)
- Error traces dengan full context
- Performance metrics per integration

---

## 14. Summary

NetManager mengintegrasikan **23+ external services** dengan total **15 SDK dependencies** utama. Arsitektur menggunakan:

1. **Payment Gateways** (8 providers) - Strategy pattern dengan unified interface
2. **Network Devices** (MikroTik, RADIUS, OLT) - Direct API + database access
3. **Communication** (WhatsApp, Email, Push) - Multi-channel notification system
4. **Cloud Services** (Firebase, R2, K8s) - Realtime updates + storage + auto-SSL
5. **Third-Party** (MixRadius) - Legacy system sync
6. **Location** (Leaflet, Geolib) - Mapping + geofencing

**Critical Paths**:
- Payment processing → Revenue impact
- MikroTik provisioning → Service delivery
- RADIUS auth → Customer connectivity
- Firebase realtime → UX quality

**Key Risks**:
- WhatsApp Baileys (unofficial API, ban risk)
- Firebase quota limits (optimization ongoing)
- Single Redis instance (HA needed)
- Payment gateway vendor lock-in (mitigated via abstraction)

**Strengths**:
- Multiple payment options
- Robust webhook verification
- Per-tenant configuration
- Graceful degradation
- Comprehensive logging

Semua integrations di-monitoring, logged, dan memiliki fallback strategy. Security implemented via encryption, signature verification, dan multi-tenant isolation.

---

**Document End**
