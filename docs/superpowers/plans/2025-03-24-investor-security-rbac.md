# Investor Security & RBAC Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghapus penyimpanan password plaintext, memisahkan izin akses investor dari izin user umum, dan menambahkan validasi input menggunakan Zod.

**Architecture:** Mengikuti pola Modular Monolith dengan prisma sebagai ORM dan Zod untuk validasi skema API. Menggunakan sistem RBAC yang sudah ada namun dengan resource yang lebih spesifik (`investors`).

**Tech Stack:** Next.js, Prisma, Zod, Bcryptjs, TypeScript.

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Hapus field password dari model Investor**
Edit `prisma/schema.prisma` dan hapus baris `password String` (sekitar baris 339).

- [ ] **Step 2: Jalankan migrasi prisma**
Run: `npx prisma generate` (karena kita akan migrate manual/cek nanti, pastikan client terupdate).
Note: Untuk production sesungguhnya perlu `npx prisma migrate dev`, tapi di sini kita update skema dulu.

---

### Task 2: Define Zod Schemas for Investor

**Files:**
- Create: `lib/validations/investor.ts`

- [ ] **Step 1: Buat schema validation**
```typescript
import { z } from 'zod'

export const investorSchema = z.object({
    username: z.string().min(3).max(50).toLowerCase().transform(s => s.replace(/\s/g, '')),
    password: z.string().min(6).optional().or(z.literal('')),
    namaLengkap: z.string().min(3),
    perusahaan: z.string().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal('')),
    noTelp: z.string().optional().nullable().or(z.literal('')),
})

export const investorPayoutSchema = z.object({
    amount: z.coerce.number().positive(),
    date: z.string().optional(),
    bankName: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    accountName: z.string().optional().nullable(),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).default('COMPLETED')
})
```

- [ ] **Step 2: Verifikasi tipe data**
Pastikan tidak ada error import.

---

### Task 3: Refactor Admin Investor API (Main Route)

**Files:**
- Modify: `app/api/admin/investors/route.ts`

- [ ] **Step 1: Update GET permission dan remove password**
Ganti `permissions: ['users:read']` menjadi `permissions: ['investors:read']`.
Pastikan tidak ada query ke field `password`.

- [ ] **Step 2: Update POST dengan Zod dan remove plaintext save**
```typescript
// ... imports
import { investorSchema } from '@/lib/validations/investor'

export const POST = createHandler({ 
    auth: true, 
    permissions: ['investors:create'] 
}, async (req, ctx) => {
    const body = await req.json()
    const result = investorSchema.safeParse(body)
    
    if (!result.success) {
        return ApiErrors.badRequest('Validasi gagal', { errors: result.error.format() })
    }

    const { username, password, namaLengkap, perusahaan, noTelp, email } = result.data

    if (!password) return ApiErrors.badRequest('Password wajib diisi untuk investor baru')

    const existingUser = await prisma.investor.findUnique({ where: { username } })
    if (existingUser) return ApiErrors.badRequest('Username sudah digunakan')

    const passwordHash = await hash(password, 12)

    const investor = await prisma.investor.create({
        data: {
            username,
            passwordHash,
            namaLengkap,
            perusahaan,
            noTelp,
            email,
            isActive: true
        }
    })
    // ... rest of code (safeInvestor return)
})
```

---

### Task 4: Refactor Admin Investor API (Individual & Detail Routes)

**Files:**
- Modify: `app/api/admin/investors/[id]/route.ts`
- Modify: `app/api/admin/investors/[id]/detail/route.ts`
- Modify: `app/api/admin/investors/[id]/payouts/route.ts`

- [ ] **Step 1: Update Permissions**
Ganti semua `users:read` -> `investors:read`, `users:update` -> `investors:update`, `users:delete` -> `investors:delete`, `users:create` -> `investors:create`.

- [ ] **Step 2: Update PUT logic di [id]/route.ts**
Gunakan `investorSchema.partial().safeParse(body)` dan hapus update field `password`.

---

### Task 5: Security Fix - Login Fallback Removal

**Files:**
- Modify: `app/api/investor/auth/login/route.ts`

- [ ] **Step 1: Hapus legacy plaintext comparison**
Hapus blok `else { ... isValid = investor.password === password }`. Pastikan hanya `passwordHash` yang divalidasi.

---

### Task 6: Frontend Permission Update

**Files:**
- Modify: `app/admin/investors/page.tsx`
- Modify: `app/admin/investors/InvestorsClient.tsx`

- [ ] **Step 1: Update page.tsx permission check**
Ganti `await ensurePermission('users:read')` menjadi `await ensurePermission('investors:read')`.

- [ ] **Step 2: Update InvestorsClient.tsx permission hooks**
Ganti `hasPermission('users:create')` menjadi `hasPermission('investors:create')`, dsb.

---

### Task 7: Verification & Linting

- [ ] **Step 1: Run Type Check**
Run: `npx tsc --noEmit`
Expected: No errors in modified files.

- [ ] **Step 2: Run Lint**
Run: `npx eslint app/admin/investors/ app/api/admin/investors/`
Expected: No errors.

- [ ] **Step 3: Test Login (Manual/Reproduction Script)**
Verifikasi investor masih bisa login dengan passwordHash.
