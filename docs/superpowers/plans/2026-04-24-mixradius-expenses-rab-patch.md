# MixRadius Expenses RAB Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki mismatch kalkulasi detail RAB dan race pada approval RAB utama sambil memecah shared type/helper agar `RABView.tsx` dan `RABList.tsx` lebih fokus.

**Architecture:** Shared concern dipindah dari `RABList.tsx` ke helper murni terpisah: satu file untuk shared type + kalkulasi BEP/subscriber, satu file untuk dataset tracking bulanan. `RABView` dan export di `RABList` wajib memakai dataset tracking yang sama agar tabel, total akumulasi, ringkasan investor/perusahaan, CSV, dan PDF selalu konsisten. Route approval utama dihardening dengan flow create-then-count dalam transaction yang sama memakai count DB terbaru, bukan `rab.approvals.length + 1`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, NextAuth, Vitest, jsPDF, Tailwind CSS.

---

## File Structure

### Create
- `app/admin/integrations/mixradius/expenses/rabTypes.ts` — shared type `RABProject`, growth settings, actual achievement, approval, item, disbursement.
- `app/admin/integrations/mixradius/expenses/rabCalculations.ts` — `calculateMonthlySubscribers()` dan `calculateRealisticBEP()`.
- `app/admin/integrations/mixradius/expenses/rabTracking.ts` — helper dataset tracking bulanan + total summary investor/perusahaan.
- `app/admin/integrations/mixradius/expenses/RABTrackingSection.tsx` — render tabel tracking + total akumulasi + summary bawah dari dataset helper.
- `tests/ui/rab-tracking-calculations.test.ts` — unit test untuk helper kalkulasi tracking dan helper BEP/shared calculator.
- `tests/api/integrations/mixradius/rab-approve-route.test.ts` — regression test route approval RAB utama.

### Modify
- `app/admin/integrations/mixradius/expenses/RABList.tsx` — impor type/helper shared, hapus export type/helper dari file ini, pakai helper tracking untuk CSV/PDF.
- `app/admin/integrations/mixradius/expenses/RABView.tsx` — pakai `buildRabTrackingDataset()` dan pindahkan area tracking ke `RABTrackingSection`.
- `app/admin/integrations/mixradius/expenses/RABCompare.tsx` — ganti impor type/helper dari `RABList` ke file shared.
- `app/admin/integrations/mixradius/expenses/RABForm.tsx` — ganti impor `RABProject` ke file shared.
- `app/admin/integrations/mixradius/expenses/ExpensesClient.tsx` — ganti impor `RABProject` ke file shared.
- `app/api/integrations/mixradius/expenses/rab/[id]/approve/route.ts` — hitung status approval dari count DB terbaru di transaction yang sama.

### Verify existing behavior remains unchanged
- `app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/approve/route.ts` — tetap jadi referensi flow revision approval yang aman.
- `tests/api/integrations/mixradius/rab-revision-approve-route.test.ts` — tetap pass sebagai regression guard.

## Task 1: Ekstrak shared type dan helper dasar dari RABList

**Files:**
- Create: `app/admin/integrations/mixradius/expenses/rabTypes.ts`
- Create: `app/admin/integrations/mixradius/expenses/rabCalculations.ts`
- Modify: `app/admin/integrations/mixradius/expenses/RABList.tsx`
- Modify: `app/admin/integrations/mixradius/expenses/RABCompare.tsx`
- Modify: `app/admin/integrations/mixradius/expenses/RABForm.tsx`
- Modify: `app/admin/integrations/mixradius/expenses/ExpensesClient.tsx`
- Modify: `app/admin/integrations/mixradius/expenses/RABView.tsx`
- Test: `tests/ui/rab-tracking-calculations.test.ts`

- [ ] **Step 1: Write the failing helper import test**

```ts
import { describe, expect, it } from 'vitest'

import {
  calculateMonthlySubscribers,
  calculateRealisticBEP,
} from '@/app/admin/integrations/mixradius/expenses/rabCalculations'
import type { RABProject } from '@/app/admin/integrations/mixradius/expenses/rabTypes'

const project: RABProject = {
  id: 'rab-1',
  name: 'Site Alpha',
  projectedRevenue: 10_000_000,
  projectedOpex: 2_000_000,
  targetSubscribers: 100,
  arpu: 100_000,
  growthType: 'LINEAR',
  paymentType: 'PREPAID',
  growthSettings: { subscribersPerMonth: 25 },
  actualAchievements: [],
  investmentDurationMonths: 12,
  investmentRecoveryType: 'PERCENTAGE',
  investmentRecoveryValue: 50,
  investorProfitSharePercent: 50,
  contingencyPercent: 0,
  contingencyAmount: 0,
  nplTolerancePercent: 10,
  status: 'DRAFT',
  items: [
    {
      id: 'item-1',
      name: 'Tiang',
      quantity: 1,
      unitPrice: 12_000_000,
      totalPrice: 12_000_000,
      expenseType: 'CAPEX',
    },
  ],
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
}

describe('rab shared calculations', () => {
  it('calculates monthly subscribers from the shared helper', () => {
    expect(calculateMonthlySubscribers(100, 'LINEAR', { subscribersPerMonth: 25 }, 4)).toEqual([
      25,
      50,
      75,
      100,
    ])
  })

  it('calculates realistic BEP with NPL-aware full revenue', () => {
    const result = calculateRealisticBEP(project)

    expect(result.simpleBep).toBeGreaterThan(0)
    expect(result.monthsToFullCapacity).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts`
Expected: FAIL karena `rabTypes.ts` dan `rabCalculations.ts` belum ada.

- [ ] **Step 3: Create the shared type file**

```ts
export interface RABItem {
  id: string
  name: string
  category?: string
  expenseCategory?: { name: string; parent?: { name: string } }
  quantity: number
  unitPrice: number
  totalPrice: number
  expenseType?: 'CAPEX' | 'OPEX'
  wbsGroupId?: string
  disbursements?: RABDisbursement[]
}

export interface RABDisbursement {
  id: string
  name: string
  percentage: number
  amount: number
  estimatedDate?: string
  isPaid: boolean
}

export interface LinearGrowthSettings {
  subscribersPerMonth: number
}

export interface PercentageGrowthSettings {
  initialPercent: number
  monthlyGrowthPercent: number
}

export interface CustomMilestone {
  month: number
  percent: number
}

export interface CustomGrowthSettings {
  milestones: CustomMilestone[]
}

export type GrowthSettings =
  | LinearGrowthSettings
  | PercentageGrowthSettings
  | CustomGrowthSettings

export interface RABActualAchievement {
  id: string
  month: number
  actualSubscribers: number
  actualRevenue: number
  manualRecoveryInstallment?: number | null
  manualInvestorShare?: number | null
  manualCompanyShare?: number | null
  manualInvestorProfitSharePercent?: number | null
  notes?: string
}

export interface RABApproval {
  id: string
  rabProjectId: string
  userId: string
  status: string
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    role: {
      name: string
    } | null
  }
}

export interface RABWbs {
  id: string
  name: string
  order: number
}

export interface RABProject {
  id: string
  name: string
  description?: string
  siteId?: string
  mixRadiusGroupId?: string
  mixRadiusInvestorSiteId?: string
  site?: { name: string }
  mixRadiusGroup?: { name: string }
  mixRadiusInvestorSite?: { name: string }
  projectedRevenue: number
  projectedOpex: number
  targetSubscribers?: number
  arpu?: number
  growthType?: 'LINEAR' | 'PERCENTAGE' | 'CUSTOM'
  paymentType?: 'PREPAID' | 'POSTPAID'
  growthSettings?: GrowthSettings
  actualAchievements?: RABActualAchievement[]
  startDate?: string
  investmentDurationMonths?: number
  investmentRecoveryType?: 'PERCENTAGE' | 'FIXED'
  investmentRecoveryValue?: number
  investorProfitSharePercent?: number
  contingencyPercent?: number
  contingencyAmount?: string | number
  nplTolerancePercent?: number
  hasDisbursementPlan?: boolean
  wbsGroups?: RABWbs[]
  disbursements?: RABDisbursement[]
  status: string
  items: RABItem[]
  approvals?: RABApproval[]
  finalApprovedRevisionId?: string | null
  revisionCount?: number
  latestRevision?: {
    id: string
    revisionNumber: number
    status: string
  } | null
  revisionProfitLossSummary?: {
    netVariance: string
    netLabel: import('./rabRevisionTypes').RABRevisionVarianceLabel
  } | null
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 4: Create the shared calculation file and update imports**

```ts
import type {
  GrowthSettings,
  LinearGrowthSettings,
  PercentageGrowthSettings,
  CustomGrowthSettings,
  RABProject,
} from './rabTypes'

export function calculateMonthlySubscribers(
  targetSubscribers: number,
  growthType: string,
  growthSettings: GrowthSettings | null,
  months: number,
): number[] {
  const result: number[] = []

  if (!growthSettings) {
    return Array(months).fill(0)
  }

  for (let month = 1; month <= months; month += 1) {
    let subscribers = 0

    if (growthType === 'LINEAR') {
      const settings = growthSettings as LinearGrowthSettings
      subscribers = Math.min(settings.subscribersPerMonth * month, targetSubscribers)
    } else if (growthType === 'PERCENTAGE') {
      const settings = growthSettings as PercentageGrowthSettings
      const initialSubscribers = (settings.initialPercent / 100) * targetSubscribers
      subscribers =
        month === 1
          ? initialSubscribers
          : Math.min(
              initialSubscribers + (settings.monthlyGrowthPercent / 100) * targetSubscribers * (month - 1),
              targetSubscribers,
            )
    } else {
      const settings = growthSettings as CustomGrowthSettings
      const milestones = [...settings.milestones].sort((a, b) => a.month - b.month)
      let previous = { month: 0, percent: 0 }
      let next = milestones[milestones.length - 1] || { month: 1, percent: 100 }

      for (const milestone of milestones) {
        if (milestone.month <= month) previous = milestone
        if (milestone.month >= month && milestone.month < next.month) next = milestone
      }

      if (previous.month === month) {
        subscribers = (previous.percent / 100) * targetSubscribers
      } else if (next.month === month) {
        subscribers = (next.percent / 100) * targetSubscribers
      } else {
        const range = next.month - previous.month
        const progress = range > 0 ? (month - previous.month) / range : 0
        const percentAtMonth = previous.percent + (next.percent - previous.percent) * progress
        subscribers = (percentAtMonth / 100) * targetSubscribers
      }
    }

    result.push(Math.round(subscribers))
  }

  return result
}

export function calculateRealisticBEP(project: RABProject) {
  const totalCapex = project.items
    .filter((item) => !item.expenseType || item.expenseType === 'CAPEX')
    .reduce((sum, item) => sum + Number(item.totalPrice), 0)
  const monthlyOpex = Number(project.projectedOpex)
  const arpu = Number(project.arpu) || 0
  const targetSubscribers = project.targetSubscribers || 0
  const growthType = project.growthType || 'LINEAR'
  const paymentType = project.paymentType || 'PREPAID'
  const growthSettings = project.growthSettings || null
  const nplTolerancePercent = project.nplTolerancePercent || 0
  const grossRevenue = Number(project.projectedRevenue)
  const fullRevenue = grossRevenue * (1 - nplTolerancePercent / 100)
  const simpleProfit = fullRevenue - monthlyOpex

  let simpleBep = Infinity
  if (simpleProfit > 0) {
    simpleBep = paymentType === 'POSTPAID' ? (totalCapex + fullRevenue) / simpleProfit : totalCapex / simpleProfit
  }

  if (!targetSubscribers || !arpu || !growthSettings) {
    return { bepMonth: Infinity, simpleBep, monthsToFullCapacity: 0, roiPerYear: 0 }
  }

  const monthlySubsTargets = calculateMonthlySubscribers(targetSubscribers, growthType, growthSettings, 120)

  let cumulativeProfit = 0
  let bepMonth = Infinity
  let monthsToFullCapacity = 0
  let previousMonthSubscribers = 0

  for (let month = 1; month <= 120; month += 1) {
    const subscribers = monthlySubsTargets[month - 1] || 0
    const billedSubscribers = paymentType === 'POSTPAID' ? previousMonthSubscribers : subscribers
    const grossTargetRevenue = billedSubscribers * arpu
    const revenue = grossTargetRevenue * (1 - nplTolerancePercent / 100)
    const profit = revenue - monthlyOpex
    cumulativeProfit += profit

    if (cumulativeProfit >= totalCapex && bepMonth === Infinity) {
      bepMonth = month
    }

    if (subscribers >= targetSubscribers && monthsToFullCapacity === 0) {
      monthsToFullCapacity = month
    }

    previousMonthSubscribers = subscribers
  }

  return {
    bepMonth,
    simpleBep,
    monthsToFullCapacity,
    roiPerYear: totalCapex > 0 && simpleProfit > 0 ? (simpleProfit * 12 * 100) / totalCapex : 0,
  }
}
```

```ts
// contoh perubahan import
import type { RABProject } from './rabTypes'
import {
  calculateMonthlySubscribers,
  calculateRealisticBEP,
} from './rabCalculations'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts`
Expected: PASS untuk 2 test helper shared.

- [ ] **Step 6: Commit**

```bash
git add app/admin/integrations/mixradius/expenses/rabTypes.ts app/admin/integrations/mixradius/expenses/rabCalculations.ts app/admin/integrations/mixradius/expenses/RABList.tsx app/admin/integrations/mixradius/expenses/RABCompare.tsx app/admin/integrations/mixradius/expenses/RABForm.tsx app/admin/integrations/mixradius/expenses/ExpensesClient.tsx app/admin/integrations/mixradius/expenses/RABView.tsx tests/ui/rab-tracking-calculations.test.ts
git commit -m "refactor: extract shared rab calculations"
```

## Task 2: Tambahkan helper tracking tunggal untuk detail dan summary RAB

**Files:**
- Create: `app/admin/integrations/mixradius/expenses/rabTracking.ts`
- Modify: `tests/ui/rab-tracking-calculations.test.ts`

- [ ] **Step 1: Extend the helper test with tracking dataset regression cases**

```ts
import { buildRabTrackingDataset } from '@/app/admin/integrations/mixradius/expenses/rabTracking'

it('uses NPL-adjusted projected revenue for projected months', () => {
  const result = buildRabTrackingDataset(project)

  expect(result.rows[0]).toMatchObject({
    month: 1,
    projectedRevenue: 2_250_000,
    revenue: 2_250_000,
    nplAmount: 250_000,
  })
})

it('keeps the summary totals equal to the sum of tracking rows', () => {
  const result = buildRabTrackingDataset(project)

  const investorShareTotal = result.rows.reduce((sum, row) => sum + row.investorShare, 0)
  const companyShareTotal = result.rows.reduce((sum, row) => sum + row.companyShare, 0)
  const recoveryTotal = result.rows.reduce((sum, row) => sum + row.recoveryInstallment, 0)

  expect(result.totals.investorShare).toBe(investorShareTotal)
  expect(result.totals.companyShare).toBe(companyShareTotal)
  expect(result.summary.totalInvestorReceipts).toBe(recoveryTotal + investorShareTotal)
  expect(result.summary.totalCompanyReceipts).toBe(companyShareTotal)
})

it('prioritizes manual overrides over calculated recovery and profit share', () => {
  const result = buildRabTrackingDataset({
    ...project,
    actualAchievements: [
      {
        id: 'actual-1',
        month: 1,
        actualSubscribers: 25,
        actualRevenue: 2_100_000,
        manualRecoveryInstallment: 300_000,
        manualInvestorShare: 150_000,
        manualCompanyShare: 50_000,
        manualInvestorProfitSharePercent: 75,
      },
    ],
  })

  expect(result.rows[0]).toMatchObject({
    recoveryInstallment: 300_000,
    investorShare: 150_000,
    companyShare: 50_000,
    investorProfitSharePercent: 75,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts`
Expected: FAIL karena `buildRabTrackingDataset()` belum ada.

- [ ] **Step 3: Implement the shared tracking dataset helper**

```ts
import { calculateMonthlySubscribers } from './rabCalculations'
import type { RABActualAchievement, RABProject } from './rabTypes'

export interface RabTrackingRow {
  month: number
  targetSubscribers: number
  billedSubscribers: number
  projectedRevenue: number
  revenue: number
  nplAmount: number
  grossProfit: number
  recoveryInstallment: number
  remainingInvestment: number
  investorProfitSharePercent: number
  investorShare: number
  companyShare: number
  actualRecord: RABActualAchievement | undefined
  isProjected: boolean
}

export interface RabTrackingDataset {
  rows: RabTrackingRow[]
  totals: {
    revenue: number
    npl: number
    grossProfit: number
    recoveryInstallment: number
    investorShare: number
    companyShare: number
    remainingInvestment: number
  }
  summary: {
    totalInvestorReceipts: number
    totalCompanyReceipts: number
  }
}

export function buildRabTrackingDataset(project: RABProject): RabTrackingDataset {
  const totalCapex = project.items
    .filter((item) => !item.expenseType || item.expenseType === 'CAPEX')
    .reduce((sum, item) => sum + Number(item.totalPrice), 0)
  const totalOpex = Number(project.projectedOpex || 0)
  const arpu = Number(project.arpu || 0)
  const durationMonths = project.investmentDurationMonths || 12
  const recoveryType = project.investmentRecoveryType || 'PERCENTAGE'
  const recoveryValue = project.investmentRecoveryValue || 0
  const investorProfitSharePercent = project.investorProfitSharePercent || 50
  const nplTolerancePercent = project.nplTolerancePercent || 0
  const actuals = project.actualAchievements || []
  const monthlyTargets = calculateMonthlySubscribers(
    project.targetSubscribers || 0,
    project.growthType || 'LINEAR',
    project.growthSettings || null,
    durationMonths,
  )

  let remainingInvestment = totalCapex

  const rows = Array.from({ length: durationMonths }, (_, index) => {
    const month = index + 1
    const targetSubscribers = monthlyTargets[index] || 0
    const billedSubscribers =
      project.paymentType === 'POSTPAID' ? monthlyTargets[index - 1] || 0 : targetSubscribers
    const grossTargetRevenue = billedSubscribers * arpu
    const projectedRevenue = grossTargetRevenue * (1 - nplTolerancePercent / 100)
    const actualRecord = actuals.find((item) => item.month === month)
    const revenue = actualRecord ? Number(actualRecord.actualRevenue) : projectedRevenue
    const grossProfit = revenue - totalOpex

    let recoveryInstallment = 0
    if (actualRecord?.manualRecoveryInstallment !== undefined && actualRecord.manualRecoveryInstallment !== null) {
      recoveryInstallment = Number(actualRecord.manualRecoveryInstallment)
    } else if (remainingInvestment > 0 && grossProfit > 0) {
      recoveryInstallment =
        recoveryType === 'PERCENTAGE' ? (recoveryValue / 100) * grossProfit : recoveryValue
      recoveryInstallment = Math.min(recoveryInstallment, remainingInvestment, grossProfit)
    }

    remainingInvestment -= recoveryInstallment
    const netProfit = Math.max(0, grossProfit - recoveryInstallment)
    const currentInvestorPercent =
      actualRecord?.manualInvestorProfitSharePercent ?? investorProfitSharePercent
    const investorShare =
      actualRecord?.manualInvestorShare !== undefined && actualRecord.manualInvestorShare !== null
        ? Number(actualRecord.manualInvestorShare)
        : (currentInvestorPercent / 100) * netProfit
    const companyShare =
      actualRecord?.manualCompanyShare !== undefined && actualRecord.manualCompanyShare !== null
        ? Number(actualRecord.manualCompanyShare)
        : netProfit - investorShare

    return {
      month,
      targetSubscribers,
      billedSubscribers,
      projectedRevenue,
      revenue,
      nplAmount: grossTargetRevenue - projectedRevenue,
      grossProfit,
      recoveryInstallment,
      remainingInvestment: Math.max(0, remainingInvestment),
      investorProfitSharePercent: Number(currentInvestorPercent),
      investorShare,
      companyShare,
      actualRecord,
      isProjected: !actualRecord,
    }
  })

  const totals = rows.reduce(
    (accumulator, row) => ({
      revenue: accumulator.revenue + row.revenue,
      npl: accumulator.npl + row.nplAmount,
      grossProfit: accumulator.grossProfit + row.grossProfit,
      recoveryInstallment: accumulator.recoveryInstallment + row.recoveryInstallment,
      investorShare: accumulator.investorShare + row.investorShare,
      companyShare: accumulator.companyShare + row.companyShare,
      remainingInvestment: row.remainingInvestment,
    }),
    {
      revenue: 0,
      npl: 0,
      grossProfit: 0,
      recoveryInstallment: 0,
      investorShare: 0,
      companyShare: 0,
      remainingInvestment: totalCapex,
    },
  )

  return {
    rows,
    totals,
    summary: {
      totalInvestorReceipts: totals.recoveryInstallment + totals.investorShare,
      totalCompanyReceipts: totals.companyShare,
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts`
Expected: PASS untuk semua regression case helper tracking.

- [ ] **Step 5: Commit**

```bash
git add app/admin/integrations/mixradius/expenses/rabTracking.ts tests/ui/rab-tracking-calculations.test.ts
git commit -m "fix: centralize rab tracking calculations"
```

## Task 3: Harden route approval RAB utama dengan live count dari database

**Files:**
- Modify: `app/api/integrations/mixradius/expenses/rab/[id]/approve/route.ts`
- Create: `tests/api/integrations/mixradius/rab-approve-route.test.ts`

- [ ] **Step 1: Write the failing approval route regression test**

```ts
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prismaMock } from '@/tests/setup'

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/modules/database', () => ({
  prisma: prismaMock,
}))

import { POST as APPROVE } from '@/app/api/integrations/mixradius/expenses/rab/[id]/approve/route'

describe('rab approve route', () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'approver-1' } })
    prismaMock.$transaction.mockImplementation(
      async <T>(callback: (tx: typeof prismaMock) => Promise<T>) => callback(prismaMock),
    )
  })

  it('moves draft rab to pending approval on first approval', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'approver-1',
      role: { canApproveRab: true, name: 'Finance', isSuperAdmin: false },
    })
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: 'rab-1',
      status: 'DRAFT',
      approvals: [],
    })
    prismaMock.rabApproval.count.mockResolvedValue(1)
    prismaMock.rabProject.update.mockResolvedValue({ id: 'rab-1', status: 'PENDING_APPROVAL', approvals: [] })

    const response = await APPROVE(new NextRequest('http://localhost/api/rab/approve', { method: 'POST' }), {
      params: Promise.resolve({ id: 'rab-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.rabApproval.create).toHaveBeenCalled()
    expect(prismaMock.rabApproval.count).toHaveBeenCalledWith({
      where: { rabProjectId: 'rab-1', status: 'APPROVED' },
    })
    expect(body.data.status).toBe('PENDING_APPROVAL')
  })

  it('uses the latest database count to fully approve the rab', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'approver-1',
      role: { canApproveRab: true, name: 'Finance', isSuperAdmin: false },
    })
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: 'rab-1',
      status: 'PENDING_APPROVAL',
      approvals: [{ userId: 'approver-2' }],
    })
    prismaMock.rabApproval.count.mockResolvedValue(2)
    prismaMock.rabProject.update.mockResolvedValue({ id: 'rab-1', status: 'APPROVED', approvals: [] })

    const response = await APPROVE(new NextRequest('http://localhost/api/rab/approve', { method: 'POST' }), {
      params: Promise.resolve({ id: 'rab-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toContain('disetujui seutuhnya')
    expect(body.data.status).toBe('APPROVED')
  })

  it('rejects duplicate approval from the same user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'approver-1',
      role: { canApproveRab: true, name: 'Finance', isSuperAdmin: false },
    })
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: 'rab-1',
      status: 'PENDING_APPROVAL',
      approvals: [{ userId: 'approver-1' }],
    })

    const response = await APPROVE(new NextRequest('http://localhost/api/rab/approve', { method: 'POST' }), {
      params: Promise.resolve({ id: 'rab-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('sudah menyetujui')
    expect(prismaMock.rabApproval.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/api/integrations/mixradius/rab-approve-route.test.ts`
Expected: FAIL karena route masih memakai `rab.approvals.length + 1`.

- [ ] **Step 3: Update the main approval route to use live count in one transaction**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/modules/database'

const REQUIRED_RAB_APPROVALS = 2

function resolveRabStatus(currentStatus: string, approvedCount: number) {
  if (approvedCount >= REQUIRED_RAB_APPROVALS) {
    return 'APPROVED'
  }

  if (currentStatus === 'DRAFT') {
    return 'PENDING_APPROVAL'
  }

  return currentStatus
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    })

    const isSuperAdmin =
      user?.role?.isSuperAdmin ||
      user?.role?.name === 'SUPER_ADMIN' ||
      user?.role?.name === 'Super Admin'

    if (!user?.role?.canApproveRab && !isSuperAdmin) {
      return NextResponse.json(
        {
          error:
            'Dilarang: Akun Anda tidak memiliki hak akses (role: canApproveRab) untuk menyetujui dokumen ini.',
        },
        { status: 403 },
      )
    }

    const rab = await prisma.rabProject.findUnique({
      where: { id: resolvedParams.id },
      include: { approvals: true },
    })

    if (!rab) {
      return NextResponse.json({ error: 'RAB tidak ditemukan' }, { status: 404 })
    }

    if (['APPROVED', 'COMPLETED', 'CANCELLED'].includes(rab.status)) {
      return NextResponse.json(
        { error: `RAB sudah berstatus ${rab.status} dan tidak bisa disetujui lagi.` },
        { status: 400 },
      )
    }

    if (rab.approvals.some((approval: { userId: string }) => approval.userId === session.user.id)) {
      return NextResponse.json({ error: 'Anda sudah menyetujui RAB ini sebelumnya.' }, { status: 400 })
    }

    const updatedRab = await prisma.$transaction(async (tx) => {
      await tx.rabApproval.create({
        data: {
          rabProjectId: resolvedParams.id,
          userId: session.user.id,
          status: 'APPROVED',
        },
      })

      const approvedCount = await tx.rabApproval.count({
        where: { rabProjectId: resolvedParams.id, status: 'APPROVED' },
      })

      return tx.rabProject.update({
        where: { id: resolvedParams.id },
        data: { status: resolveRabStatus(rab.status, approvedCount) },
        include: {
          approvals: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: { select: { name: true } },
                },
              },
            },
          },
        },
      })
    })

    const approvedCount = updatedRab.approvals.filter((approval) => approval.status === 'APPROVED').length

    return NextResponse.json({
      success: true,
      message:
        approvedCount >= REQUIRED_RAB_APPROVALS
          ? 'RAB Berhasil disetujui seutuhnya.'
          : 'Persetujuan dicatat (Menunggu 1 Persetujuan lagi).',
      data: updatedRab,
    })
  } catch (error) {
    console.error('Error approving RAB:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal saat memproses persetujuan.' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/api/integrations/mixradius/rab-approve-route.test.ts`
Expected: PASS untuk first approval, live recount approval, dan duplicate approval.

- [ ] **Step 5: Commit**

```bash
git add app/api/integrations/mixradius/expenses/rab/[id]/approve/route.ts tests/api/integrations/mixradius/rab-approve-route.test.ts
git commit -m "fix: harden main rab approval flow"
```

## Task 4: Pakai helper tracking tunggal di RABView dan pecah section tracking

**Files:**
- Create: `app/admin/integrations/mixradius/expenses/RABTrackingSection.tsx`
- Modify: `app/admin/integrations/mixradius/expenses/RABView.tsx`

- [ ] **Step 1: Add the failing integration assertion for the view helper usage**

Tambahkan assertion berikut ke `tests/ui/rab-tracking-calculations.test.ts` agar kontrak helper yang dipakai `RABView` jelas:

```ts
it('exposes summary totals that match the values needed by the detail view cards', () => {
  const result = buildRabTrackingDataset(project)

  expect(result.summary).toEqual({
    totalInvestorReceipts: result.totals.recoveryInstallment + result.totals.investorShare,
    totalCompanyReceipts: result.totals.companyShare,
  })
})
```

- [ ] **Step 2: Run test to verify it stays red until the view is wired up**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts`
Expected: PASS untuk helper contract, tetapi `RABView.tsx` masih belum memakai helper yang sama di tabel + summary.

- [ ] **Step 3: Create the focused tracking section component**

```tsx
import { formatCurrency } from '@/lib/utils'
import { HiOutlineCheck, HiOutlinePencilSquare, HiOutlineXMark } from 'react-icons/hi2'

import type { RabTrackingDataset } from './rabTracking'

interface RABTrackingSectionProps {
  dataset: RabTrackingDataset
  nplTolerancePercent: number
  editingMonth: number | null
  editForm: {
    actualRevenue: string
    manualRecoveryInstallment: string
    manualInvestorShare: string
    manualCompanyShare: string
    manualInvestorProfitSharePercent: string
  }
  isSavingActual: boolean
  onEditMonth: (month: number, revenue: number) => void
  onCancelEdit: () => void
  onSaveMonth: (month: number) => void
  onEditFormChange: (name: string, value: string) => void
}

export default function RABTrackingSection({
  dataset,
  nplTolerancePercent,
  editingMonth,
  editForm,
  isSavingActual,
  onEditMonth,
  onCancelEdit,
  onSaveMonth,
  onEditFormChange,
}: RABTrackingSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
          Tracking Pencapaian (Realisasi)
        </h3>
      </div>

      <div className="p-0 overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Periode</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Revenue</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-red-500 uppercase">Potensi NPL</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-blue-600 uppercase">Profit Kotor</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-amber-600 uppercase">Angsuran Modal</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-orange-600 uppercase">Sisa Investasi</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-indigo-600 uppercase">Investor Share</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-emerald-600 uppercase">Company Share</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {dataset.rows.map((row) => {
              const isEditing = editingMonth === row.month
              return (
                <tr key={row.month}>
                  <td className="px-4 py-3 text-[11px] font-medium text-gray-900 dark:text-white">Bln-{row.month}</td>
                  <td className="px-4 py-3 text-right text-[11px]">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.actualRevenue}
                        onChange={(event) => onEditFormChange('actualRevenue', event.target.value)}
                        className="w-24 text-right text-[11px] border-blue-300 rounded"
                      />
                    ) : (
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(row.revenue)}</span>
                        <span className="text-[9px] text-gray-400">{row.isProjected ? 'Proyeksi' : 'Aktual'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] text-red-500">
                    {formatCurrency(row.nplAmount)}
                    <div className="text-[9px] text-gray-400">({nplTolerancePercent}%)</div>
                  </td>
                  <td className="px-4 py-3 text-right text-[11px]">{formatCurrency(row.grossProfit)}</td>
                  <td className="px-4 py-3 text-right text-[11px]">{formatCurrency(row.recoveryInstallment)}</td>
                  <td className="px-4 py-3 text-right text-[11px]">{formatCurrency(row.remainingInvestment)}</td>
                  <td className="px-4 py-3 text-right text-[11px]">{formatCurrency(row.investorShare)}</td>
                  <td className="px-4 py-3 text-right text-[11px]">{formatCurrency(row.companyShare)}</td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <div className="flex gap-2 justify-center">
                        <button type="button" onClick={onCancelEdit} disabled={isSavingActual}><HiOutlineXMark className="w-4 h-4" /></button>
                        <button type="button" onClick={() => onSaveMonth(row.month)} disabled={isSavingActual}><HiOutlineCheck className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => onEditMonth(row.month, row.revenue)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                        Catat
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-100 dark:bg-gray-900 font-bold border-t-2 border-gray-200 dark:border-gray-700">
            <tr>
              <td className="px-4 py-4 text-[10px] font-bold uppercase">TOTAL AKUMULASI</td>
              <td className="px-4 py-4 text-right text-[11px]">{formatCurrency(dataset.totals.revenue)}</td>
              <td className="px-4 py-4 text-right text-[11px] text-red-500">{formatCurrency(dataset.totals.npl)}</td>
              <td className="px-4 py-4 text-right text-[11px] text-blue-600">{formatCurrency(dataset.totals.grossProfit)}</td>
              <td className="px-4 py-4 text-right text-[11px] text-amber-600">{formatCurrency(dataset.totals.recoveryInstallment)}</td>
              <td className="px-4 py-4 text-right text-[11px] text-orange-600">{formatCurrency(dataset.totals.remainingInvestment)}</td>
              <td className="px-4 py-4 text-right text-[11px] text-indigo-600">{formatCurrency(dataset.totals.investorShare)}</td>
              <td className="px-4 py-4 text-right text-[11px] text-emerald-600">{formatCurrency(dataset.totals.companyShare)}</td>
              <td className="px-4 py-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
          Ringkasan Hak & Pembagian Keuntungan
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-900/20">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-200">Hak Investor (Modal + Profit)</p>
            <p className="mt-2 text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {formatCurrency(dataset.summary.totalInvestorReceipts)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/20">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">Hak Perusahaan (Profit)</p>
            <p className="mt-2 text-lg font-bold text-emerald-900 dark:text-emerald-100">
              {formatCurrency(dataset.summary.totalCompanyReceipts)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Replace inline tracking math in `RABView.tsx` with the helper dataset**

```tsx
import { useMemo } from 'react'

import { buildRabTrackingDataset } from './rabTracking'
import RABTrackingSection from './RABTrackingSection'
import type { RABProject } from './rabTypes'
import {
  calculateMonthlySubscribers,
  calculateRealisticBEP,
} from './rabCalculations'

const trackingDataset = useMemo(
  () => buildRabTrackingDataset({ ...data, actualAchievements: actuals }),
  [actuals, data],
)
```

```tsx
<RABTrackingSection
  dataset={trackingDataset}
  nplTolerancePercent={data.nplTolerancePercent || 0}
  editingMonth={editingMonth}
  editForm={editForm}
  isSavingActual={isSavingActual}
  onEditMonth={(month, revenue) => handleEditClick(month, 0, revenue)}
  onCancelEdit={() => setEditingMonth(null)}
  onSaveMonth={handleSaveActual}
  onEditFormChange={(name, value) => setEditForm((previous) => ({ ...previous, [name]: value }))}
/>
```

Hapus tiga blok IIFE yang saat ini menghitung sendiri:
- body tabel tracking
- total akumulasi di `<tfoot>`
- summary bawah investor/perusahaan

- [ ] **Step 5: Run typecheck and helper tests**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts && npm run typecheck`
Expected: PASS dan `RABView.tsx` sudah tidak punya kalkulasi tracking ganda.

- [ ] **Step 6: Commit**

```bash
git add app/admin/integrations/mixradius/expenses/RABTrackingSection.tsx app/admin/integrations/mixradius/expenses/RABView.tsx tests/ui/rab-tracking-calculations.test.ts
git commit -m "fix: align rab detail tracking summary"
```

## Task 5: Pakai helper tracking yang sama untuk export CSV/PDF dan rapikan RABList

**Files:**
- Modify: `app/admin/integrations/mixradius/expenses/RABList.tsx`

- [ ] **Step 1: Add a failing export-oriented assertion to the helper test**

```ts
it('produces export-safe totals from the same tracking dataset', () => {
  const result = buildRabTrackingDataset(project)

  expect(result.totals).toMatchObject({
    revenue: expect.any(Number),
    npl: expect.any(Number),
    grossProfit: expect.any(Number),
    recoveryInstallment: expect.any(Number),
    investorShare: expect.any(Number),
    companyShare: expect.any(Number),
  })
})
```

- [ ] **Step 2: Run test and typecheck to lock the current target**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts && npm run typecheck`
Expected: helper contract PASS, tetapi `RABList.tsx` masih menduplikasi kalkulasi tracking di CSV/PDF.

- [ ] **Step 3: Replace duplicated export math in `RABList.tsx` with `buildRabTrackingDataset()`**

```ts
import { buildRabTrackingDataset } from './rabTracking'
import type {
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABProject,
} from './rabTypes'
import { calculateMonthlySubscribers, calculateRealisticBEP } from './rabCalculations'
```

```ts
const trackingDataset = buildRabTrackingDataset(project)

const csvContent = [
  `Proyek: ${project.name}`,
  `Status: ${project.status}`,
  `Target Pelanggan: ${project.targetSubscribers || 0}`,
  '',
  ['Bulan ke', 'Revenue', 'Potensi NPL', 'Profit Kotor', 'Angsuran Modal', 'Sisa Investasi', 'Investor Share', 'Company Share'].join(','),
  ...trackingDataset.rows.map((row) => [
    row.month,
    row.revenue,
    row.nplAmount,
    row.grossProfit,
    row.recoveryInstallment,
    row.remainingInvestment,
    row.investorShare,
    row.companyShare,
  ].join(',')),
  ['TOTAL AKUMULASI', trackingDataset.totals.revenue, trackingDataset.totals.npl, trackingDataset.totals.grossProfit, trackingDataset.totals.recoveryInstallment, '', trackingDataset.totals.investorShare, trackingDataset.totals.companyShare].join(','),
  ['TOTAL DITERIMA INVESTOR (Modal+Profit)', '', '', '', '', '', trackingDataset.summary.totalInvestorReceipts, ''].join(','),
  ['TOTAL DITERIMA PERUSAHAAN (Profit)', '', '', '', '', '', '', trackingDataset.summary.totalCompanyReceipts].join(','),
].join('\n')
```

```ts
const trackingDataset = buildRabTrackingDataset(project)

const trackingData = trackingDataset.rows.map((row) => [
  row.month.toString(),
  formatCurrency(row.revenue),
  formatCurrency(row.nplAmount),
  formatCurrency(row.grossProfit),
  formatCurrency(row.recoveryInstallment),
  formatCurrency(row.remainingInvestment),
  formatCurrency(row.investorShare),
  formatCurrency(row.companyShare),
])

autoTable(doc, {
  startY: currentY + 6,
  head: trackingHeaders,
  body: trackingData,
  foot: [[
    'TOTAL',
    formatCurrency(trackingDataset.totals.revenue),
    formatCurrency(trackingDataset.totals.npl),
    formatCurrency(trackingDataset.totals.grossProfit),
    formatCurrency(trackingDataset.totals.recoveryInstallment),
    '',
    formatCurrency(trackingDataset.totals.investorShare),
    formatCurrency(trackingDataset.totals.companyShare),
  ]],
})

doc.text(formatCurrency(trackingDataset.summary.totalInvestorReceipts), boxWidth - 10, currentY + 15, { align: 'right' })
doc.text(formatCurrency(trackingDataset.summary.totalCompanyReceipts), boxWidth - 10, currentY + 22, { align: 'right' })
```

- [ ] **Step 4: Run typecheck and shared helper tests**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts && npm run typecheck`
Expected: PASS dan `RABList.tsx` tidak lagi punya kalkulasi tracking copy-paste untuk CSV/PDF.

- [ ] **Step 5: Commit**

```bash
git add app/admin/integrations/mixradius/expenses/RABList.tsx tests/ui/rab-tracking-calculations.test.ts
git commit -m "refactor: reuse rab tracking dataset in exports"
```

## Task 6: Verifikasi regresi patch RAB end-to-end

**Files:**
- Verify: `app/admin/integrations/mixradius/expenses/RABView.tsx`
- Verify: `app/admin/integrations/mixradius/expenses/RABList.tsx`
- Verify: `app/api/integrations/mixradius/expenses/rab/[id]/approve/route.ts`
- Verify: `tests/ui/rab-tracking-calculations.test.ts`
- Verify: `tests/api/integrations/mixradius/rab-approve-route.test.ts`
- Verify: `tests/api/integrations/mixradius/rab-revision-approve-route.test.ts`

- [ ] **Step 1: Run the focused automated suite**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts tests/api/integrations/mixradius/rab-approve-route.test.ts tests/api/integrations/mixradius/rab-revision-approve-route.test.ts`
Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS atau hanya blocker unrelated yang sudah ada sebelumnya.

- [ ] **Step 3: Start the dev server**

Run: `npm run dev`
Expected: server aktif di `http://localhost:3000`.

- [ ] **Step 4: Verify the RAB detail view in the browser**

Manual checks:
- buka `http://localhost:3000/admin/integrations/mixradius/expenses`
- pilih tab `RAB`
- buka satu detail proyek yang punya bulan proyeksi dan aktual
- pastikan angka **Ringkasan Hak Investor/Perusahaan** sama dengan agregasi tabel tracking
- pastikan bulan proyeksi memakai revenue setelah pengurangan NPL tolerance
- edit satu bulan aktual dengan manual recovery/share, simpan, lalu pastikan tabel dan summary ikut berubah konsisten

- [ ] **Step 5: Verify approval flow and export behavior in the browser**

Manual checks:
- approve satu RAB `DRAFT` sekali → status menjadi `PENDING_APPROVAL`
- approve lagi dari user lain/akun lain yang valid → status menjadi `APPROVED`
- export CSV dan PDF dari proyek yang sama
- pastikan total revenue, total recovery, total investor share, total company share, dan ringkasan akhir sama dengan angka di detail RAB

- [ ] **Step 6: Run the final check**

Run: `npm run test:run -- tests/ui/rab-tracking-calculations.test.ts tests/api/integrations/mixradius/rab-approve-route.test.ts tests/api/integrations/mixradius/rab-revision-approve-route.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/admin/integrations/mixradius/expenses/rabTypes.ts app/admin/integrations/mixradius/expenses/rabCalculations.ts app/admin/integrations/mixradius/expenses/rabTracking.ts app/admin/integrations/mixradius/expenses/RABTrackingSection.tsx app/admin/integrations/mixradius/expenses/RABList.tsx app/admin/integrations/mixradius/expenses/RABView.tsx app/admin/integrations/mixradius/expenses/RABCompare.tsx app/admin/integrations/mixradius/expenses/RABForm.tsx app/admin/integrations/mixradius/expenses/ExpensesClient.tsx app/api/integrations/mixradius/expenses/rab/[id]/approve/route.ts tests/ui/rab-tracking-calculations.test.ts tests/api/integrations/mixradius/rab-approve-route.test.ts
git commit -m "fix: align rab tracking and approval flow"
```

## Self-Review

- Spec coverage lengkap: mismatch angka detail RAB ditutup oleh Task 2, 4, dan 5; stale approval count ditutup oleh Task 3; refactor sedang `RABView.tsx` dan `RABList.tsx` ditutup oleh Task 1, 4, dan 5; regression verification ditutup oleh Task 6.
- Placeholder scan selesai: tidak ada `TODO`, `TBD`, atau langkah samar tanpa file/command.
- Type consistency aman: semua consumer `RABProject` pindah ke `rabTypes.ts`, helper subscriber/BEP pindah ke `rabCalculations.ts`, dan semua tracking/sum/export memakai `buildRabTrackingDataset()` dari `rabTracking.ts`.
