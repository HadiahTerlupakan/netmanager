# Website CMS — Landing Page Content Management

**Date:** 2026-05-22
**Status:** Draft
**Author:** agent

---

## Problem Statement

Konten SaaS landing page RADPRO.ID saat ini hardcoded di komponen. Super admin tidak bisa mengubah konten (hero, fitur, pricing, testimonial, FAQ, footer) tanpa edit kode. Dibutuhkan admin panel untuk manage semua section landing page secara dinamis.

---

## Scope

- Admin panel untuk manage konten landing page RADPRO.ID
- Hanya accessible oleh **super admin**
- Kategori sidebar baru: "Website" (terpisah dari Sistem/Pengaturan)
- SaasLandingPage fetch konten dari DB, fallback ke default jika belum ada data
- Modul baru: `modules/website/`

---

## Database Schema

Semua table **tanpa tenantId** — ini konten global untuk landing page RADPRO.ID.

### LandingHero (single row)

```prisma
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
```

### LandingFeature (multiple rows, sortable)

```prisma
model LandingFeature {
  id          String   @id @default(uuid())
  title       String
  description String
  icon        String
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### LandingPricing (multiple rows, sortable)

```prisma
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
}
```

### LandingTestimonial (multiple rows, sortable)

```prisma
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
}
```

### LandingFaq (multiple rows, sortable)

```prisma
model LandingFaq {
  id        String   @id @default(uuid())
  question  String
  answer    String
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### LandingFooter (single row)

```prisma
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

---

## Module Structure

```
modules/website/
├── domain/
│   └── LandingContent.ts           # Entity types
├── dto/
│   └── landing-content.dto.ts      # Request/response DTOs
├── repositories/
│   └── LandingContentRepository.ts # Data access
├── services/
│   └── LandingContentService.ts    # CRUD business logic
├── validators/
│   └── landing-content.validator.ts # Zod schemas per section
└── index.ts                         # Public API
```

---

## Admin Pages

```
app/admin/website/
├── page.tsx                         # Redirect ke /hero
├── hero/page.tsx                    # Edit hero section (form)
├── fitur/page.tsx                   # CRUD fitur cards (table + form)
├── pricing/page.tsx                 # CRUD pricing tiers (table + form)
├── testimonial/page.tsx             # CRUD testimonials (table + form)
├── faq/page.tsx                     # CRUD FAQ items (table + form)
└── footer/page.tsx                  # Edit footer info (form)
```

### UI Pattern per Section Type

**Single-row sections (Hero, Footer):**
- Form dengan fields yang bisa diedit
- Tombol "Simpan" di bawah
- Preview section (opsional, future)

**Multi-row sections (Fitur, Pricing, Testimonial, FAQ):**
- Table/list view dengan semua items
- Tombol "Tambah" untuk create baru
- Inline edit atau modal untuk update
- Drag-drop atau input sortOrder untuk reorder
- Toggle isActive untuk show/hide tanpa delete
- Tombol delete dengan konfirmasi

---

## API Endpoints

### Admin (Super Admin Only)

```
GET    /api/admin/website/hero              # Get hero data
PUT    /api/admin/website/hero              # Update hero

GET    /api/admin/website/features          # List all features
POST   /api/admin/website/features          # Create feature
PUT    /api/admin/website/features/:id      # Update feature
DELETE /api/admin/website/features/:id      # Delete feature

GET    /api/admin/website/pricing           # List all pricing
POST   /api/admin/website/pricing           # Create pricing tier
PUT    /api/admin/website/pricing/:id       # Update pricing
DELETE /api/admin/website/pricing/:id       # Delete pricing

GET    /api/admin/website/testimonials      # List all testimonials
POST   /api/admin/website/testimonials      # Create testimonial
PUT    /api/admin/website/testimonials/:id  # Update testimonial
DELETE /api/admin/website/testimonials/:id  # Delete testimonial

GET    /api/admin/website/faq              # List all FAQ
POST   /api/admin/website/faq              # Create FAQ item
PUT    /api/admin/website/faq/:id          # Update FAQ
DELETE /api/admin/website/faq/:id          # Delete FAQ

GET    /api/admin/website/footer           # Get footer data
PUT    /api/admin/website/footer           # Update footer
```

### Public (No Auth)

```
GET    /api/public/landing-content         # All landing page content in one call
```

Response structure:
```json
{
  "hero": { ... },
  "features": [ ... ],
  "pricing": [ ... ],
  "testimonials": [ ... ],
  "faq": [ ... ],
  "footer": { ... }
}
```

---

## Sidebar Integration

Tambah kategori "Website" di `lib/menu-config.ts`:

- Section: "Website"
- Position: setelah "Komunikasi", sebelum "Sistem"
- Visibility: super admin only (tambah flag `superAdminOnly: true` atau filter di `adminSidebarMenu.ts`)
- Icon: `MdLanguage` atau `MdWeb`

Sub-items:
```
Website
├── Hero
├── Fitur
├── Pricing
├── Testimonial
├── FAQ
└── Footer
```

---

## SaasLandingPage Update

`components/landing/SaasLandingPage.tsx` diubah:

1. Fetch data dari `/api/public/landing-content` (client-side) atau pass sebagai props dari server component
2. Jika data ada di DB → render dari DB
3. Jika data belum ada (table kosong) → fallback ke konten default hardcoded yang sudah ada sekarang
4. Loading state saat fetch

**Pendekatan:** Server component di `app/page.tsx` fetch data, pass ke SaasLandingPage sebagai props. Ini lebih baik untuk SEO (SSR) dan menghindari loading flash.

---

## Authorization

- Semua `/api/admin/website/*` endpoints: super admin only
- Public endpoint `/api/public/landing-content`: no auth (cached)
- Sidebar menu "Website": hanya tampil untuk super admin
- Admin pages `/admin/website/*`: redirect ke login jika bukan super admin

---

## Caching Strategy

- `/api/public/landing-content` di-cache (revalidate setiap 5 menit atau on-demand)
- Saat super admin update konten → invalidate cache
- Next.js `revalidateTag("landing-content")` atau `revalidatePath("/")`

---

## Out of Scope

- Image upload untuk testimonial avatar atau hero background
- Live preview saat editing
- Version history / rollback konten
- A/B testing konten
- Multi-language support
- Drag-drop reorder UI (pakai input sortOrder dulu)

---

## Risks & Assumptions

- **Asumsi:** Super admin akan seed data awal setelah deploy (atau kita buat seed script)
- **Asumsi:** Fallback ke hardcoded content cukup untuk transisi
- **Risk:** Jika DB kosong dan fallback gagal, landing page bisa blank — mitigasi: hardcoded defaults di komponen
