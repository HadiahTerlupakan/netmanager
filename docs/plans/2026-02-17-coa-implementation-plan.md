# COA Improvement & Dark Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Visual and functional overhaul of the Chart of Accounts (COA) to improve usability, clarity, and Dark Mode support.

**Architecture:** Client-side React components for the new Tabbed UI, supported by existing Prisma schema fields (`isHeader`, `allowPosting`) and updated Zod validations.

**Tech Stack:** Next.js, React, Tailwind CSS, Prisma, Zod.

---

### Task 1: Data Migration Script

**Goal:** Populate `isHeader` and `allowPosting` fields for existing accounts based on their hierarchy.

**Files:**
- Create: `scripts/migrate-coa-fields.ts`

**Step 1: Create migration script**

```typescript
// scripts/migrate-coa-fields.ts
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Starting COA migration...");

  // 1. Reset all to leaf node state first
  await prisma.chartOfAccount.updateMany({
    data: {
      isHeader: false,
      allowPosting: true,
    },
  });

  // 2. Find all accounts that are parents (have children)
  const parentAccounts = await prisma.chartOfAccount.findMany({
    where: {
      children: {
        some: {},
      },
    },
  });

  // 3. Update parents to be headers
  for (const account of parentAccounts) {
    await prisma.chartOfAccount.update({
      where: { id: account.id },
      data: {
        isHeader: true,
        allowPosting: false,
      },
    });
    console.log(`Updated ${account.code} - ${account.name} as Header`);
  }

  console.log("Migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Run migration**

Run: `npx tsx scripts/migrate-coa-fields.ts`
Expected: Output showing updated accounts.

**Step 3: Commit**

```bash
git add scripts/migrate-coa-fields.ts
git commit -m "chore: add coa migration script"
```

---

### Task 2: Update Zod Validation Schema

**Goal:** Enforce new rules: Headers cannot be posted to, Transactions must have `allowPosting: true`.

**Files:**
- Modify: `lib/validations/coa.ts`

**Step 1: Update schema**

```typescript
// lib/validations/coa.ts
import { z } from "zod";

export const createCoaSchema = z.object({
  code: z.string().min(1, "Kode akun wajib diisi"),
  name: z.string().min(1, "Nama akun wajib diisi"),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  subType: z.string().optional(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  parentId: z.string().optional().nullable(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  // New fields
  isHeader: z.boolean().default(false),
  allowPosting: z.boolean().default(true),
}).refine((data) => {
  // If it's a header, it cannot allow posting
  if (data.isHeader && data.allowPosting) {
    return false;
  }
  return true;
}, {
  message: "Akun Header tidak boleh digunakan untuk transaksi (posting)",
  path: ["allowPosting"],
});

export const updateCoaSchema = createCoaSchema.partial();
export type CreateCoaInput = z.infer<typeof createCoaSchema>;
export type UpdateCoaInput = z.infer<typeof updateCoaSchema>;
```

**Step 2: Commit**

```bash
git add lib/validations/coa.ts
git commit -m "feat: update coa validation schema"
```

---

### Task 3: Implement COA Tabs & Header UI

**Goal:** Refactor `COAManager.tsx` to use tabs and new visual hierarchy.

**Files:**
- Modify: `app/admin/finance/coa/COAManager.tsx`

**Step 1: Update COAManager Component Structure**

Replace the entire `COAManager.tsx` content with the new Tabbed design.

Key changes to implement:
1.  Add `activeTab` state (`'ASSET' | 'LIABILITY' | ...`).
2.  Filter `accountTree` based on `activeTab`.
3.  Render Tabs navigation at the top.
4.  Update `renderAccountTree` to use new icons (Folder vs File) and styles.
5.  Apply Dark Mode classes (`dark:bg-gray-800`, `dark:text-gray-100`).

*(Note: Implementation detail is large, will be handled by subagent reading the design doc)*

**Step 2: Verify UI**

Run: `npm run dev`
Check: http://localhost:3000/admin/finance/coa
Expected: Tabs visible, switching tabs works, Dark Mode looks correct.

**Step 3: Commit**

```bash
git add app/admin/finance/coa/COAManager.tsx
git commit -m "feat: implement tabbed coa ui with dark mode"
```

---

### Task 4: Add Smart Account Creation

**Goal:** When clicking "Add" on a parent, auto-fill details and suggest next code.

**Files:**
- Modify: `app/admin/finance/coa/COAManager.tsx` (or extract to `useCoaLogic.ts` hook if complex)

**Step 1: Implement `getNextCode` logic**

```typescript
const getNextCode = (parentCode: string, siblings: ChartOfAccount[]) => {
  // Logic to find max code among siblings and increment
  // e.g. parent 1100, siblings [1101, 1102] -> returns 1103
};
```

**Step 2: Update `openCreateModal`**

Call `getNextCode` when opening modal with a parent.

**Step 3: Commit**

```bash
git add app/admin/finance/coa/COAManager.tsx
git commit -m "feat: add smart coa code suggestion"
```
