# Configuration & Environment Variables

**Last Updated:** 2026-08-09

---

## Environment Variable Categories

### Critical (Application Won't Start)
| Variable | Purpose | Default | Source |
|----------|---------|---------|--------|
| `DATABASE_URL` | Main PostgreSQL connection | - | Secret |
| `NEXTAUTH_SECRET` | Session encryption key | - | Secret |
| `NEXTAUTH_URL` | Base URL for authentication | - | ConfigMap |
| `AUTH_URL` | Alternative auth URL | Same as NEXTAUTH_URL | ConfigMap |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | Secret |

### Required (Features Will Fail)
| Variable | Purpose | Default | Impact if Missing |
|----------|---------|---------|-------------------|
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK | - | Push notifications fail |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account | - | Push notifications fail |
| `FIREBASE_PRIVATE_KEY` | Firebase private key | - | Push notifications fail |
| `RADIUS_SECRET` | RADIUS NAS secret | - | PPPoE auth fails |
| `NEXT_PUBLIC_APP_URL` | Public app URL | - | Payment callbacks break |

### Recommended (Degraded Experience)
| Variable | Purpose | Default | Impact if Missing |
|----------|---------|---------|-------------------|
| `ENCRYPTION_KEY` | Data encryption | - | Cannot encrypt sensitive data |
| `EMPLOYEE_JWT_SECRET` | Employee portal auth | - | Mobile API login fails |
| `INTERNAL_HEALTH_SECRET` | Health check gate | - | Detailed metrics exposed |
| `CRON_SECRET` | Cron endpoint auth | - | Cron jobs unprotected |

### Optional (Feature Flags)
| Variable | Purpose | Default | Behavior |
|----------|---------|---------|----------|
| `DISABLE_RATE_LIMIT` | Disable rate limiting | `false` | For debugging only |
| `RADIUS_DEBUG` | Enable RADIUS debug logs | `false` | Verbose logging |
| `NODE_ENV` | Environment mode | `development` | Controls caching, logging |
| `TZ` | Server timezone | `Asia/Jakarta` | Date/time calculations |

---

## Database Configuration

### Main Database
```bash
DATABASE_URL="postgresql://netmgr:PASSWORD@localhost:5432/netmanager"
```

**Format:** `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

**Connection Pooling:**
- Development: Direct connection
- Production: Prisma connection pool (default limits)

### RADIUS Database
```bash
DATABASE_URL_RADIUS="postgresql://netmgr:PASSWORD@localhost:5433/radius"
```

**Purpose:** PPPoE authentication and accounting  
**Tables:** `radcheck`, `radreply`, `radgroupcheck`, `radgroupreply`, `radacct`

### Billing Database
```bash
DATABASE_URL_BILLING="postgresql://netmgr:PASSWORD@localhost:5434/billing"
```

**Purpose:** Financial transaction isolation for audit compliance

### Mitra Database
```bash
DATABASE_URL_MITRA="postgresql://netmgr:PASSWORD@localhost:5435/mitra"
```

**Purpose:** Reseller/partner data isolation

---

## Redis Configuration

```bash
REDIS_URL="redis://:<PASSWORD>@localhost:6379"
```

**Use Cases:**
- Session storage (NextAuth)
- Rate limiting buckets
- Cron job locking
- BullMQ job queues
- Cache layer
- Idempotency keys
- Failed login tracking

**Connection Settings:**
- `maxRetriesPerRequest: 2` — Fail fast for rate limiting
- `enableOfflineQueue: false` — No queuing when Redis down
- `retryStrategy: exponential backoff` — Infinite reconnect
- `keepAlive: 30000` — 30s keep-alive

**Fallback Behavior:**
- Rate limiting: FAIL-CLOSED (reject if Redis down)
- Caching: FAIL-OPEN (proceed without cache)
- Session: FAIL-CLOSED (require session)

---

## Authentication Configuration

### NextAuth.js
```bash
NEXTAUTH_SECRET="generated-secret-min-32-chars"
NEXTAUTH_URL="https://radpro.id"
AUTH_URL="https://radpro.id"
```

**Generation:**
```bash
openssl rand -base64 32
```

### Session Configuration
```bash
SESSION_MAX_AGE=604800        # 7 days in seconds
SESSION_UPDATE_AGE=1800       # 30 minutes (rolling update)
```

### Cookie Configuration
```bash
COOKIE_DOMAIN="radpro.id"     # Domain for cookie scope
```

**Cookie Settings:**
- `httpOnly: true` — Prevent JavaScript access
- `secure: true` — HTTPS only (production)
- `sameSite: 'lax'` — CSRF protection
- `path: '/'` — All routes

### Employee Portal JWT
```bash
EMPLOYEE_JWT_SECRET="generated-secret-min-32-chars"
EMPLOYEE_JWT_EXPIRES_IN="7d"
```

**Purpose:** Mobile app authentication (stateless tokens)

---

## Domain & URL Configuration

### Base URLs
```bash
DOMAIN="radpro.id"
NEXT_PUBLIC_APP_URL="https://radpro.id"
EMPLOYEE_PORTAL_URL="https://karyawan.radpro.id"
```

### CORS Configuration
```bash
CORS_ORIGIN="https://radpro.id"
ALLOWED_ORIGINS="https://radpro.id,https://admin.radpro.id,https://karyawan.radpro.id,https://pelanggan.radpro.id,https://investor.radpro.id"
```

**Format:** Comma-separated list of allowed origins

### SSL/TLS
```bash
ACME_EMAIL="admin@radpro.id"  # Let's Encrypt notifications
```

---

## Firebase Configuration

### Client SDK (Build-time)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="netmanager-96742.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="netmanager-96742"
NEXT_PUBLIC_FIREBASE_DATABASE_URL="https://netmanager-96742-default-rtdb.asia-southeast1.firebasedatabase.app"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="netmanager-96742.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="43187781340"
NEXT_PUBLIC_FIREBASE_APP_ID="1:43187781340:web:..."
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BNk..."
```

**Note:** `NEXT_PUBLIC_*` variables are bundled at build time

### Admin SDK (Runtime)
```bash
FIREBASE_PROJECT_ID="netmanager-96742"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@netmanager-96742.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL="https://netmanager-96742-default-rtdb.asia-southeast1.firebasedatabase.app"
```

**Private Key Format:**
- Must include `\n` for newlines
- Wrapped in quotes if contains spaces
- Can be single-line or multi-line

---

## RADIUS Configuration

```bash
RADIUS_SECRET="shared-secret-for-nas-communication"
RADIUS_PUBLIC_IP="103.xxx.xxx.xxx"  # Optional, auto-detected if empty
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
```

**Port Mapping:**
- Docker Compose: `1812:1812/udp`, `1813:1813/udp`
- Kubernetes Production: NodePort `30812/udp`, `30813/udp`
- Kubernetes Staging (retired): NodePort `31812/udp`, `31813/udp`

**Secret Usage:**
- MikroTik NAS must use same secret
- OLT devices must use same secret
- Used for packet authentication

---

## Payment Gateway Configuration

### Xendit
```bash
XENDIT_API_KEY="xnd_development_..."
XENDIT_WEBHOOK_TOKEN="webhook_verification_token"
NEXT_PUBLIC_XENDIT_PUBLIC_KEY="xnd_public_..."
```

### Midtrans
```bash
MIDTRANS_SERVER_KEY="SB-Mid-server-..."
MIDTRANS_CLIENT_KEY="SB-Mid-client-..."
MIDTRANS_IS_PRODUCTION="false"
```

### Tripay
```bash
TRIPAY_API_KEY="DEV-..."
TRIPAY_PRIVATE_KEY="private-key-..."
TRIPAY_MERCHANT_CODE="T1234"
TRIPAY_IS_PRODUCTION="false"
```

### Duitku
```bash
DUITKU_MERCHANT_CODE="D1234"
DUITKU_API_KEY="api-key-..."
DUITKU_IS_PRODUCTION="false"
```

### Moota (Banking)
```bash
MOOTA_API_KEY="api-key-..."
MOOTA_BANK_ID="bank-id-..."
```

---

## Email Configuration

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE="false"          # true for 465, false for 587
SMTP_USER="notifications@radpro.id"
SMTP_PASSWORD="app-specific-password"
SMTP_FROM_NAME="RadPro ISP"
SMTP_FROM_EMAIL="notifications@radpro.id"
```

**Gmail App Password:**
1. Enable 2FA on Google Account
2. Generate App Password
3. Use app password (not account password)

---

## WhatsApp Configuration

```bash
WHATSAPP_NUMBER="628123456789"  # Without + prefix
WHATSAPP_SESSION_PATH="./whatsapp-session"
```

**Implementation:** Baileys library (multi-device protocol)

---

## Storage Configuration (AWS S3)

```bash
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="secret-key..."
AWS_REGION="ap-southeast-1"
AWS_S3_BUCKET="netmanager-uploads"
S3_ENDPOINT="https://s3.ap-southeast-1.amazonaws.com"  # Optional
```

**Use Cases:**
- Customer document uploads
- Work order photos
- Invoice PDFs
- Export files
- Mobile app APK/bundles

---

## Internal Services

### WebSocket Server
```bash
WS_SERVER_URL="http://localhost:3000"
INTERNAL_WS_SECRET="internal-websocket-secret"
```

### Health Check
```bash
INTERNAL_HEALTH_SECRET="secret-for-detailed-metrics"
```

**Endpoints:**
- `/api/health` — Public (basic status)
- `/api/health?secret=xxx` — Internal (detailed metrics)

### Cron Jobs
```bash
CRON_SECRET="secret-for-cron-endpoints"
```

**Protected Endpoints:**
- `/api/cron/*` — Require header `x-cron-secret`

---

## Kubernetes-Specific

```bash
K8S_NAMESPACE="netmanager-production"
```

**Purpose:** Used by Kubernetes client for resource management

---

## Development-Only

```bash
NODE_ENV="development"
PORT=3000
HOSTNAME="127.0.0.1"
NEXT_DISABLE_TURBOPACK="0"     # Set to 1 to disable Turbopack
```

---

## Multi-Environment Strategy

### Jenkins Multi-Environment Variables
For staging vs production, Jenkins provides scoped variables:

```bash
# Staging
NEXT_PUBLIC_FIREBASE_API_KEY_STAGING="..."
FIREBASE_PROJECT_ID_STAGING="..."

# Production
NEXT_PUBLIC_FIREBASE_API_KEY_PRODUCTION="..."
FIREBASE_PROJECT_ID_PRODUCTION="..."
```

**Resolution:** Jenkinsfile selects based on branch/environment

---

## Security Best Practices

### Secret Generation
```bash
# 32-byte base64 (for secrets)
openssl rand -base64 32

# 32-byte hex (for encryption keys)
openssl rand -hex 32

# 16-byte base64 (for RADIUS)
openssl rand -base64 16 | tr -d '/+='

# 24-byte base64 (for passwords)
openssl rand -base64 24 | tr -d '/+='
```

### Secret Storage

**Development:**
- `.env` file (gitignored)
- Copy from `.env.production.example`

**Production:**
- Kubernetes Secrets (encrypted at rest)
- Never commit to git
- Rotate regularly

**DO NOT:**
- ❌ Hardcode secrets in code
- ❌ Commit `.env` to repository
- ❌ Share secrets via chat/email
- ❌ Log secret values
- ❌ Expose secrets in error messages

---

## Configuration Files

### Local Development
- `.env` — Local environment (gitignored)
- `.env.production.example` — Template with documentation

### Production (Kubernetes)
- `k8s/production/configmap.yaml` — Non-sensitive config
- `k8s/production/secrets.yaml` — Sensitive values (gitignored)

### Docker Compose
- `docker-compose.yml` — Development services
- `docker-compose.production.yml` — Production services

---

## Environment Validation

### Startup Check
```typescript
// server.ts
validateCriticalEnvVars()  // Throws if missing critical vars
```

**Validated Variables:**
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `REDIS_URL` (warns if missing, doesn't throw)

### Runtime Validation
```typescript
// lib/utils/env.ts
export function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue
}
```

---

## Troubleshooting

### Common Issues

**Database Connection Failed:**
```bash
# Check URL format
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

**Redis Connection Failed:**
```bash
# Check Redis running
redis-cli ping

# Check auth
redis-cli -a <password> ping
```

**Firebase Push Notifications Not Working:**
```bash
# Verify all FIREBASE_* vars set
# Check private key format (newlines as \n)
# Verify service account has FCM permissions
```

**Payment Webhook Failed:**
```bash
# Verify NEXT_PUBLIC_APP_URL is set correctly
# Check webhook URL: <NEXT_PUBLIC_APP_URL>/api/webhooks/<provider>
# Verify signature validation
```

**RADIUS Authentication Failed:**
```bash
# Check RADIUS_SECRET matches NAS configuration
# Verify ports are accessible (UDP 1812/1813)
# Check RADIUS database tables populated
```

---

## Feature Flags

### Rate Limiting
```bash
DISABLE_RATE_LIMIT="true"  # Disable for debugging only
```

**Default:** Enabled in production

### Internal Cron
```bash
ENABLE_INTERNAL_CRON="false"  # Disable if using external cron
```

**Default:** Enabled

### Debug Modes
```bash
RADIUS_DEBUG="true"        # Verbose RADIUS logs
DEBUG="*"                  # Enable all debug namespaces
```

---

## Configuration Checklist

**Pre-Launch:**
- [ ] All `GANTI_DENGAN_*` placeholders replaced
- [ ] Secrets generated with proper entropy
- [ ] Database URLs point to correct hosts
- [ ] Redis accessible from app
- [ ] Firebase credentials valid
- [ ] Payment gateway credentials (production keys)
- [ ] SMTP configured and tested
- [ ] RADIUS secret matches NAS config
- [ ] S3 bucket accessible
- [ ] Domain DNS configured
- [ ] SSL certificates provisioned

**Post-Deploy:**
- [ ] Health check endpoint responding
- [ ] Database migrations applied
- [ ] Seed data loaded
- [ ] Admin user created
- [ ] Test login works
- [ ] Payment webhook test
- [ ] Email sending works
- [ ] Push notifications work
- [ ] RADIUS auth test
- [ ] MikroTik provisioning test

---

**Configuration Documentation:** COMPLETED  
**Total Variables:** ~80 environment variables  
**Critical Variables:** 5 (application won't start)  
**Security-Sensitive:** ~40 (credentials, tokens, keys)
