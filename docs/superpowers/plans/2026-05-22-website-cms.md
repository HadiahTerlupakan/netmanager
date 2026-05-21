# Website CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panel untuk super admin manage konten landing page RADPRO.ID (hero, fitur, pricing, testimonial, FAQ, footer) secara dinamis dari dashboard.

**Architecture:** Modul baru `modules/website/` dengan dedicated Prisma tables per section. Admin pages di `app/admin/website/` dengan sub-menu di sidebar. SaasLandingPage fetch konten dari DB via server component, fallback ke hardcoded defaults.

**Tech Stack:** Next.js 14 (App Router), Prisma, Tailwind CSS, Zod, react-icons

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add 6 landing content models |
| Create | `modules/website/domain/LandingContent.ts` | Entity types |
| Create | `modules/website/dto/landing-content.dto.ts` | Response DTOs |
| Create | `modules/website/repositories/LandingContentRepository.ts` | Data access |
| Create | `modules/website/services/LandingContentService.ts` | Business logic |
| Create | `modules/website/validators/landing-content.validator.ts` | Zod schemas |
| Create | `modules/website/index.ts` | Public API |
| Modify | `lib/menu-config.ts` | Add Website section |
| Modify | `components/layout/admin-sidebar/adminSidebarMenu.ts` | Super admin filter |
| Create | `app/api/admin/website/hero/route.ts` | Hero GET/PUT |
| Create | `app/api/admin/website/features/route.ts` | Features GET/POST |
| Create | `app/api/admin/website/features/[id]/route.ts` | Feature PUT/DELETE |
| Create | `app/api/admin/website/pricing/route.ts` | Pricing GET/POST |
| Create | `app/api/admin/website/pricing/[id]/route.ts` | Pricing PUT/DELETE |
| Create | `app/api/admin/website/testimonials/route.ts` | Testimonials GET/POST |
| Create | `app/api/admin/website/testimonials/[id]/route.ts` | Testimonial PUT/DELETE |
| Create | `app/api/admin/website/faq/route.ts` | FAQ GET/POST |
| Create | `app/api/admin/website/faq/[id]/route.ts` | FAQ PUT/DELETE |
| Create | `app/api/admin/website/footer/route.ts` | Footer GET/PUT |
| Create | `app/api/public/landing-content/route.ts` | Public aggregated endpoint |
| Create | `app/admin/website/page.tsx` | Redirect to /hero |
| Create | `app/admin/website/hero/page.tsx` | Hero admin page |
| Create | `app/admin/website/fitur/page.tsx` | Features admin page |
| Create | `app/admin/website/pricing/page.tsx` | Pricing admin page |
| Create | `app/admin/website/testimonial/page.tsx` | Testimonial admin page |
| Create | `app/admin/website/faq/page.tsx` | FAQ admin page |
| Create | `app/admin/website/footer/page.tsx` | Footer admin page |
| Modify | `components/landing/SaasLandingPage.tsx` | Render from DB data |
| Modify | `app/page.tsx` | Fetch landing content for SaaS page |

---

## Task 1: Database Schema — Landing Content Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add all 6 landing content models to Prisma schema**

Add these models at the end of the schema file (before any enums):

```prisma
// ─── Landing Page CMS ───────────────────────────────────────────────────────

model LandingHero {
  id           String   @id @default(uuid())
  badge        String?
  title        String
  highlight    String?
  subtitle     String
  ctaPrimary   String   @default("Mulai Gratis 14 Hari")
  ctaSecondary String   @default("Lihat Fitur")
  ctaLink      String   @default("/admin/login")
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model LandingFeature {
  id          String   @id @default(uuid())
  title       String
  description String
  icon        String
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([sortOrder])
}

model LandingPricing {
  id          String   @id @default(uuid())
  name        String
  price       String
  period      String   @default("/bulan")
  description String?
  features    Json
  isPopular   Boolean  @default(false)
  ctaText     String   @default("Mulai Sekarang")
  ctaLink     String   @default("/admin/login")
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([sortOrder])
}

model LandingTestimonial {
  id        String   @id @default(uuid())
  name      String
  role      String
  content   String
  rating    Int      @default(5)
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([sortOrder])
}

model LandingFaq {
  id        String   @id @default(uuid())
  question  String
  answer    String
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([sortOrder])
}

model LandingFooter {
  id          String   @id @default(uuid())
  companyName String   @default("RADPRO.ID")
  description String?
  address     String?
  email       String?
  phone       String?
  links       Json
  socials     Json?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 2: Generate Prisma client**

```bash
npm run prisma:generate
```

- [ ] **Step 3: Create migration**

```bash
npx prisma migrate dev --name add_landing_content_tables --create-only
```

If `migrate dev` fails due to DB connection, create the migration manually at `prisma/migrations/20260522120000_add_landing_content_tables/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "LandingHero" (
    "id" TEXT NOT NULL,
    "badge" TEXT,
    "title" TEXT NOT NULL,
    "highlight" TEXT,
    "subtitle" TEXT NOT NULL,
    "ctaPrimary" TEXT NOT NULL DEFAULT 'Mulai Gratis 14 Hari',
    "ctaSecondary" TEXT NOT NULL DEFAULT 'Lihat Fitur',
    "ctaLink" TEXT NOT NULL DEFAULT '/admin/login',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingHero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingFeature" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPricing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT '/bulan',
    "description" TEXT,
    "features" JSONB NOT NULL,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "ctaText" TEXT NOT NULL DEFAULT 'Mulai Sekarang',
    "ctaLink" TEXT NOT NULL DEFAULT '/admin/login',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingTestimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingTestimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingFaq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingFooter" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'RADPRO.ID',
    "description" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "links" JSONB NOT NULL,
    "socials" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingFooter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingFeature_sortOrder_idx" ON "LandingFeature"("sortOrder");
CREATE INDEX "LandingPricing_sortOrder_idx" ON "LandingPricing"("sortOrder");
CREATE INDEX "LandingTestimonial_sortOrder_idx" ON "LandingTestimonial"("sortOrder");
CREATE INDEX "LandingFaq_sortOrder_idx" ON "LandingFaq"("sortOrder");
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(website): add landing content database models and migration"
```

---

## Task 2: Website Module — Domain, DTOs, Validators, Repository

**Files:**
- Create: `modules/website/domain/LandingContent.ts`
- Create: `modules/website/dto/landing-content.dto.ts`
- Create: `modules/website/validators/landing-content.validator.ts`
- Create: `modules/website/repositories/LandingContentRepository.ts`
- Create: `modules/website/index.ts`

- [ ] **Step 1: Create entity types**

```typescript
// modules/website/domain/LandingContent.ts
export interface LandingHero {
  id: string;
  badge: string | null;
  title: string;
  highlight: string | null;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaLink: string;
  isActive: boolean;
}

export interface LandingFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingPricing {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string | null;
  features: string[];
  isPopular: boolean;
  ctaText: string;
  ctaLink: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingTestimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingFaq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingFooter {
  id: string;
  companyName: string;
  description: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  links: Record<string, Array<{ label: string; href: string }>>;
  socials: Record<string, string> | null;
  isActive: boolean;
}

export interface LandingContentAll {
  hero: LandingHero | null;
  features: LandingFeature[];
  pricing: LandingPricing[];
  testimonials: LandingTestimonial[];
  faq: LandingFaq[];
  footer: LandingFooter | null;
}
```

- [ ] **Step 2: Create validators**

```typescript
// modules/website/validators/landing-content.validator.ts
import { z } from "zod";

export const heroSchema = z.object({
  badge: z.string().max(100).nullable().optional(),
  title: z.string().min(1).max(200),
  highlight: z.string().max(100).nullable().optional(),
  subtitle: z.string().min(1).max(500),
  ctaPrimary: z.string().min(1).max(50),
  ctaSecondary: z.string().min(1).max(50),
  ctaLink: z.string().min(1).max(200),
});

export const featureSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
  icon: z.string().min(1).max(50),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const pricingSchema = z.object({
  name: z.string().min(1).max(50),
  price: z.string().min(1).max(50),
  period: z.string().max(20).optional(),
  description: z.string().max(200).nullable().optional(),
  features: z.array(z.string()),
  isPopular: z.boolean().optional(),
  ctaText: z.string().min(1).max(50).optional(),
  ctaLink: z.string().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const testimonialSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  content: z.string().min(1).max(500),
  rating: z.number().int().min(1).max(5).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const faqSchema = z.object({
  question: z.string().min(1).max(200),
  answer: z.string().min(1).max(1000),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const footerSchema = z.object({
  companyName: z.string().min(1).max(100),
  description: z.string().max(300).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  links: z.record(z.array(z.object({ label: z.string(), href: z.string() }))),
  socials: z.record(z.string()).nullable().optional(),
});
```

- [ ] **Step 3: Create repository**

```typescript
// modules/website/repositories/LandingContentRepository.ts
import { prisma } from "@/modules/database";

export class LandingContentRepository {
  // Hero (single row)
  async getHero() {
    return prisma.landingHero.findFirst({ where: { isActive: true } });
  }

  async upsertHero(data: Omit<Parameters<typeof prisma.landingHero.upsert>[0]["create"], "id">) {
    const existing = await prisma.landingHero.findFirst();
    if (existing) {
      return prisma.landingHero.update({ where: { id: existing.id }, data });
    }
    return prisma.landingHero.create({ data });
  }

  // Features (multiple rows)
  async getFeatures() {
    return prisma.landingFeature.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getAllFeatures() {
    return prisma.landingFeature.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async createFeature(data: { title: string; description: string; icon: string; sortOrder?: number; isActive?: boolean }) {
    return prisma.landingFeature.create({ data });
  }

  async updateFeature(id: string, data: Partial<{ title: string; description: string; icon: string; sortOrder: number; isActive: boolean }>) {
    return prisma.landingFeature.update({ where: { id }, data });
  }

  async deleteFeature(id: string) {
    return prisma.landingFeature.delete({ where: { id } });
  }

  // Pricing (multiple rows)
  async getPricing() {
    return prisma.landingPricing.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getAllPricing() {
    return prisma.landingPricing.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async createPricing(data: { name: string; price: string; period?: string; description?: string | null; features: unknown; isPopular?: boolean; ctaText?: string; ctaLink?: string; sortOrder?: number; isActive?: boolean }) {
    return prisma.landingPricing.create({ data: data as Parameters<typeof prisma.landingPricing.create>[0]["data"] });
  }

  async updatePricing(id: string, data: Record<string, unknown>) {
    return prisma.landingPricing.update({ where: { id }, data: data as Parameters<typeof prisma.landingPricing.update>[0]["data"] });
  }

  async deletePricing(id: string) {
    return prisma.landingPricing.delete({ where: { id } });
  }

  // Testimonials (multiple rows)
  async getTestimonials() {
    return prisma.landingTestimonial.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getAllTestimonials() {
    return prisma.landingTestimonial.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async createTestimonial(data: { name: string; role: string; content: string; rating?: number; sortOrder?: number; isActive?: boolean }) {
    return prisma.landingTestimonial.create({ data });
  }

  async updateTestimonial(id: string, data: Partial<{ name: string; role: string; content: string; rating: number; sortOrder: number; isActive: boolean }>) {
    return prisma.landingTestimonial.update({ where: { id }, data });
  }

  async deleteTestimonial(id: string) {
    return prisma.landingTestimonial.delete({ where: { id } });
  }

  // FAQ (multiple rows)
  async getFaq() {
    return prisma.landingFaq.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getAllFaq() {
    return prisma.landingFaq.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async createFaq(data: { question: string; answer: string; sortOrder?: number; isActive?: boolean }) {
    return prisma.landingFaq.create({ data });
  }

  async updateFaq(id: string, data: Partial<{ question: string; answer: string; sortOrder: number; isActive: boolean }>) {
    return prisma.landingFaq.update({ where: { id }, data });
  }

  async deleteFaq(id: string) {
    return prisma.landingFaq.delete({ where: { id } });
  }

  // Footer (single row)
  async getFooter() {
    return prisma.landingFooter.findFirst({ where: { isActive: true } });
  }

  async upsertFooter(data: Record<string, unknown>) {
    const existing = await prisma.landingFooter.findFirst();
    if (existing) {
      return prisma.landingFooter.update({ where: { id: existing.id }, data: data as Parameters<typeof prisma.landingFooter.update>[0]["data"] });
    }
    return prisma.landingFooter.create({ data: data as Parameters<typeof prisma.landingFooter.create>[0]["data"] });
  }

  // Public: get all active content
  async getAllContent() {
    const [hero, features, pricing, testimonials, faq, footer] = await Promise.all([
      this.getHero(),
      this.getFeatures(),
      this.getPricing(),
      this.getTestimonials(),
      this.getFaq(),
      this.getFooter(),
    ]);
    return { hero, features, pricing, testimonials, faq, footer };
  }
}
```

- [ ] **Step 4: Create service**

```typescript
// modules/website/services/LandingContentService.ts
import { LandingContentRepository } from "../repositories/LandingContentRepository";

export class LandingContentService {
  private repository: LandingContentRepository;

  constructor() {
    this.repository = new LandingContentRepository();
  }

  // Hero
  getHero() { return this.repository.getHero(); }
  upsertHero(data: Parameters<LandingContentRepository["upsertHero"]>[0]) { return this.repository.upsertHero(data); }

  // Features
  getFeatures() { return this.repository.getAllFeatures(); }
  getActiveFeatures() { return this.repository.getFeatures(); }
  createFeature(data: Parameters<LandingContentRepository["createFeature"]>[0]) { return this.repository.createFeature(data); }
  updateFeature(id: string, data: Parameters<LandingContentRepository["updateFeature"]>[1]) { return this.repository.updateFeature(id, data); }
  deleteFeature(id: string) { return this.repository.deleteFeature(id); }

  // Pricing
  getPricing() { return this.repository.getAllPricing(); }
  getActivePricing() { return this.repository.getPricing(); }
  createPricing(data: Parameters<LandingContentRepository["createPricing"]>[0]) { return this.repository.createPricing(data); }
  updatePricing(id: string, data: Parameters<LandingContentRepository["updatePricing"]>[1]) { return this.repository.updatePricing(id, data); }
  deletePricing(id: string) { return this.repository.deletePricing(id); }

  // Testimonials
  getTestimonials() { return this.repository.getAllTestimonials(); }
  getActiveTestimonials() { return this.repository.getTestimonials(); }
  createTestimonial(data: Parameters<LandingContentRepository["createTestimonial"]>[0]) { return this.repository.createTestimonial(data); }
  updateTestimonial(id: string, data: Parameters<LandingContentRepository["updateTestimonial"]>[1]) { return this.repository.updateTestimonial(id, data); }
  deleteTestimonial(id: string) { return this.repository.deleteTestimonial(id); }

  // FAQ
  getFaq() { return this.repository.getAllFaq(); }
  getActiveFaq() { return this.repository.getFaq(); }
  createFaq(data: Parameters<LandingContentRepository["createFaq"]>[0]) { return this.repository.createFaq(data); }
  updateFaq(id: string, data: Parameters<LandingContentRepository["updateFaq"]>[1]) { return this.repository.updateFaq(id, data); }
  deleteFaq(id: string) { return this.repository.deleteFaq(id); }

  // Footer
  getFooter() { return this.repository.getFooter(); }
  upsertFooter(data: Parameters<LandingContentRepository["upsertFooter"]>[0]) { return this.repository.upsertFooter(data); }

  // Public
  getAllContent() { return this.repository.getAllContent(); }
}
```

- [ ] **Step 5: Create public API index**

```typescript
// modules/website/index.ts
export { LandingContentRepository } from "./repositories/LandingContentRepository";
export { LandingContentService } from "./services/LandingContentService";
export type {
  LandingHero,
  LandingFeature,
  LandingPricing,
  LandingTestimonial,
  LandingFaq,
  LandingFooter,
  LandingContentAll,
} from "./domain/LandingContent";
export {
  heroSchema,
  featureSchema,
  pricingSchema,
  testimonialSchema,
  faqSchema,
  footerSchema,
} from "./validators/landing-content.validator";
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add modules/website/
git commit -m "feat(website): add landing content module with domain, repository, service, and validators"
```

---

## Task 3: Sidebar Integration — Add "Website" Category

**Files:**
- Modify: `lib/menu-config.ts`
- Modify: `components/layout/admin-sidebar/adminSidebarMenu.ts`

- [ ] **Step 1: Add MenuConfig interface update**

In `lib/menu-config.ts`, add `superAdminOnly?: boolean` to the `MenuConfig` interface:

```typescript
export interface MenuConfig {
  code: string;
  name: string;
  path: string | null;
  icon?: string | undefined;
  children?: MenuConfig[] | undefined;
  exact?: boolean | undefined;
  section?: string | undefined;
  divider?: boolean | undefined;
  superAdminOnly?: boolean | undefined;  // NEW
}
```

- [ ] **Step 2: Add Website menu items**

In `lib/menu-config.ts`, add the Website section BEFORE the "Sistem" section (before the TENANT item). Import `MdLanguage` from `react-icons/md`:

```typescript
  // ─── Website (Super Admin Only) ───
  {
    code: "WEBSITE",
    name: "Website",
    path: null,
    icon: "MdLanguage",
    section: "Website",
    superAdminOnly: true,
    children: [
      { code: "WEBSITE.HERO", name: "Hero", path: "/admin/website/hero" },
      { code: "WEBSITE.FITUR", name: "Fitur", path: "/admin/website/fitur" },
      { code: "WEBSITE.PRICING", name: "Pricing", path: "/admin/website/pricing" },
      { code: "WEBSITE.TESTIMONIAL", name: "Testimonial", path: "/admin/website/testimonial" },
      { code: "WEBSITE.FAQ", name: "FAQ", path: "/admin/website/faq" },
      { code: "WEBSITE.FOOTER", name: "Footer", path: "/admin/website/footer" },
    ],
  },
```

- [ ] **Step 3: Update sidebar filtering to respect superAdminOnly**

In `components/layout/admin-sidebar/adminSidebarMenu.ts`, update the `filterAdminMenuItem` function to check `superAdminOnly`. The function needs access to `isSuperAdmin` flag.

Update the `FilterAdminMenuItemsParams` interface to include `isSuperAdmin`:

```typescript
interface FilterAdminMenuItemsParams {
  items: MenuConfig[];
  hasPermission: SidebarPermissionChecker;
  pppConnectionMode?: string | null;
  isSuperAdmin?: boolean;  // NEW
}
```

In the `filterAdminMenuItem` function, add this check early:

```typescript
// Hide super admin only items for non-super-admin users
if (item.superAdminOnly && !isSuperAdmin) {
  return null;
}
```

Update `useFilteredAdminMenu.ts` to pass `isSuperAdmin` from the permission context.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/menu-config.ts components/layout/admin-sidebar/
git commit -m "feat(website): add Website category to admin sidebar (super admin only)"
```

---

## Task 4: API Endpoints — Hero & Footer (Single-Row)

**Files:**
- Create: `app/api/admin/website/hero/route.ts`
- Create: `app/api/admin/website/footer/route.ts`

- [ ] **Step 1: Create hero endpoint**

```typescript
// app/api/admin/website/hero/route.ts
import { NextRequest } from "next/server";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-response";
import { withAuth } from "@/lib/middleware/auth";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService } from "@/modules/website";
import { heroSchema } from "@/modules/website";

const service = new LandingContentService();

export const GET = withAuth(async ({ user }) => {
  if (!isSuperAdmin(user)) {
    return apiError("Super admin access required", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  const hero = await service.getHero();
  return apiSuccess(hero);
});

export const PUT = withAuth(async ({ user, request }) => {
  if (!isSuperAdmin(user)) {
    return apiError("Super admin access required", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  const body = await request.json();
  const parsed = heroSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const hero = await service.upsertHero(parsed.data);
  return apiSuccess(hero);
});
```

- [ ] **Step 2: Create footer endpoint**

```typescript
// app/api/admin/website/footer/route.ts
import { NextRequest } from "next/server";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-response";
import { withAuth } from "@/lib/middleware/auth";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService } from "@/modules/website";
import { footerSchema } from "@/modules/website";

const service = new LandingContentService();

export const GET = withAuth(async ({ user }) => {
  if (!isSuperAdmin(user)) {
    return apiError("Super admin access required", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  const footer = await service.getFooter();
  return apiSuccess(footer);
});

export const PUT = withAuth(async ({ user, request }) => {
  if (!isSuperAdmin(user)) {
    return apiError("Super admin access required", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  const body = await request.json();
  const parsed = footerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const footer = await service.upsertFooter(parsed.data);
  return apiSuccess(footer);
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/website/hero/ app/api/admin/website/footer/
git commit -m "feat(website): add hero and footer API endpoints"
```

---

## Task 5: API Endpoints — CRUD (Features, Pricing, Testimonials, FAQ)

**Files:**
- Create: `app/api/admin/website/features/route.ts`
- Create: `app/api/admin/website/features/[id]/route.ts`
- Create: `app/api/admin/website/pricing/route.ts`
- Create: `app/api/admin/website/pricing/[id]/route.ts`
- Create: `app/api/admin/website/testimonials/route.ts`
- Create: `app/api/admin/website/testimonials/[id]/route.ts`
- Create: `app/api/admin/website/faq/route.ts`
- Create: `app/api/admin/website/faq/[id]/route.ts`

- [ ] **Step 1: Create features list/create endpoint**

```typescript
// app/api/admin/website/features/route.ts
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-response";
import { withAuth } from "@/lib/middleware/auth";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, featureSchema } from "@/modules/website";

const service = new LandingContentService();

export const GET = withAuth(async ({ user }) => {
  if (!isSuperAdmin(user)) {
    return apiError("Super admin access required", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  const features = await service.getFeatures();
  return apiSuccess(features);
});

export const POST = withAuth(async ({ user, request }) => {
  if (!isSuperAdmin(user)) {
    return apiError("Super admin access required", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  const body = await request.json();
  const parsed = featureSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const feature = await service.createFeature(parsed.data);
  return apiSuccess(feature, { status: 201 });
});
```

- [ ] **Step 2: Create features update/delete endpoint**

```typescript
// app/api/admin/website/features/[id]/route.ts
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-response";
import { withAuth } from "@/lib/middleware/auth";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, featureSchema } from "@/modules/website";

const service = new LandingContentService();

export const PUT = withAuth(async ({ user, request }, { params }: { params: { id: string } }) => {
  if (!isSuperAdmin(user)) {
    return apiError("Super admin access required", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  const parsed = featureSchema.partial().safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const feature = await service.updateFeature(id, parsed.data);
  return apiSuccess(feature);
});

export const DELETE = withAuth(async ({ user }, { params }: { params: { id: string } }) => {
  if (!isSuperAdmin(user)) {
    return apiError("Super admin access required", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  const { id } = await params;
  await service.deleteFeature(id);
  return apiSuccess({ deleted: true });
});
```

- [ ] **Step 3: Create pricing endpoints (same pattern as features)**

Create `app/api/admin/website/pricing/route.ts` and `app/api/admin/website/pricing/[id]/route.ts` following the same pattern as features but using `pricingSchema` and `service.createPricing/updatePricing/deletePricing/getPricing`.

- [ ] **Step 4: Create testimonials endpoints (same pattern)**

Create `app/api/admin/website/testimonials/route.ts` and `app/api/admin/website/testimonials/[id]/route.ts` using `testimonialSchema` and `service.createTestimonial/updateTestimonial/deleteTestimonial/getTestimonials`.

- [ ] **Step 5: Create FAQ endpoints (same pattern)**

Create `app/api/admin/website/faq/route.ts` and `app/api/admin/website/faq/[id]/route.ts` using `faqSchema` and `service.createFaq/updateFaq/deleteFaq/getFaq`.

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/website/
git commit -m "feat(website): add CRUD API endpoints for features, pricing, testimonials, and FAQ"
```

---

## Task 6: Public Landing Content Endpoint

**Files:**
- Create: `app/api/public/landing-content/route.ts`

- [ ] **Step 1: Create public endpoint**

```typescript
// app/api/public/landing-content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { LandingContentService } from "@/modules/website";

const service = new LandingContentService();

export async function GET(_request: NextRequest) {
  const content = await service.getAllContent();

  return NextResponse.json(
    { success: true, data: content },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/public/landing-content/
git commit -m "feat(website): add public landing content endpoint with caching"
```

---

## Task 7: Admin Pages — Hero & Footer (Form Pages)

**Files:**
- Create: `app/admin/website/page.tsx`
- Create: `app/admin/website/hero/page.tsx`
- Create: `app/admin/website/footer/page.tsx`

- [ ] **Step 1: Create redirect page**

```typescript
// app/admin/website/page.tsx
import { redirect } from "next/navigation";

export default function WebsitePage() {
  redirect("/admin/website/hero");
}
```

- [ ] **Step 2: Create hero admin page**

Create `app/admin/website/hero/page.tsx` — a client component with:
- Form fields: badge, title, highlight, subtitle, ctaPrimary, ctaSecondary, ctaLink
- Fetch current data from `/api/admin/website/hero` on mount
- PUT to save changes
- Toast notification on success/error
- Loading state

Follow the same UI pattern as `app/admin/pengaturan/umum/` (form with save button).

- [ ] **Step 3: Create footer admin page**

Create `app/admin/website/footer/page.tsx` — a client component with:
- Form fields: companyName, description, address, email, phone
- JSON editor or structured form for links (produk, perusahaan, akun sections)
- JSON editor for socials
- Fetch/save pattern same as hero

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/website/
git commit -m "feat(website): add hero and footer admin pages"
```

---

## Task 8: Admin Pages — CRUD Pages (Features, Pricing, Testimonial, FAQ)

**Files:**
- Create: `app/admin/website/fitur/page.tsx`
- Create: `app/admin/website/pricing/page.tsx`
- Create: `app/admin/website/testimonial/page.tsx`
- Create: `app/admin/website/faq/page.tsx`

- [ ] **Step 1: Create features admin page**

Create `app/admin/website/fitur/page.tsx` — a client component with:
- Table/list showing all features (title, icon, sortOrder, isActive toggle)
- "Tambah Fitur" button → modal or inline form
- Edit button per row → modal or inline form
- Delete button with confirmation
- Fields: title, description, icon (dropdown of available icons), sortOrder, isActive
- Fetch from `/api/admin/website/features`
- POST/PUT/DELETE operations

- [ ] **Step 2: Create pricing admin page**

Create `app/admin/website/pricing/page.tsx` — same CRUD pattern:
- Table showing pricing tiers (name, price, isPopular, sortOrder, isActive)
- Form fields: name, price, period, description, features (array input), isPopular, ctaText, ctaLink, sortOrder
- Features field: dynamic list where user can add/remove feature strings

- [ ] **Step 3: Create testimonial admin page**

Create `app/admin/website/testimonial/page.tsx` — same CRUD pattern:
- Table showing testimonials (name, role, rating, sortOrder, isActive)
- Form fields: name, role, content (textarea), rating (1-5 select), sortOrder

- [ ] **Step 4: Create FAQ admin page**

Create `app/admin/website/faq/page.tsx` — same CRUD pattern:
- Table showing FAQ items (question preview, sortOrder, isActive)
- Form fields: question, answer (textarea), sortOrder

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add app/admin/website/
git commit -m "feat(website): add CRUD admin pages for features, pricing, testimonial, and FAQ"
```

---

## Task 9: Update SaasLandingPage to Render from DB

**Files:**
- Modify: `components/landing/SaasLandingPage.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update SaasLandingPage to accept props**

Change `SaasLandingPage` from a no-props component to accept landing content as props:

```typescript
// components/landing/SaasLandingPage.tsx
import type { LandingContentAll } from "@/modules/website";

interface SaasLandingPageProps {
  content: LandingContentAll | null;
}

export default function SaasLandingPage({ content }: SaasLandingPageProps) {
  // Use content from props if available, otherwise use hardcoded defaults
  const hero = content?.hero || DEFAULT_HERO;
  const features = content?.features.length ? content.features : DEFAULT_FEATURES;
  const pricing = content?.pricing.length ? content.pricing : DEFAULT_PRICING;
  const testimonials = content?.testimonials.length ? content.testimonials : DEFAULT_TESTIMONIALS;
  const faq = content?.faq.length ? content.faq : DEFAULT_FAQ;
  const footer = content?.footer || DEFAULT_FOOTER;

  // Render using these variables instead of hardcoded values
  // ...
}
```

Extract current hardcoded content into DEFAULT_* constants at the top of the file for fallback.

- [ ] **Step 2: Update app/page.tsx to fetch content**

In `app/page.tsx`, before rendering `SaasLandingPage`, fetch content from the service:

```typescript
import { LandingContentService } from "@/modules/website";

// Inside HomePage, before the SaaS page return:
let landingContent = null;
try {
  const service = new LandingContentService();
  landingContent = await service.getAllContent();
} catch {
  // fallback to null (component will use defaults)
}

return <SaasLandingPage content={landingContent} />;
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add components/landing/SaasLandingPage.tsx app/page.tsx
git commit -m "feat(website): render SaaS landing page from DB content with fallback defaults"
```

---

## Task 10: Update Changelog

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

```markdown
### [2026-05-22] — Website CMS untuk manage konten landing page

- **Tipe**: [ADDED]
- **Scope**: `modules/website`, `app/admin/website/`, `app/api/admin/website/`
- **Author**: agent
- **Deskripsi**: Admin panel baru untuk super admin manage konten SaaS landing page
  (hero, fitur, pricing, testimonial, FAQ, footer). Kategori "Website" ditambahkan
  di sidebar. Landing page sekarang render konten dari database dengan fallback
  ke default hardcoded.
- **Migration**: `20260522120000_add_landing_content_tables`
- **Breaking**: ❌ Tidak
```

- [ ] **Step 2: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): add website CMS entry"
```

---

## Execution Order & Dependencies

```
Task 1 (Schema) → Task 2 (Module) → Task 3 (Sidebar)
                                   → Task 4 (API Hero/Footer)
                                   → Task 5 (API CRUD)
                                   → Task 6 (Public endpoint)
Task 4 + 5 → Task 7 (Admin pages Hero/Footer)
           → Task 8 (Admin pages CRUD)
Task 6 + 9 depend on Task 2
Task 9 (SaasLandingPage update) → after Task 6
Task 10 (Changelog) → last
```

**Critical path:** Task 1 → 2 → 4/5 → 7/8 → 9

**Parallelizable after Task 2:**
- Task 3 (Sidebar) — independent
- Task 4 + Task 5 (API endpoints) — can be parallel
- Task 6 (Public endpoint) — independent after Task 2
