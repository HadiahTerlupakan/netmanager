# Technology Stack — Complete Inventory

**Last Updated:** 2026-08-09

---

## Runtime Environment

| Component | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | ≥24.0.0 | JavaScript runtime (required minimum) |
| **TypeScript** | 5.9.3 | Type-safe JavaScript with strict mode |
| **pnpm/npm** | npm (default) | Package manager |

---

## Core Framework

### Next.js Ecosystem
- **Next.js:** 16.2.4
  - App Router (React Server Components)
  - API Routes for backend
  - Server Actions support
  - Standalone output for production
  - Turbopack in development (opt-in)
- **React:** 19.2.4
- **React DOM:** 19.2.4

### Build Tools
- **tsx:** 4.21.0 — TypeScript execution (dev server, workers)
- **Turbopack:** Built into Next.js (development mode)
- **ESLint:** 9.39.4 with Next.js config
- **Prettier:** 3.8.1

---

## Database & ORM

### PostgreSQL (Multiple Databases)
- **PostgreSQL Version:** 16
- **Prisma:** 7.7.0
  - Main database: `netmanager`
  - RADIUS database: `radius`
  - Billing database: `billing`
  - Mitra database: `mitra`
- **@prisma/adapter-pg:** 7.7.0 (Connection pooling support)
- **pg:** 8.20.0 (PostgreSQL client)

### Database Clients Generated
- `@prisma/client` — Main application database
- `@prisma/client-radius` — RADIUS database (custom generation path)
- `@prisma/client-billing` — Billing database (custom generation path)
- `@prisma/client-mitra` — Mitra database (custom generation path)

---

## Caching & Queuing

### Redis
- **ioredis:** 5.10.1
- **lru-cache:** 11.5.2 (In-memory cache layer)

**Use Cases:**
- Session storage (NextAuth)
- Rate limiting buckets
- Cron job locking
- Idempotency keys
- BullMQ job queues
- Temporary data (OTP, failed login counters)

### BullMQ
- **bullmq:** 5.71.1

**Use Cases:**
- Async event processing
- Billing job scheduling
- Notification delivery (email, push, WhatsApp)
- Network provisioning jobs
- Report generation

---

## Authentication & Authorization

- **next-auth:** 4.24.13 (NextAuth.js v4)
- **@auth/prisma-adapter:** 2.11.1
- **bcryptjs:** 3.0.3 (Password hashing)
- **jsonwebtoken:** 9.0.3 (JWT for mobile API)
- **jose:** 6.2.2 (JWT operations)

---

## Network Device Integration

### MikroTik
- **node-routeros-v2:** 1.6.12
  - PPPoE secret provisioning
  - IP pool management
  - Bandwidth profile application
  - Real-time monitoring

### OLT Management
- **net-snmp:** 3.26.1 (SNMP protocol)
- **node-ssh:** 13.2.1 (SSH for CLI commands)
- **telnet-client:** 2.2.12 (Telnet for legacy devices)
- **node-telnet:** 1.0.1 (Alternative telnet client)

### Network Utilities
- **axios:** 1.15.2 (HTTP client for REST APIs)
- **follow-redirects:** 1.16.0 (HTTP redirect handling)

---

## Payment Gateway Integration

- **xendit-node:** 7.0.0 (Xendit API)
- **midtrans-client:** 1.4.3 (Midtrans API)
- **Tripay:** Custom REST API integration (axios)
- **Duitku:** Custom REST API integration
- **Moota:** Banking webhook integration

---

## Real-time & Communication

### Firebase
- **firebase:** 12.11.0 (Client SDK)
  - Realtime Database (chat, notifications)
  - Cloud Messaging (push notifications)
- **firebase-admin:** 13.0.0 (Server SDK)

### Push Notifications
- **expo-server-sdk:** 6.1.0 (Expo push notifications)
- **web-push:** 3.6.7 (Web push notifications)

### Messaging
- **@whiskeysockets/baileys:** 7.0.0-rc13 (WhatsApp automation)
- **nodemailer:** 8.0.5 (Email sending)

### Real-time Features
- Custom Socket.IO implementation (via custom server)
- Firebase Realtime Database for chat
- Server-Sent Events (SSE) for admin notifications

---

## Frontend Libraries

### UI Framework
- **Tailwind CSS:** 4.2.2
  - **@tailwindcss/postcss:** 4.2.2
  - **tailwind-merge:** 3.5.0 (Class merging utility)
  - **clsx:** 2.1.1 (Conditional classnames)
  - **class-variance-authority:** 0.7.1 (Component variants)

### Component Libraries
- **next-themes:** 0.4.6 (Dark mode support)
- **lucide-react:** 1.0.1 (Icon library)
- **react-icons:** 5.6.0 (Additional icons)

### Forms & Validation
- **react-hook-form:** 7.72.0
- **@hookform/resolvers:** 5.2.2
- **zod:** 4.3.6 (Schema validation)

### Data Visualization
- **chart.js:** 4.5.1
- **react-chartjs-2:** 5.3.1 (React wrapper)

### Maps
- **ol:** 10.8.0 (OpenLayers for maps)
- **leaflet:** 1.9.4 (Leaflet maps)
- **react-leaflet:** 5.0.0 (React wrapper)
- **geolib:** 3.3.4 (Geolocation calculations)

### Calendar & Scheduling
- **react-big-calendar:** 1.19.4
- **react-date-range:** 2.0.1
- **date-fns:** 4.1.0
- **date-fns-tz:** 3.2.0 (Timezone support)

### File Handling
- **react-dropzone:** 15.0.0 (File upload UI)
- **sharp:** 0.34.5 (Image processing)
- **formidable:** 3.5.4 (File upload parsing)

### PDF & Documents
- **jspdf:** 4.2.0
- **jspdf-autotable:** 5.0.7 (Table generation)
- **html2canvas:** 1.4.1 (HTML to canvas)

### Data Fetching (Client-side)
- **@tanstack/react-query:** 5.100.10
- **@tanstack/react-query-devtools:** 5.100.10

### UI Utilities
- **react-hot-toast:** 2.6.0 (Toast notifications)
- **qrcode:** 1.5.4 (QR code generation)
- **react-qr-code:** 2.0.18 (React QR component)
- **dompurify:** 3.4.1 (XSS sanitization)
- **isomorphic-dompurify:** 3.7.1 (Isomorphic sanitization)

---

## File Storage

- **@aws-sdk/client-s3:** 3.1015.0
- **@aws-sdk/lib-storage:** 3.1015.0
- **@aws-sdk/s3-request-presigner:** 3.1015.0

---

## Infrastructure & DevOps

### Container
- **Docker:** 29.4.0 (CLI)
- **docker-compose:** Defined in project root
- **Kubernetes:** Client via kubectl in Jenkins

### Kubernetes Client
- **@kubernetes/client-node:** 1.4.0 (K8s API interactions)

### CI/CD
- **Jenkins** — Production pipeline (Jenkinsfile)
- **GitHub Actions** — Likely for PR checks (needs verification)

### Monitoring & Logging
- **pino:** 10.3.1 (Structured logging)
- **helmet:** 8.1.0 (Security headers)

---

## Testing

### Unit & Integration Tests
- **vitest:** 4.1.1
- **@vitest/coverage-v8:** 4.1.1
- **vitest-mock-extended:** 4.0.0

### E2E Tests
- **@playwright/test:** 1.58.1

### Test Database
- Separate PostgreSQL database: `netmanager_test`
- Configured via `TEST_DATABASE_URL`

---

## Developer Tools

### TypeScript
- **typescript:** 5.9.3 (strict mode)
- **ts-node:** 10.9.2 (TypeScript execution)
- **@types/node:** 25.5.0
- **@types/react:** 19.2.14
- **@types/react-dom:** 19.2.3

### Linting & Formatting
- **eslint:** 9.39.4
- **@typescript-eslint/eslint-plugin:** 8.57.2
- **@typescript-eslint/parser:** 8.57.2
- **prettier:** 3.8.1
- **lint-staged:** 17.0.5
- **husky:** 9.1.7 (Git hooks)

### Build Optimization
- **copy-webpack-plugin:** 14.0.0
- **terser-webpack-plugin:** 5.4.0
- **baseline-browser-mapping:** 2.10.10
- **browserslist:** 4.28.1

---

## Utilities

### Cryptography
- Custom crypto utilities (lib/crypto.ts)
- **bcryptjs:** Password hashing
- **jsonwebtoken:** Token signing

### Data Processing
- CSV parsing & generation (lib/csv.ts)
- **effect:** 3.21.0 (Functional programming utilities)

### HTTP & Networking
- **axios-cookiejar-support:** 7.0.0
- **tough-cookie:** 6.0.1 (Cookie jar)

### Cron & Scheduling
- **node-cron:** 4.2.1

### Archive & Compression
- **adm-zip:** 0.5.16
- **adbkit-apkreader:** 3.2.0 (APK parsing for mobile app updates)

### Source Maps
- **source-map-support:** 0.5.21

---

## Progressive Web App (PWA)

- **@ducanh2912/next-pwa:** 10.2.9
  - Service worker generation
  - Offline support
  - App manifest

---

## API Documentation

- **swagger-jsdoc:** 6.2.8
- **swagger-ui-react:** 5.32.1

---

## Mobile Backend

### Expo Updates
- Custom implementation for OTA updates
- **adbkit-apkreader:** 3.2.0 (APK inspection)
- **adm-zip:** 0.5.16 (APK/bundle manipulation)

---

## Environment

### Required Environment Variables

**Critical (Application Won't Start):**
- `DATABASE_URL` — Main PostgreSQL connection
- `NEXTAUTH_SECRET` — Session encryption
- `NEXTAUTH_URL` — Base URL for auth
- `REDIS_URL` — Redis connection

**Important (Features Degraded):**
- `FIREBASE_*` — Push notifications
- `RADIUS_SECRET` — PPPoE authentication
- Payment gateway credentials
- AWS S3 credentials
- SMTP credentials

**Optional (Development):**
- `NEXT_PUBLIC_*` — Build-time public variables
- `NODE_ENV` — Development/production mode
- `TZ` — Timezone (default: Asia/Jakarta)

### Configuration Files
- `.env` — Local development (gitignored)
- `.env.production.example` — Production template
- `k8s/production/configmap.yaml` — K8s ConfigMap
- `k8s/production/secrets.yaml` — K8s Secrets (gitignored)

---

## Package Manager Override Strategy

```json
"overrides": {
  "typescript": "5.9.3",
  "hono": "^4.12.14",
  "nodemailer": "^8.0.5",
  "lodash": "^4.18.1",
  "dompurify": "^3.4.1",
  "effect": "^3.21.0",
  "follow-redirects": "^1.16.0"
}
```

**Purpose:** Security patches & compatibility fixes for transitive dependencies

---

## Known Incompatibilities

1. **React 19 Migration:**
   - Some libraries need overrides for React 19 compatibility
   - `react-copy-to-clipboard`, `react-debounce-input`, `react-inspector` pinned

2. **Vitest 4:**
   - Test timeout syntax changed from v3 → v4
   - Format: `it(name, { timeout }, fn)` instead of `it(name, fn, { timeout })`

3. **Next.js Custom Server:**
   - Cannot use Next.js middleware for custom body parsing
   - Custom server intercepts `/api/admin/app-update/publish` for large file handling

---

## Deprecated / Removed

- **None explicitly marked** — All dependencies in active use

---

## Upgrade Path Considerations

**High Priority:**
- Keep Next.js, React, Prisma up to date (frequent security patches)
- Monitor Node.js LTS releases (currently on 24.x)

**Medium Priority:**
- Testing libraries (Vitest, Playwright)
- UI libraries (Tailwind, chart.js)

**Low Priority:**
- Utilities with stable APIs
- Infrastructure tools

---

**Tech Stack Reconnaissance:** COMPLETED  
**Total Dependencies:** 141 production + 39 dev dependencies
