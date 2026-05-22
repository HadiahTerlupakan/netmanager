# Multi-Tenant Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi landing page per tenant dengan custom domain management, termasuk SaaS landing page baru untuk RADPRO.ID dan tenant landing page dengan branding dinamis.

**Architecture:** Split routing berdasarkan tenant resolution — main tenant menampilkan SaaS page, tenant lain menampilkan tenant page. Custom domain management via TenantDomain model dengan DNS verification cron job dan SSL auto-provisioning via K8s cert-manager.

**Tech Stack:** Next.js 14 (App Router), Prisma, Tailwind CSS, @kubernetes/client-node, dns (Node.js built-in)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `modules/tenant/domain/TenantDomain.ts` | Entity type |
| Create | `modules/tenant/dto/tenant-domain.dto.ts` | Request/response DTOs |
| Create | `modules/tenant/repositories/TenantDomainRepository.ts` | Data access |
| Create | `modules/tenant/services/TenantDomainService.ts` | CRUD + business logic |
| Create | `modules/tenant/services/DnsVerificationService.ts` | DNS check logic |
| Create | `modules/tenant/services/K8sCertificateService.ts` | K8s Certificate CR management |
| Create | `modules/tenant/validators/tenant-domain.validator.ts` | Zod schemas |
| Create | `modules/tenant/index.ts` | Public API |
| Create | `components/landing/SaasLandingPage.tsx` | SaaS marketing page |
| Create | `components/landing/TenantLandingPage.tsx` | Tenant landing page (refactor) |
| Modify | `app/page.tsx` | Router: SaaS vs Tenant page |
| Modify | `lib/tenant-context.ts` | Add slug/domain resolution |
| Modify | `proxy.ts` | Handle tenant subdomain routing |
| Modify | `prisma/schema.prisma` | Add TenantDomain model |
| Create | `app/api/cron/tenant-domain-verify/route.ts` | DNS verification cron |
| Create | `app/api/admin/tenant-domains/route.ts` | Super admin domain list |
| Create | `app/api/admin/tenant-domains/[id]/verify/route.ts` | Manual verify |
| Create | `app/api/admin/tenant-domains/[id]/disable/route.ts` | Disable domain |
| Create | `app/api/admin/tenants/[id]/domains/route.ts` | Tenant domain CRUD |
| Create | `app/api/admin/tenants/[id]/domains/[domainId]/route.ts` | Delete domain |
| Create | `app/api/admin/tenants/[id]/domains/[domainId]/verify/route.ts` | Tenant verify trigger |
| Create | `k8s/production/ingress-tenant-catchall.yaml` | Traefik catch-all route |
| Create | `k8s/staging/ingress-tenant-catchall.yaml` | Staging catch-all route |

---

## Task 1: Database Schema — TenantDomain Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add TenantDomain model to Prisma schema**

```prisma
model TenantDomain {
  id         String    @id @default(uuid())
  tenantId   String
  tenant     Tenant    @relation(fields: [tenantId], references: [id])
  domain     String?   @unique
  slug       String    @unique
  status     String    @default("pending")
  sslStatus  String    @default("pending")
  verifiedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([tenantId])
  @@index([status])
}
```

Add relation to Tenant model:
```prisma
model Tenant {
  // ... existing fields
  tenantDomain TenantDomain?
}
```

- [ ] **Step 2: Generate and run migration**

```bash
npx prisma migrate dev --name add_tenant_domain_table
```

Expected: Migration created successfully, TenantDomain table exists.

- [ ] **Step 3: Generate Prisma client**

```bash
npm run prisma:generate
```

- [ ] **Step 4: Seed TenantDomain for existing tenants**

Create a seed script that generates slug from existing tenant names and populates TenantDomain for all active tenants. Tenants with existing `domain` field get that value migrated to `TenantDomain.domain`.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(tenant): add TenantDomain model for multi-tenant landing page"
```

---

## Task 2: Tenant Module — Domain Entity, Repository, DTOs

**Files:**
- Create: `modules/tenant/domain/TenantDomain.ts`
- Create: `modules/tenant/dto/tenant-domain.dto.ts`
- Create: `modules/tenant/repositories/TenantDomainRepository.ts`
- Create: `modules/tenant/validators/tenant-domain.validator.ts`
- Create: `modules/tenant/index.ts`

- [ ] **Step 1: Create entity type**

```typescript
// modules/tenant/domain/TenantDomain.ts
export interface TenantDomain {
  id: string;
  tenantId: string;
  domain: string | null;
  slug: string;
  status: "pending" | "verified" | "active" | "failed";
  sslStatus: "pending" | "provisioning" | "active" | "failed";
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Create DTOs**

```typescript
// modules/tenant/dto/tenant-domain.dto.ts
export interface CreateTenantDomainDto {
  tenantId: string;
  slug: string;
  domain?: string;
}

export interface UpdateDomainDto {
  domain: string;
}

export interface TenantDomainResponseDto {
  id: string;
  tenantId: string;
  tenantName: string;
  domain: string | null;
  slug: string;
  status: string;
  sslStatus: string;
  verifiedAt: string | null;
  cnameTarget: string;
  subdomain: string;
}
```

- [ ] **Step 3: Create validators**

```typescript
// modules/tenant/validators/tenant-domain.validator.ts
import { z } from "zod";

export const createTenantDomainSchema = z.object({
  slug: z.string().min(3).max(63).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  domain: z.string().min(4).max(253).optional(),
});

export const updateDomainSchema = z.object({
  domain: z.string().min(4).max(253),
});
```

- [ ] **Step 4: Create repository**

```typescript
// modules/tenant/repositories/TenantDomainRepository.ts
import { prisma } from "@/modules/database";

export class TenantDomainRepository {
  async findBySlug(slug: string) {
    return prisma.tenantDomain.findUnique({ where: { slug } });
  }

  async findByDomain(domain: string) {
    return prisma.tenantDomain.findUnique({ where: { domain } });
  }

  async findByTenantId(tenantId: string) {
    return prisma.tenantDomain.findUnique({ where: { tenantId } });
  }

  async findPendingDomains() {
    return prisma.tenantDomain.findMany({
      where: { status: "pending", domain: { not: null } },
      include: { tenant: { select: { name: true } } },
    });
  }

  async findActiveDomains() {
    return prisma.tenantDomain.findMany({
      where: { status: "active", domain: { not: null } },
    });
  }

  async findAll() {
    return prisma.tenantDomain.findMany({
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: { tenantId: string; slug: string; domain?: string }) {
    return prisma.tenantDomain.create({ data });
  }

  async updateStatus(id: string, status: string, verifiedAt?: Date) {
    return prisma.tenantDomain.update({
      where: { id },
      data: { status, ...(verifiedAt && { verifiedAt }) },
    });
  }

  async updateSslStatus(id: string, sslStatus: string) {
    return prisma.tenantDomain.update({ where: { id }, data: { sslStatus } });
  }

  async updateDomain(id: string, domain: string) {
    return prisma.tenantDomain.update({
      where: { id },
      data: { domain, status: "pending", sslStatus: "pending", verifiedAt: null },
    });
  }

  async removeDomain(id: string) {
    return prisma.tenantDomain.update({
      where: { id },
      data: { domain: null, status: "pending", sslStatus: "pending", verifiedAt: null },
    });
  }

  async delete(id: string) {
    return prisma.tenantDomain.delete({ where: { id } });
  }
}
```

- [ ] **Step 5: Create public API index**

```typescript
// modules/tenant/index.ts
export { TenantDomainRepository } from "./repositories/TenantDomainRepository";
export { TenantDomainService } from "./services/TenantDomainService";
export { DnsVerificationService } from "./services/DnsVerificationService";
export type { TenantDomain } from "./domain/TenantDomain";
export type { TenantDomainResponseDto, CreateTenantDomainDto } from "./dto/tenant-domain.dto";
```

- [ ] **Step 6: Commit**

```bash
git add modules/tenant/
git commit -m "feat(tenant): add domain entity, repository, DTOs, and validators"
```

---

## Task 3: Tenant Module — Services (Domain, DNS, K8s)

**Files:**
- Create: `modules/tenant/services/TenantDomainService.ts`
- Create: `modules/tenant/services/DnsVerificationService.ts`
- Create: `modules/tenant/services/K8sCertificateService.ts`

- [ ] **Step 1: Create DnsVerificationService**

```typescript
// modules/tenant/services/DnsVerificationService.ts
import { resolve } from "node:dns/promises";
import { logger } from "@/lib/logger";

const CNAME_TARGET = "radpro.id";

export class DnsVerificationService {
  async verifyCname(domain: string): Promise<boolean> {
    try {
      const records = await resolve(domain, "CNAME");
      return records.some(
        (record) => record.replace(/\.$/, "").toLowerCase() === CNAME_TARGET,
      );
    } catch (error) {
      logger.warn(`[DnsVerification] Failed to resolve ${domain}:`, error);
      return false;
    }
  }

  async resolvesDomain(domain: string): Promise<boolean> {
    try {
      const addresses = await resolve(domain, "A");
      return addresses.length > 0;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 2: Create K8sCertificateService**

```typescript
// modules/tenant/services/K8sCertificateService.ts
import { logger } from "@/lib/logger";

interface CertificateSpec {
  slug: string;
  domain: string;
  namespace: string;
}

export class K8sCertificateService {
  private namespace: string;

  constructor() {
    this.namespace = process.env.K8S_NAMESPACE || "netmanager-production";
  }

  async createCertificate(spec: CertificateSpec): Promise<boolean> {
    try {
      const { KubeConfig, CustomObjectsApi } = await import(
        "@kubernetes/client-node"
      );
      const kc = new KubeConfig();
      kc.loadFromCluster();
      const customApi = kc.makeApiClient(CustomObjectsApi);

      const certResource = {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
          name: `tenant-${spec.slug}-tls`,
          namespace: spec.namespace,
        },
        spec: {
          secretName: `tenant-${spec.slug}-tls`,
          issuerRef: {
            name: "letsencrypt-production",
            kind: "ClusterIssuer",
          },
          dnsNames: [spec.domain],
        },
      };

      await customApi.createNamespacedCustomObject(
        "cert-manager.io",
        "v1",
        spec.namespace,
        "certificates",
        certResource,
      );

      logger.info(
        `[K8sCert] Created certificate for ${spec.domain} (tenant: ${spec.slug})`,
      );
      return true;
    } catch (error) {
      logger.error(`[K8sCert] Failed to create certificate for ${spec.domain}:`, error);
      return false;
    }
  }

  async deleteCertificate(slug: string): Promise<boolean> {
    try {
      const { KubeConfig, CustomObjectsApi } = await import(
        "@kubernetes/client-node"
      );
      const kc = new KubeConfig();
      kc.loadFromCluster();
      const customApi = kc.makeApiClient(CustomObjectsApi);

      await customApi.deleteNamespacedCustomObject(
        "cert-manager.io",
        "v1",
        this.namespace,
        "certificates",
        `tenant-${slug}-tls`,
      );

      logger.info(`[K8sCert] Deleted certificate for tenant: ${slug}`);
      return true;
    } catch (error) {
      logger.error(`[K8sCert] Failed to delete certificate for ${slug}:`, error);
      return false;
    }
  }

  async checkCertificateReady(slug: string): Promise<boolean> {
    try {
      const { KubeConfig, CustomObjectsApi } = await import(
        "@kubernetes/client-node"
      );
      const kc = new KubeConfig();
      kc.loadFromCluster();
      const customApi = kc.makeApiClient(CustomObjectsApi);

      const cert = (await customApi.getNamespacedCustomObject(
        "cert-manager.io",
        "v1",
        this.namespace,
        "certificates",
        `tenant-${slug}-tls`,
      )) as { body: { status?: { conditions?: Array<{ type: string; status: string }> } } };

      const conditions = cert.body?.status?.conditions || [];
      return conditions.some(
        (c) => c.type === "Ready" && c.status === "True",
      );
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 3: Create TenantDomainService**

```typescript
// modules/tenant/services/TenantDomainService.ts
import { TenantDomainRepository } from "../repositories/TenantDomainRepository";
import { DnsVerificationService } from "./DnsVerificationService";
import { K8sCertificateService } from "./K8sCertificateService";
import { logger } from "@/lib/logger";

export class TenantDomainService {
  private repository: TenantDomainRepository;
  private dnsService: DnsVerificationService;
  private k8sService: K8sCertificateService;

  constructor() {
    this.repository = new TenantDomainRepository();
    this.dnsService = new DnsVerificationService();
    this.k8sService = new K8sCertificateService();
  }

  async resolveBySlug(slug: string) {
    return this.repository.findBySlug(slug);
  }

  async resolveByDomain(domain: string) {
    return this.repository.findByDomain(domain);
  }

  async getByTenantId(tenantId: string) {
    return this.repository.findByTenantId(tenantId);
  }

  async listAll() {
    return this.repository.findAll();
  }

  async createForTenant(tenantId: string, slug: string, domain?: string) {
    return this.repository.create({ tenantId, slug, domain });
  }

  async setCustomDomain(id: string, domain: string) {
    return this.repository.updateDomain(id, domain);
  }

  async removeCustomDomain(id: string) {
    return this.repository.removeDomain(id);
  }

  async verifyPendingDomains() {
    const pending = await this.repository.findPendingDomains();
    const results: Array<{ domain: string; verified: boolean }> = [];

    for (const record of pending) {
      if (!record.domain) continue;
      const verified = await this.dnsService.verifyCname(record.domain);
      if (verified) {
        await this.repository.updateStatus(record.id, "verified", new Date());
        await this.provisionSsl(record.id, record.slug, record.domain);
      }
      results.push({ domain: record.domain, verified });
    }

    return results;
  }

  async checkActiveDomains() {
    const active = await this.repository.findActiveDomains();
    const results: Array<{ domain: string; stillActive: boolean }> = [];

    for (const record of active) {
      if (!record.domain) continue;
      const resolves = await this.dnsService.resolvesDomain(record.domain);
      if (!resolves) {
        await this.repository.updateStatus(record.id, "failed");
        await this.repository.updateSslStatus(record.id, "failed");
      }
      results.push({ domain: record.domain, stillActive: resolves });
    }

    return results;
  }

  async checkSslProvisioning() {
    const { prisma } = await import("@/modules/database");
    const provisioning = await prisma.tenantDomain.findMany({
      where: { sslStatus: "provisioning" },
    });

    for (const record of provisioning) {
      const ready = await this.k8sService.checkCertificateReady(record.slug);
      if (ready) {
        await this.repository.updateSslStatus(record.id, "active");
        await this.repository.updateStatus(record.id, "active");
        logger.info(`[TenantDomain] SSL active for ${record.domain}`);
      }
    }
  }

  private async provisionSsl(id: string, slug: string, domain: string) {
    const namespace = process.env.K8S_NAMESPACE || "netmanager-production";
    const success = await this.k8sService.createCertificate({ slug, domain, namespace });
    if (success) {
      await this.repository.updateSslStatus(id, "provisioning");
    } else {
      await this.repository.updateSslStatus(id, "failed");
    }
  }

  async disableDomain(id: string) {
    const record = await this.repository.findByTenantId(id);
    if (record) {
      await this.k8sService.deleteCertificate(record.slug);
      await this.repository.updateStatus(record.id, "failed");
      await this.repository.updateSslStatus(record.id, "failed");
    }
  }

  async manualVerify(id: string) {
    const { prisma } = await import("@/modules/database");
    const record = await prisma.tenantDomain.findUnique({ where: { id } });
    if (!record?.domain) return { verified: false, reason: "No domain set" };

    const verified = await this.dnsService.verifyCname(record.domain);
    if (verified) {
      await this.repository.updateStatus(id, "verified", new Date());
      await this.provisionSsl(id, record.slug, record.domain);
      return { verified: true };
    }
    return { verified: false, reason: "CNAME not pointing to radpro.id" };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add modules/tenant/services/
git commit -m "feat(tenant): add domain, DNS verification, and K8s certificate services"
```

---

## Task 4: Update Tenant Resolution — Support Slug & Custom Domain

**Files:**
- Modify: `lib/tenant-context.ts`
- Modify: `proxy.ts`

- [ ] **Step 1: Update `resolveTenantContextFromHost` in `lib/tenant-context.ts`**

Replace the existing `resolveTenantContextFromHost` function:

```typescript
async function resolveTenantContextFromHost(
  requestHeaders: Headers | null,
): Promise<TenantContextResult | null> {
  const host =
    requestHeaders?.get("x-forwarded-host") || requestHeaders?.get("host");
  const normalizedHost = host?.split(":")[0]?.trim().toLowerCase();

  if (!normalizedHost) {
    return null;
  }

  if (normalizedHost === "localhost") {
    return resolvePrimaryTenantContext();
  }

  const baseDomain = process.env.DOMAIN || "radpro.id";

  // Check if bare domain (main tenant)
  if (normalizedHost === baseDomain) {
    return resolvePrimaryTenantContext();
  }

  // Skip role subdomains — these are handled by proxy.ts
  const roleSubdomains = ["admin", "karyawan", "investor", "pelanggan"];
  for (const role of roleSubdomains) {
    if (normalizedHost.startsWith(`${role}.`) || normalizedHost.startsWith(`${role}-staging.`)) {
      return null;
    }
  }

  // Check if tenant slug subdomain: {slug}.radpro.id
  if (normalizedHost.endsWith(`.${baseDomain}`)) {
    const slug = normalizedHost.replace(`.${baseDomain}`, "");
    if (slug && !slug.includes(".")) {
      const tenantDomain = await prisma.tenantDomain.findUnique({
        where: { slug },
        select: { tenantId: true, status: true },
      });
      if (tenantDomain) {
        return { tenantId: tenantDomain.tenantId, isSuperAdmin: false };
      }
    }
  }

  // Check custom domain in TenantDomain table (status must be active)
  const tenantDomain = await prisma.tenantDomain.findFirst({
    where: { domain: normalizedHost, status: "active" },
    select: { tenantId: true },
  });
  if (tenantDomain) {
    return { tenantId: tenantDomain.tenantId, isSuperAdmin: false };
  }

  // Fallback: check legacy Tenant.domain field
  const tenant = await prisma.tenant.findFirst({
    where: { domain: normalizedHost, isActive: true },
    select: { id: true },
  });
  if (tenant) {
    return { tenantId: tenant.id, isSuperAdmin: false };
  }

  return null;
}
```

- [ ] **Step 2: Update `proxy.ts` to handle tenant subdomains**

Add tenant subdomain detection after role subdomain checks (before the "Root domain logic" section):

```typescript
// After line 59 (pelanggan-staging check), add:
// Check for tenant slug subdomain: {slug}.radpro.id or {slug}.staging.radpro.id
const baseDomain = process.env.DOMAIN || "radpro.id";
if (!subdomain && hostname.endsWith(`.${baseDomain}`)) {
  const possibleSlug = hostname.split(`.${baseDomain}`)[0]?.split(":")[0];
  if (possibleSlug && !possibleSlug.includes(".")) {
    // This is a tenant subdomain — let it pass through to app/page.tsx
    // Tenant resolution happens in tenant-context.ts
    subdomain = null; // explicitly no rewrite needed
  }
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add lib/tenant-context.ts proxy.ts
git commit -m "feat(tenant): update tenant resolution to support slug subdomain and custom domain"
```

---

## Task 5: Landing Page Split — Router + Components

**Files:**
- Modify: `app/page.tsx`
- Create: `components/landing/SaasLandingPage.tsx`
- Create: `components/landing/TenantLandingPage.tsx`

- [ ] **Step 1: Create TenantLandingPage component**

Refactor existing `components/LandingPage.tsx` into `components/landing/TenantLandingPage.tsx`. Keep the same UI but make branding fully dynamic:

```typescript
// components/landing/TenantLandingPage.tsx
"use client";

interface TenantLandingPageProps {
  brandingName: string;
  brandingLogoUrl?: string;
  tenantSlug: string;
}

export default function TenantLandingPage({
  brandingName,
  brandingLogoUrl,
  tenantSlug,
}: TenantLandingPageProps) {
  // Same structure as existing LandingPage.tsx
  // Replace all hardcoded "RADPRO.ID" references with brandingName
  // Login/register links point to customer portal for this tenant
  // ...existing UI code refactored...
}
```

- [ ] **Step 2: Create SaasLandingPage component**

```typescript
// components/landing/SaasLandingPage.tsx
"use client";

export default function SaasLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="...">
        <h1>Platform Manajemen ISP All-in-One</h1>
        <p>Billing, network monitoring, customer portal — semua dalam satu platform.</p>
        <div>
          <a href="/register">Daftar Gratis</a>
          <a href="#fitur">Lihat Fitur</a>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="...">
        {/* Billing & Invoicing */}
        {/* Network Management (MikroTik, OLT) */}
        {/* Customer Portal */}
        {/* Employee Management */}
        {/* Real-time Monitoring */}
        {/* Multi-tenant */}
      </section>

      {/* Pricing Section */}
      <section id="harga" className="...">
        {/* Pricing tiers */}
      </section>

      {/* Testimonials */}
      <section className="...">
        {/* Client logos / testimonials */}
      </section>

      {/* CTA Bottom */}
      <section className="...">
        <h2>Siap Kelola ISP Anda Lebih Efisien?</h2>
        <a href="/register">Mulai Sekarang</a>
      </section>

      {/* Footer */}
      <footer className="...">
        {/* RADPRO.ID info, links */}
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Update `app/page.tsx` router logic**

```typescript
// app/page.tsx
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import SaasLandingPage from "@/components/landing/SaasLandingPage";
import TenantLandingPage from "@/components/landing/TenantLandingPage";
import type { Metadata } from "next";
import { getPublicPortalSettings } from "@/modules/settings";
import { DEFAULT_PUBLIC_APP_NAME } from "@/lib/settings/publicBranding";
import { MAIN_TENANT_ID } from "@/lib/tenant-constants";
import { prisma } from "@/modules/database";

export const metadata: Metadata = {
  title: "RADPRO.ID - Platform Manajemen ISP All-in-One",
  description: "Billing, network monitoring, customer portal untuk ISP dalam satu platform.",
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const customerToken = cookieStore.get("customer-token");

  if (customerToken) {
    redirect("/dashboard");
  }

  // Resolve tenant from host
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const normalizedHost = host?.split(":")[0]?.trim().toLowerCase();
  const baseDomain = process.env.DOMAIN || "radpro.id";

  let tenantId: string | null = null;
  let tenantSlug: string | null = null;

  if (normalizedHost && normalizedHost !== baseDomain && normalizedHost !== "localhost") {
    // Check slug subdomain
    if (normalizedHost.endsWith(`.${baseDomain}`)) {
      const slug = normalizedHost.replace(`.${baseDomain}`, "");
      const td = await prisma.tenantDomain.findUnique({
        where: { slug },
        select: { tenantId: true, slug: true },
      });
      if (td) {
        tenantId = td.tenantId;
        tenantSlug = td.slug;
      }
    } else {
      // Check custom domain
      const td = await prisma.tenantDomain.findFirst({
        where: { domain: normalizedHost, status: "active" },
        select: { tenantId: true, slug: true },
      });
      if (td) {
        tenantId = td.tenantId;
        tenantSlug = td.slug;
      }
    }
  }

  // Main tenant or no tenant resolved → SaaS page
  if (!tenantId || tenantId === MAIN_TENANT_ID) {
    return <SaasLandingPage />;
  }

  // Tenant resolved → Tenant landing page
  let brandingName = DEFAULT_PUBLIC_APP_NAME;
  let brandingLogoUrl: string | undefined;

  try {
    const branding = await getPublicPortalSettings();
    brandingName = branding.namaAplikasi || DEFAULT_PUBLIC_APP_NAME;
    brandingLogoUrl = branding.landingLogoUrl || undefined;
  } catch {
    // fallback
  }

  return (
    <TenantLandingPage
      brandingName={brandingName}
      brandingLogoUrl={brandingLogoUrl}
      tenantSlug={tenantSlug!}
    />
  );
}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/landing/
git commit -m "feat(landing): split landing page into SaaS and tenant variants"
```

---

## Task 6: API Endpoints — Tenant Domain Management

**Files:**
- Create: `app/api/admin/tenant-domains/route.ts`
- Create: `app/api/admin/tenant-domains/[id]/verify/route.ts`
- Create: `app/api/admin/tenant-domains/[id]/disable/route.ts`
- Create: `app/api/admin/tenants/[id]/domains/route.ts`
- Create: `app/api/admin/tenants/[id]/domains/[domainId]/route.ts`
- Create: `app/api/admin/tenants/[id]/domains/[domainId]/verify/route.ts`

- [ ] **Step 1: Create super admin endpoint — list all domains**

```typescript
// app/api/admin/tenant-domains/route.ts
import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { withAuthorization } from "@/lib/authorization-middleware";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

async function handleGet(_request: NextRequest) {
  const domains = await domainService.listAll();
  const baseDomain = process.env.DOMAIN || "radpro.id";

  const response = domains.map((d) => ({
    id: d.id,
    tenantId: d.tenantId,
    tenantName: d.tenant.name,
    domain: d.domain,
    slug: d.slug,
    status: d.status,
    sslStatus: d.sslStatus,
    verifiedAt: d.verifiedAt?.toISOString() || null,
    cnameTarget: "radpro.id",
    subdomain: `${d.slug}.${baseDomain}`,
  }));

  return apiSuccess(response);
}

export const GET = withAuthorization(handleGet, { superAdminOnly: true });
```

- [ ] **Step 2: Create super admin endpoint — manual verify**

```typescript
// app/api/admin/tenant-domains/[id]/verify/route.ts
import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { withAuthorization } from "@/lib/authorization-middleware";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

async function handlePost(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const result = await domainService.manualVerify(id);
  return apiSuccess(result);
}

export const POST = withAuthorization(handlePost, { superAdminOnly: true });
```

- [ ] **Step 3: Create super admin endpoint — disable domain**

```typescript
// app/api/admin/tenant-domains/[id]/disable/route.ts
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { withAuthorization } from "@/lib/authorization-middleware";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

async function handlePost(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  await domainService.disableDomain(id);
  return apiSuccess({ disabled: true });
}

export const POST = withAuthorization(handlePost, { superAdminOnly: true });
```

- [ ] **Step 4: Create tenant admin endpoint — list & add domain**

```typescript
// app/api/admin/tenants/[id]/domains/route.ts
import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { withAuthorization } from "@/lib/authorization-middleware";
import { TenantDomainService } from "@/modules/tenant";
import { updateDomainSchema } from "@/modules/tenant/validators/tenant-domain.validator";

const domainService = new TenantDomainService();

async function handleGet(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const domain = await domainService.getByTenantId(id);
  if (!domain) {
    return apiSuccess(null);
  }

  const baseDomain = process.env.DOMAIN || "radpro.id";
  return apiSuccess({
    id: domain.id,
    domain: domain.domain,
    slug: domain.slug,
    status: domain.status,
    sslStatus: domain.sslStatus,
    verifiedAt: domain.verifiedAt?.toISOString() || null,
    cnameTarget: "radpro.id",
    subdomain: `${domain.slug}.${baseDomain}`,
    instructions: domain.domain
      ? `Arahkan CNAME ${domain.domain} ke radpro.id`
      : null,
  });
}

async function handlePost(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const body = await request.json();
  const parsed = updateDomainSchema.safeParse(body);

  if (!parsed.success) {
    return ApiErrors.validationError(parsed.error.flatten().fieldErrors);
  }

  const existing = await domainService.getByTenantId(id);
  if (!existing) {
    return ApiErrors.notFound("TenantDomain not found for this tenant");
  }

  const updated = await domainService.setCustomDomain(existing.id, parsed.data.domain);
  return apiSuccess(updated);
}

export const GET = withAuthorization(handleGet, { permission: "tenant:read" });
export const POST = withAuthorization(handlePost, { permission: "tenant:update" });
```

- [ ] **Step 5: Create tenant admin endpoint — delete domain**

```typescript
// app/api/admin/tenants/[id]/domains/[domainId]/route.ts
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { withAuthorization } from "@/lib/authorization-middleware";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

async function handleDelete(
  _request: NextRequest,
  { params }: { params: { id: string; domainId: string } },
) {
  await domainService.removeCustomDomain(params.domainId);
  return apiSuccess({ removed: true });
}

export const DELETE = withAuthorization(handleDelete, { permission: "tenant:update" });
```

- [ ] **Step 6: Create tenant admin endpoint — manual verify trigger**

```typescript
// app/api/admin/tenants/[id]/domains/[domainId]/verify/route.ts
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { withAuthorization } from "@/lib/authorization-middleware";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

async function handlePost(
  _request: NextRequest,
  { params }: { params: { id: string; domainId: string } },
) {
  const result = await domainService.manualVerify(params.domainId);
  return apiSuccess(result);
}

export const POST = withAuthorization(handlePost, { permission: "tenant:update" });
```

- [ ] **Step 7: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add app/api/admin/tenant-domains/ app/api/admin/tenants/
git commit -m "feat(tenant): add API endpoints for domain management"
```

---

## Task 7: Cron Job — DNS Verification

**Files:**
- Create: `app/api/cron/tenant-domain-verify/route.ts`

- [ ] **Step 1: Create DNS verification cron endpoint**

```typescript
// app/api/cron/tenant-domain-verify/route.ts
import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { TenantDomainService } from "@/modules/tenant";
import { logger } from "@/lib/logger";

const domainService = new TenantDomainService();

function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return ApiErrors.unauthorized("Invalid cron secret");
  }

  try {
    // 1. Verify pending domains
    const verifyResults = await domainService.verifyPendingDomains();

    // 2. Check active domains still resolve
    const activeResults = await domainService.checkActiveDomains();

    // 3. Check SSL provisioning status
    await domainService.checkSslProvisioning();

    const summary = {
      timestamp: new Date().toISOString(),
      pending: {
        checked: verifyResults.length,
        verified: verifyResults.filter((r) => r.verified).length,
      },
      active: {
        checked: activeResults.length,
        failed: activeResults.filter((r) => !r.stillActive).length,
      },
    };

    logger.info("[Cron:TenantDomainVerify]", summary);
    return apiSuccess(summary);
  } catch (error) {
    logger.error("[Cron:TenantDomainVerify] Failed:", error);
    const msg = error instanceof Error ? error.message : "Domain verify cron failed";
    return ApiErrors.internalError(msg);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cron/tenant-domain-verify/
git commit -m "feat(tenant): add DNS verification cron job"
```

---

## Task 8: Infrastructure — Traefik Catch-All IngressRoute

**Files:**
- Create: `k8s/production/ingress-tenant-catchall.yaml`
- Create: `k8s/staging/ingress-tenant-catchall.yaml`

- [ ] **Step 1: Create production catch-all IngressRoute**

```yaml
# k8s/production/ingress-tenant-catchall.yaml
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
  tls: {}
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: netmanager-tenant-catchall-http
  namespace: netmanager-production
spec:
  entryPoints:
    - web
  routes:
    - match: HostRegexp(`{host:.+}`)
      kind: Rule
      priority: 1
      middlewares:
        - name: redirect-to-https
      services:
        - name: netmanager-app
          port: 80
```

- [ ] **Step 2: Create staging catch-all IngressRoute**

```yaml
# k8s/staging/ingress-tenant-catchall.yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: netmanager-tenant-catchall
  namespace: netmanager-staging
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
  tls: {}
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: netmanager-tenant-catchall-http
  namespace: netmanager-staging
spec:
  entryPoints:
    - web
  routes:
    - match: HostRegexp(`{host:.+}`)
      kind: Rule
      priority: 1
      middlewares:
        - name: redirect-to-https
      services:
        - name: netmanager-app
          port: 80
```

- [ ] **Step 3: Commit**

```bash
git add k8s/
git commit -m "infra(k8s): add Traefik catch-all IngressRoute for tenant custom domains"
```

---

## Task 9: Install @kubernetes/client-node Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

```bash
npm install @kubernetes/client-node
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @kubernetes/client-node for tenant SSL provisioning"
```

---

## Task 10: Integration Testing & Verification

**Files:**
- Test tenant resolution logic
- Test API endpoints
- Test cron job

- [ ] **Step 1: Test tenant resolution with slug**

Create test file:
```typescript
// modules/tenant/__tests__/TenantDomainService.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { TenantDomainRepository } from "../repositories/TenantDomainRepository";

describe("TenantDomainRepository", () => {
  const repo = new TenantDomainRepository();

  it("should find tenant by slug", async () => {
    // Test with seeded data
    const result = await repo.findBySlug("test-tenant");
    expect(result).toBeDefined();
    expect(result?.slug).toBe("test-tenant");
  });

  it("should return null for non-existent slug", async () => {
    const result = await repo.findBySlug("non-existent-slug");
    expect(result).toBeNull();
  });

  it("should find tenant by custom domain", async () => {
    const result = await repo.findByDomain("custom.example.com");
    // Will be null unless seeded
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- modules/tenant/__tests__/
```

- [ ] **Step 3: Run full typecheck and lint**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add modules/tenant/__tests__/
git commit -m "test(tenant): add integration tests for TenantDomainRepository"
```

---

## Task 11: Update Changelog

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

```markdown
### [2026-05-22] — Multi-tenant landing page dengan custom domain management

- **Tipe**: [ADDED]
- **Scope**: `modules/tenant`, `app/page.tsx`, `components/landing/`
- **Author**: agent
- **Deskripsi**: Implementasi landing page per tenant dengan branding dinamis.
  Landing page RADPRO.ID (SaaS) dipisah dari landing page tenant. Setiap tenant
  otomatis dapat subdomain ({slug}.radpro.id) dan bisa menambahkan custom domain
  via CNAME. Termasuk DNS verification cron job dan SSL auto-provisioning via
  cert-manager.
- **Migration**: `add_tenant_domain_table`
- **Breaking**: ❌ Tidak
```

- [ ] **Step 2: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): add multi-tenant landing page entry"
```

---

## Execution Order & Dependencies

```
Task 1 (Schema) → Task 2 (Entity/Repo) → Task 3 (Services) → Task 4 (Tenant Resolution)
                                                              → Task 5 (Landing Pages)
                                                              → Task 6 (API Endpoints)
                                                              → Task 7 (Cron Job)
Task 9 (Install dep) → Task 3 (K8s service needs it)
Task 8 (Infra) — independent, can be done anytime
Task 10 (Testing) — after Tasks 1-7
Task 11 (Changelog) — last
```

**Critical path:** Task 1 → 2 → 3 → 4 → 5 (landing pages visible)

**Parallelizable after Task 3:**
- Task 4 + Task 5 (can be done in parallel)
- Task 6 + Task 7 (can be done in parallel)
- Task 8 (independent)
