# Multi-Tenant Landing Page + Custom Domain Management

**Date:** 2026-05-22
**Status:** Draft
**Author:** agent

---

## Problem Statement

Landing page saat ini hardcoded untuk RADPRO.ID. Setiap tenant yang menggunakan platform tidak punya landing page sendiri. Dibutuhkan:

1. Landing page baru untuk RADPRO.ID yang fokus ke fitur SaaS (jualan produk)
2. Landing page per tenant dengan branding dinamis (logo, nama, kontak dari data tenant)
3. Custom domain management — tenant bisa pakai domain sendiri via CNAME (opsional)
4. Subdomain otomatis untuk setiap tenant (`{slug}.radpro.id`)

---

## Architecture Overview

### Routing Decision

```
Host header masuk
  → Subdomain role (admin.*, karyawan.*, pelanggan.*, investor.*) → skip, bukan landing page
  → Match {slug}.radpro.id → lookup TenantDomain by slug → TenantLandingPage
  → Custom domain → lookup TenantDomain by domain (status=active) → TenantLandingPage
  → radpro.id (bare domain) → MAIN_TENANT_ID → SaasLandingPage
  → Tidak ketemu → 404
```

### Landing Page Split

| Kondisi | Page |
|---------|------|
| `tenantId === MAIN_TENANT_ID` | SaasLandingPage (baru) |
| `tenantId !== null` | TenantLandingPage (refactor existing) |
| `tenantId === null` | 404 |

### Subdomain Strategy

- Tenant subdomain (`{slug}.radpro.id`) hanya untuk **public-facing**: landing page + customer portal
- Admin panel tetap di `admin.radpro.id` — tenant resolved dari session login user
- Karyawan tetap di `karyawan.radpro.id`
- Custom domain (CNAME) bersifat **opsional** — tenant otomatis dapat subdomain saat dibuat

---

## File Structure

```
app/
  page.tsx                              # Router: pilih SaaS vs Tenant page

components/
  landing/
    SaasLandingPage.tsx                 # Landing page baru RADPRO.ID
    TenantLandingPage.tsx               # Refactor dari LandingPage.tsx existing

modules/tenant/
  domain/
    TenantDomain.ts                     # Entity
  dto/
    tenant-domain.dto.ts                # Request/response DTOs
  repositories/
    TenantDomainRepository.ts
  services/
    TenantDomainService.ts              # CRUD + verification logic
    DnsVerificationService.ts           # DNS check logic
    K8sCertificateService.ts            # Create/delete Certificate CR via K8s API
  validators/
    tenant-domain.validator.ts
  index.ts
```

---

## Database Schema

### New Model: TenantDomain

```prisma
model TenantDomain {
  id          String    @id @default(uuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  domain      String?   @unique         // custom domain (opsional)
  slug        String    @unique         // subdomain otomatis: {slug}.radpro.id
  status      String    @default("pending") // pending | verified | active | failed
  sslStatus   String    @default("pending") // pending | provisioning | active | failed
  verifiedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**Notes:**
- `slug` wajib diisi saat tenant dibuat (auto-generate dari nama tenant, editable, unique)
- `domain` opsional — tenant bisa punya 0 atau 1 custom domain
- Field `domain` di model `Tenant` existing akan di-deprecate, diganti relasi ke `TenantDomain`

---

## Custom Domain Verification Flow

```
1. Admin tenant input custom domain di panel
2. Sistem generate instruksi: "Arahkan CNAME {domain} ke radpro.id"
3. Cron job (setiap 5 menit) cek DNS resolution:
   - Query TenantDomain dengan status "pending"
   - Resolve CNAME → kalau target = radpro.id → mark "verified"
4. Setelah verified → trigger SSL provisioning:
   - App create Certificate CR via K8s API
   - cert-manager provision SSL (HTTP-01 challenge)
   - Update sslStatus = "provisioning"
5. Cek certificate ready → sslStatus = "active", status = "active"
6. Domain siap dipakai

Monitoring ongoing:
- Cron juga cek domain "active" yang DNS-nya berubah
- Kalau tidak resolve lagi → mark "failed"
```

---

## Infrastructure

### Traefik Catch-All IngressRoute

Satu IngressRoute dengan priority rendah untuk menangkap semua domain yang tidak di-hardcode:

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: netmanager-tenant-catchall
  namespace: netmanager-production
spec:
  entryPoints:
    - websecure
  routes:
    - match: HostRegexp(`{host:.+}`)
      kind: Rule
      priority: 1
      services:
        - name: netmanager-app
          port: 80
  tls:
    secretName: tenant-tls-dynamic
```

### SSL Auto-Provisioning

- cert-manager sudah terinstall dengan ClusterIssuer `letsencrypt-production`
- Saat domain verified, aplikasi create `Certificate` CR via K8s API:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: tenant-{slug}-tls
  namespace: netmanager-production
spec:
  secretName: tenant-{slug}-tls
  issuerRef:
    name: letsencrypt-production
    kind: ClusterIssuer
  dnsNames:
    - {custom-domain}
```

- Aplikasi call K8s API langsung (via `@kubernetes/client-node`) untuk create/delete Certificate resources

---

## API Endpoints

### Super Admin (RADPRO)

```
GET    /api/admin/tenant-domains           # List semua tenant domains + status
POST   /api/admin/tenant-domains/:id/verify   # Manual re-verify
POST   /api/admin/tenant-domains/:id/disable  # Disable domain
```

### Tenant Admin

```
GET    /api/admin/tenants/:id/domains         # List domains milik tenant + status
POST   /api/admin/tenants/:id/domains         # Add custom domain
DELETE /api/admin/tenants/:id/domains/:domainId  # Remove custom domain
POST   /api/admin/tenants/:id/domains/:domainId/verify  # Manual re-verify trigger
```

---

## SaaS Landing Page Sections

Landing page baru untuk RADPRO.ID (`SaasLandingPage.tsx`):

1. **Hero** — Tagline + CTA (daftar/request demo)
2. **Fitur Utama** — Billing, network management, monitoring, customer portal, dll
3. **Pricing/Paket** — Tabel harga
4. **Testimoni/Client** — Logo ISP yang sudah pakai
5. **CTA Bottom** — Daftar/hubungi sales

---

## Tenant Landing Page

Refactor dari `LandingPage.tsx` existing (`TenantLandingPage.tsx`):

- Branding dinamis: nama, logo, kontak diambil dari data tenant (via `getPublicPortalSettings()`)
- Konten template tetap sama untuk semua tenant (fitur ISP, FAQ, dll)
- Tombol login/register mengarah ke customer portal tenant tersebut

---

## Tenant Resolution Update

Update `lib/tenant-context.ts` untuk support slug-based resolution:

```
Priority order:
1. Bearer token (mobile app) → resolve dari JWT
2. Session cookie (web) → resolve dari session
3. Host header:
   a. Skip subdomain role (admin, karyawan, pelanggan, investor)
   b. Match {slug}.radpro.id → lookup TenantDomain by slug
   c. Lookup TenantDomain by domain (custom domain, status=active)
   d. Bare radpro.id → MAIN_TENANT_ID
   e. localhost → MAIN_TENANT_ID (dev)
4. Tidak ketemu → null
```

---

## Cron Job: DNS Verification

**Schedule:** Setiap 5 menit
**Path:** `app/api/cron/tenant-domain-verify/route.ts`

**Logic:**
1. Query `TenantDomain` where `status = "pending"` AND `domain IS NOT NULL`
2. Untuk setiap domain, resolve DNS CNAME
3. Kalau CNAME target = `radpro.id` → update status `verified`, trigger SSL provisioning
4. Query `TenantDomain` where `status = "active"` AND `domain IS NOT NULL`
5. Re-check DNS → kalau tidak resolve → mark `failed`

---

## Out of Scope

- Tenant admin edit konten landing page (fitur, FAQ, dll) — future enhancement
- Multiple custom domains per tenant
- Wildcard SSL untuk tenant subdomain (pakai individual cert per custom domain)
- Nested subdomain (`admin.tenant.radpro.id`)

---

## Risks & Assumptions

- **Asumsi:** K8s service account punya permission untuk create/delete Certificate CR
- **Asumsi:** cert-manager HTTP-01 challenge bisa jalan untuk custom domain (port 80 harus accessible dari internet ke server radpro.id)
- **Risk:** Rate limit Let's Encrypt (50 certificates per registered domain per week) — mitigasi: batch provisioning, monitoring quota
- **Risk:** DNS propagation delay — mitigasi: retry mechanism di cron job, jangan langsung mark failed setelah 1x check
