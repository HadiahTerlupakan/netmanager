# Multi-Tenant Logo Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti semua hardcoded logo aplikasi dengan resolver terpusat yang mendukung tenant-specific logo, fallback global, dan fallback asset default.

**Architecture:** Implementasi dibagi menjadi empat unit: resolver branding tenant/global di modul settings, kontrak parsing settings yang aman untuk hook client, komponen logo reusable untuk UI, lalu migrasi consumer yang masih hardcode. Tenant-aware branding dibaca eksplisit dari source settings tenant dan global, sedangkan halaman publik tanpa tenant context memakai global fallback dari endpoint public settings.

**Tech Stack:** TypeScript, Next.js 16, React 19, Prisma, Vitest, Tailwind CSS.

---

## File Structure

- Create: `modules/settings/services/appBranding.ts`
  - Resolver logo aplikasi dengan prioritas `tenant -> global -> default`.
- Modify: `modules/settings/services/publicPortalSettings.ts`
  - Memakai resolver branding terpusat untuk payload public settings.
- Modify: `modules/settings/index.ts`
  - Mengekspor resolver branding baru.
- Create: `tests/modules/settings/appBranding.test.ts`
  - Mengunci fallback chain tenant/global/default.
- Create: `lib/settings/mergeSettingsPayload.ts`
  - Helper pure untuk merge payload general settings + payload logo yang dibungkus `data`.
- Modify: `hooks/useSettings.ts`
  - Memakai helper merge agar `logoAplikasi` dan `logoInvoice` terbaca benar.
- Create: `tests/lib/settings/mergeSettingsPayload.test.ts`
  - Mengunci parser respons settings agar tidak silent failure.
- Create: `hooks/usePublicBranding.ts`
  - Hook public untuk halaman branding non-admin.
- Create: `components/branding/AppLogo.tsx`
  - Komponen reusable untuk render logo final/fallback awal nama aplikasi.
- Create: `tests/components/branding/AppLogo.test.tsx`
  - Mengunci render image vs fallback monogram.
- Modify: `components/layout/Sidebar.tsx`
  - Mengganti monogram-only menjadi logo final bila tersedia.
- Modify: `components/layout/EmployeeSidebar.tsx`
  - Mengganti monogram-only menjadi logo final bila tersedia.
- Modify: `components/LandingPage.tsx`
  - Menghapus hardcoded `/images/logo-sbl.png` dan memakai public branding hook.
- Modify: `app/(customer)/login/page.tsx`
  - Menghapus hardcoded logo login customer dan memakai public branding hook.
- Modify: `app/kebijakan-privasi/page.tsx`
  - Menghapus hardcoded logo header dan memakai komponen logo reusable dengan branding public.
- Create: `tests/api/settings-public-route.test.ts`
  - Mengunci payload `appLogoUrl` dari route public settings.
- Modify: `app/api/settings/public/route.ts`
  - Mengekspos `appLogoUrl` hasil resolver branding.

## Task 1: Tambah resolver branding tenant/global/default

**Files:**
- Create: `modules/settings/services/appBranding.ts`
- Modify: `modules/settings/services/publicPortalSettings.ts`
- Modify: `modules/settings/index.ts`
- Test: `tests/modules/settings/appBranding.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFindManyByKeys = vi.fn()

vi.mock('@/modules/settings/repositories/SettingsRepository', () => ({
  SettingsRepository: {
    findManyByKeys: (...args: unknown[]) => mockFindManyByKeys(...args),
  },
}))

import {
  DEFAULT_APP_LOGO_PATH,
  resolveAppBranding,
} from '@/modules/settings/services/appBranding'

describe('resolveAppBranding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns tenant logo when tenant-specific logo exists', async () => {
    mockFindManyByKeys
      .mockResolvedValueOnce([{ key: 'LOGO_APLIKASI', value: 'tenant/logo.png', encrypted: false }])
      .mockResolvedValueOnce([{ key: 'GENERAL_NAMA_APLIKASI', value: 'Tenant App', encrypted: false }])

    await expect(resolveAppBranding('tenant-1')).resolves.toEqual({
      appName: 'Tenant App',
      appLogoUrl: '/tenant/logo.png',
      source: 'tenant',
      tenantId: 'tenant-1',
    })
  })

  it('falls back to global logo when tenant logo is missing', async () => {
    mockFindManyByKeys
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ key: 'LOGO_APLIKASI', value: '/global/logo.png', encrypted: false }])
      .mockResolvedValueOnce([{ key: 'GENERAL_NAMA_APLIKASI', value: 'NetManager', encrypted: false }])

    await expect(resolveAppBranding('tenant-1')).resolves.toEqual({
      appName: 'NetManager',
      appLogoUrl: '/global/logo.png',
      source: 'global',
      tenantId: 'tenant-1',
    })
  })

  it('falls back to default asset when tenant and global logos are missing', async () => {
    mockFindManyByKeys
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(resolveAppBranding(null)).resolves.toEqual({
      appName: 'NetManager',
      appLogoUrl: DEFAULT_APP_LOGO_PATH,
      source: 'default',
      tenantId: null,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/modules/settings/appBranding.test.ts
```

Expected:
- FAIL karena `appBranding.ts` belum ada dan `resolveAppBranding` belum diimplementasikan.

- [ ] **Step 3: Write minimal implementation**

Buat `modules/settings/services/appBranding.ts`:

```ts
import { SettingsRepository } from '../repositories/SettingsRepository'

export const DEFAULT_APP_LOGO_PATH = '/images/logo-sbl.png'

export type AppBranding = {
  appName: string
  appLogoUrl: string
  source: 'tenant' | 'global' | 'default'
  tenantId: string | null
}

const APP_LOGO_KEY = 'LOGO_APLIKASI'
const APP_NAME_KEY = 'GENERAL_NAMA_APLIKASI'

function normalizeLogoPath(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  return trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`
}

async function getSettingValue(key: string, tenantId: string | null): Promise<string | null> {
  const records = await SettingsRepository.findManyByKeys([key], tenantId)
  return records[0]?.value ?? null
}

export async function resolveAppBranding(tenantId: string | null): Promise<AppBranding> {
  const tenantLogo = tenantId ? normalizeLogoPath(await getSettingValue(APP_LOGO_KEY, tenantId)) : null
  const globalLogo = normalizeLogoPath(await getSettingValue(APP_LOGO_KEY, null))
  const appName = (await getSettingValue(APP_NAME_KEY, tenantId)) || (await getSettingValue(APP_NAME_KEY, null)) || 'NetManager'

  if (tenantLogo) {
    return { appName, appLogoUrl: tenantLogo, source: 'tenant', tenantId }
  }

  if (globalLogo) {
    return { appName, appLogoUrl: globalLogo, source: 'global', tenantId }
  }

  return {
    appName,
    appLogoUrl: DEFAULT_APP_LOGO_PATH,
    source: 'default',
    tenantId,
  }
}
```

Update `modules/settings/services/publicPortalSettings.ts` agar memakai resolver baru:

```ts
import { getTenantIdFromContext } from '@/lib/tenant-context'
import { SettingsRepository } from '../repositories/SettingsRepository'
import { resolveAppBranding } from './appBranding'

const PUBLIC_SETTINGS_KEYS = [
  'GENERAL_NAMA_APLIKASI',
  'GENERAL_PERUSAHAAN',
  'LOGO_INVOICE',
] as const

export type PublicPortalSettingsPayload = {
  namaAplikasi: string
  perusahaan: string
  logoInvoice: string | null
  appLogoUrl: string
}

export async function getPublicPortalSettings(): Promise<PublicPortalSettingsPayload> {
  const { tenantId } = await getTenantIdFromContext()
  const records = await SettingsRepository.findManyByKeys(PUBLIC_SETTINGS_KEYS, tenantId)
  const settingsMap = new Map(records.map((setting) => [setting.key, setting.value]))
  const branding = await resolveAppBranding(tenantId)

  return {
    namaAplikasi: branding.appName,
    perusahaan: settingsMap.get('GENERAL_PERUSAHAAN') || '',
    logoInvoice: settingsMap.get('LOGO_INVOICE') || null,
    appLogoUrl: branding.appLogoUrl,
  }
}
```

Update `modules/settings/index.ts`:

```ts
export * from './services/appBranding'
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/modules/settings/appBranding.test.ts
```

Expected:
- PASS untuk tiga jalur: tenant, global fallback, default fallback.

- [ ] **Step 5: Commit**

```bash
git add modules/settings/services/appBranding.ts modules/settings/services/publicPortalSettings.ts modules/settings/index.ts tests/modules/settings/appBranding.test.ts
git commit -m "feat: add tenant-aware app branding resolver"
```

## Task 2: Perbaiki kontrak parsing settings dan route public branding

**Files:**
- Create: `lib/settings/mergeSettingsPayload.ts`
- Modify: `hooks/useSettings.ts`
- Create: `tests/lib/settings/mergeSettingsPayload.test.ts`
- Modify: `app/api/settings/public/route.ts`
- Create: `tests/api/settings-public-route.test.ts`

- [ ] **Step 1: Write the failing tests**

Buat `tests/lib/settings/mergeSettingsPayload.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mergeSettingsPayload } from '@/lib/settings/mergeSettingsPayload'

describe('mergeSettingsPayload', () => {
  it('merges general payload with nested logo payload data', () => {
    const result = mergeSettingsPayload(
      { data: { namaAplikasi: 'Tenant App', perusahaan: 'Tenant Co' } },
      { data: { logoAplikasi: '/tenant/logo.png', logoInvoice: '/tenant/invoice.png' } },
    )

    expect(result).toEqual({
      namaAplikasi: 'Tenant App',
      perusahaan: 'Tenant Co',
      logoAplikasi: '/tenant/logo.png',
      logoInvoice: '/tenant/invoice.png',
    })
  })

  it('keeps general payload intact when logo payload is missing', () => {
    expect(
      mergeSettingsPayload({ data: { namaAplikasi: 'NetManager' } }, null),
    ).toEqual({ namaAplikasi: 'NetManager' })
  })
})
```

Buat `tests/api/settings-public-route.test.ts`:

```ts
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetPublicPortalSettings = vi.fn()

vi.mock('@/modules/settings', () => ({
  getPublicPortalSettings: (...args: unknown[]) => mockGetPublicPortalSettings(...args),
}))

import { GET } from '@/app/api/settings/public/route'

describe('GET /api/settings/public', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns appLogoUrl from public branding payload', async () => {
    mockGetPublicPortalSettings.mockResolvedValue({
      namaAplikasi: 'Tenant App',
      perusahaan: 'Tenant Co',
      logoInvoice: '/tenant/invoice.png',
      appLogoUrl: '/tenant/logo.png',
    })

    const response = await GET(new NextRequest('http://localhost/api/settings/public'))
    const payload = await response.json()

    expect(payload).toEqual({
      success: true,
      data: {
        namaAplikasi: 'Tenant App',
        perusahaan: 'Tenant Co',
        logoInvoice: '/tenant/invoice.png',
        appLogoUrl: '/tenant/logo.png',
      },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm run test:run -- tests/lib/settings/mergeSettingsPayload.test.ts tests/api/settings-public-route.test.ts
```

Expected:
- FAIL karena helper merge belum ada.
- FAIL karena route public belum mengembalikan `appLogoUrl`.

- [ ] **Step 3: Write minimal implementation**

Buat `lib/settings/mergeSettingsPayload.ts`:

```ts
type PayloadRecord = Record<string, unknown>

function unwrapPayload<T extends PayloadRecord>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as PayloadRecord)) {
    const nested = (payload as { data?: T }).data
    return (nested ?? {}) as T
  }

  return ((payload as T) ?? {})
}

export function mergeSettingsPayload<TGeneral extends PayloadRecord, TLogo extends PayloadRecord>(
  generalPayload: unknown,
  logoPayload: unknown,
): TGeneral & TLogo {
  return {
    ...unwrapPayload<TGeneral>(generalPayload),
    ...unwrapPayload<TLogo>(logoPayload),
  }
}
```

Update `hooks/useSettings.ts` agar memakai helper:

```ts
import { mergeSettingsPayload } from '@/lib/settings/mergeSettingsPayload'

// di dalam fetchSettings()
const generalPayload = await generalRes.json()
const logoPayload = logoRes.ok ? await logoRes.json() : null
const mergedSettings = mergeSettingsPayload<GeneralSettings, Pick<GeneralSettings, 'logoAplikasi' | 'logoInvoice'>>(
  generalPayload,
  logoPayload,
)

setSettings(mergedSettings)
```

Update `app/api/settings/public/route.ts`:

```ts
return NextResponse.json({
  success: true,
  data: {
    namaAplikasi: settings.namaAplikasi,
    perusahaan: settings.perusahaan,
    logoInvoice: settings.logoInvoice,
    appLogoUrl: settings.appLogoUrl,
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm run test:run -- tests/lib/settings/mergeSettingsPayload.test.ts tests/api/settings-public-route.test.ts
```

Expected:
- PASS untuk parser nested `data` dan route public branding.

- [ ] **Step 5: Commit**

```bash
git add lib/settings/mergeSettingsPayload.ts hooks/useSettings.ts app/api/settings/public/route.ts tests/lib/settings/mergeSettingsPayload.test.ts tests/api/settings-public-route.test.ts
git commit -m "fix: align settings payload parsing with public branding"
```

## Task 3: Tambah komponen logo reusable dan migrasi sidebar tenant-aware

**Files:**
- Create: `components/branding/AppLogo.tsx`
- Create: `tests/components/branding/AppLogo.test.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/EmployeeSidebar.tsx`

- [ ] **Step 1: Write the failing test**

Buat `tests/components/branding/AppLogo.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppLogo } from '@/components/branding/AppLogo'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, src, ...rest } = props
    return <img alt={String(alt)} src={String(src)} {...rest} />
  },
}))

describe('AppLogo', () => {
  it('renders image when final logo url is available', () => {
    const html = renderToStaticMarkup(
      <AppLogo appName="Tenant App" appLogoUrl="/tenant/logo.png" source="tenant" />,
    )

    expect(html).toContain('src="/tenant/logo.png"')
    expect(html).not.toContain('TA')
  })

  it('renders monogram fallback when using default branding', () => {
    const html = renderToStaticMarkup(
      <AppLogo appName="NetManager" appLogoUrl="/images/logo-sbl.png" source="default" />,
    )

    expect(html).toContain('NM')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/components/branding/AppLogo.test.tsx
```

Expected:
- FAIL karena `AppLogo` belum ada.

- [ ] **Step 3: Write minimal implementation**

Buat `components/branding/AppLogo.tsx`:

```tsx
'use client'

import Image from 'next/image'

type AppLogoProps = {
  appName: string
  appLogoUrl: string
  source: 'tenant' | 'global' | 'default'
  className?: string
  imageClassName?: string
  fallbackClassName?: string
}

function getMonogram(appName: string): string {
  const parts = appName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }

  return appName.slice(0, 2).toUpperCase()
}

export function AppLogo({
  appName,
  appLogoUrl,
  source,
  className = 'relative h-12 w-full',
  imageClassName = 'object-contain',
  fallbackClassName = 'flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xl',
}: AppLogoProps) {
  if (source === 'default') {
    return <div className={fallbackClassName}>{getMonogram(appName)}</div>
  }

  return (
    <div className={className}>
      <Image src={appLogoUrl} alt={appName} fill className={imageClassName} unoptimized />
    </div>
  )
}
```

Update `components/layout/Sidebar.tsx` pada section branding:

```tsx
import { AppLogo } from '@/components/branding/AppLogo'

const logoSource = settings?.logoAplikasi ? 'tenant' : 'default'
const appLogoUrl = settings?.logoAplikasi || '/images/logo-sbl.png'

<AppLogo
  appName={appName}
  appLogoUrl={appLogoUrl}
  source={logoSource}
  className="relative h-10 w-24 shrink-0"
  imageClassName="object-contain object-left"
/>
```

Update `components/layout/EmployeeSidebar.tsx` dengan pola yang sama.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/components/branding/AppLogo.test.tsx
```

Expected:
- PASS untuk render image dan monogram fallback.

- [ ] **Step 5: Commit**

```bash
git add components/branding/AppLogo.tsx components/layout/Sidebar.tsx components/layout/EmployeeSidebar.tsx tests/components/branding/AppLogo.test.tsx
git commit -m "feat: render tenant-aware branding in sidebars"
```

## Task 4: Migrasikan halaman publik yang masih hardcode logo

**Files:**
- Create: `hooks/usePublicBranding.ts`
- Modify: `components/LandingPage.tsx`
- Modify: `app/(customer)/login/page.tsx`
- Modify: `app/kebijakan-privasi/page.tsx`
- Test: `tests/lib/settings/mergeSettingsPayload.test.ts`

- [ ] **Step 1: Write the failing test**

Tambahkan assertion baru ke `tests/lib/settings/mergeSettingsPayload.test.ts`:

```ts
it('returns public branding payload with appLogoUrl for public consumers', () => {
  const result = mergeSettingsPayload(
    { data: { namaAplikasi: 'NetManager', perusahaan: 'Tenant Co' } },
    { data: { appLogoUrl: '/global/logo.png' } },
  )

  expect(result).toEqual({
    namaAplikasi: 'NetManager',
    perusahaan: 'Tenant Co',
    appLogoUrl: '/global/logo.png',
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/lib/settings/mergeSettingsPayload.test.ts
```

Expected:
- FAIL jika helper merge masih terlalu sempit atau type contract public branding belum dipakai.

- [ ] **Step 3: Write minimal implementation**

Buat `hooks/usePublicBranding.ts`:

```ts
'use client'

import { useEffect, useState } from 'react'
import { mergeSettingsPayload } from '@/lib/settings/mergeSettingsPayload'

type PublicBranding = {
  namaAplikasi: string
  perusahaan: string
  appLogoUrl: string
}

export function usePublicBranding() {
  const [branding, setBranding] = useState<PublicBranding | null>(null)

  useEffect(() => {
    async function fetchBranding() {
      const response = await fetch('/api/settings/public')
      if (!response.ok) {
        return
      }

      const payload = await response.json()
      setBranding(mergeSettingsPayload<PublicBranding, Record<string, never>>(payload, null))
    }

    void fetchBranding()
  }, [])

  return branding
}
```

Update `components/LandingPage.tsx`:

```tsx
import { usePublicBranding } from '@/hooks/usePublicBranding'

const branding = usePublicBranding()
const appName = branding?.namaAplikasi || 'NetManager'
const appLogoUrl = branding?.appLogoUrl || '/images/logo-sbl.png'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'InternetServiceProvider',
  name: appName,
  image: appLogoUrl,
  // field lain tetap
}

<Image
  src={appLogoUrl}
  alt={appName}
  width={152}
  height={48}
  className="h-12 w-auto object-contain"
  priority
  unoptimized
/>
```

Update `app/(customer)/login/page.tsx`:

```tsx
import { usePublicBranding } from '@/hooks/usePublicBranding'

const branding = usePublicBranding()
const appName = branding?.namaAplikasi || 'NetManager'
const appLogoUrl = branding?.appLogoUrl || '/images/logo-sbl.png'

<Image
  src={appLogoUrl}
  alt={`Logo ${appName}`}
  fill
  className="object-contain"
  priority
  unoptimized
/>
```

Update `app/kebijakan-privasi/page.tsx` menjadi client component dan pakai hook yang sama:

```tsx
'use client'

import { usePublicBranding } from '@/hooks/usePublicBranding'

const branding = usePublicBranding()
const appName = branding?.namaAplikasi || 'NetManager'
const appLogoUrl = branding?.appLogoUrl || '/images/logo-sbl.png'

<Image
  src={appLogoUrl}
  alt={appName}
  width={120}
  height={38}
  className="h-8 w-auto object-contain"
  unoptimized
/>
```

Lakukan pencarian ulang `logo-sbl.png` setelah perubahan dan ganti hanya consumer branding yang masih harus mengikuti resolver public.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm run test:run -- tests/lib/settings/mergeSettingsPayload.test.ts tests/components/branding/AppLogo.test.tsx tests/api/settings-public-route.test.ts
```

Expected:
- PASS.
- Tidak ada assertion yang gagal pada helper branding, component logo, dan route public settings.

- [ ] **Step 5: Commit**

```bash
git add hooks/usePublicBranding.ts components/LandingPage.tsx app/(customer)/login/page.tsx app/kebijakan-privasi/page.tsx tests/lib/settings/mergeSettingsPayload.test.ts
git commit -m "feat: replace public hardcoded logos with branding resolver"
```

## Task 5: Verifikasi akhir consumer logo dan regresi dasar

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/EmployeeSidebar.tsx`
- Modify: `components/LandingPage.tsx`
- Modify: `app/(customer)/login/page.tsx`
- Modify: `app/kebijakan-privasi/page.tsx`
- Test: `tests/components/branding/AppLogo.test.tsx`
- Test: `tests/api/settings-public-route.test.ts`
- Test: `tests/lib/settings/mergeSettingsPayload.test.ts`

- [ ] **Step 1: Write the failing verification step**

Tambahkan checklist manual ini ke catatan kerja task dan anggap task belum selesai sebelum semua poin lolos:

```md
- Sidebar admin menampilkan logo image saat `settings.logoAplikasi` tersedia.
- Sidebar karyawan menampilkan logo image saat `settings.logoAplikasi` tersedia.
- Login customer tidak lagi memakai string hardcoded `"/images/logo-sbl.png"` sebagai source utama.
- Landing page memakai `appLogoUrl` dari public branding.
- Privacy policy memakai `appLogoUrl` dari public branding.
```

- [ ] **Step 2: Run automated verification**

Run:
```bash
npm run test:run -- tests/modules/settings/appBranding.test.ts tests/lib/settings/mergeSettingsPayload.test.ts tests/components/branding/AppLogo.test.tsx tests/api/settings-public-route.test.ts
```

Expected:
- Semua test PASS.

- [ ] **Step 3: Run targeted source verification**

Run:
```bash
grep -R "logo-sbl.png" app components hooks lib modules tests -n
```

Expected:
- Hanya fallback default asset atau tempat yang memang sengaja jadi fallback terakhir.
- Tidak ada consumer branding utama yang masih hardcode `logo-sbl.png` sebagai source pertama.

- [ ] **Step 4: Review diff before finalizing**

Run:
```bash
git diff -- modules/settings/services/appBranding.ts modules/settings/services/publicPortalSettings.ts app/api/settings/public/route.ts hooks/useSettings.ts hooks/usePublicBranding.ts components/branding/AppLogo.tsx components/layout/Sidebar.tsx components/layout/EmployeeSidebar.tsx components/LandingPage.tsx app/(customer)/login/page.tsx app/kebijakan-privasi/page.tsx tests/modules/settings/appBranding.test.ts tests/lib/settings/mergeSettingsPayload.test.ts tests/components/branding/AppLogo.test.tsx tests/api/settings-public-route.test.ts
```

Expected:
- Diff hanya berisi perubahan resolver branding, parser settings, dan migrasi consumer logo.

- [ ] **Step 5: Commit**

```bash
git add modules/settings/services/appBranding.ts modules/settings/services/publicPortalSettings.ts app/api/settings/public/route.ts hooks/useSettings.ts hooks/usePublicBranding.ts components/branding/AppLogo.tsx components/layout/Sidebar.tsx components/layout/EmployeeSidebar.tsx components/LandingPage.tsx app/(customer)/login/page.tsx app/kebijakan-privasi/page.tsx tests/modules/settings/appBranding.test.ts tests/lib/settings/mergeSettingsPayload.test.ts tests/components/branding/AppLogo.test.tsx tests/api/settings-public-route.test.ts
git commit -m "feat: unify tenant and public app logo resolution"
```

## Self-Review

- Spec coverage:
  - Resolver tenant/global/default tercakup di Task 1.
  - Perbaikan kontrak hook settings tercakup di Task 2.
  - Migrasi sidebar dan consumer publik tercakup di Task 3-4.
  - Verifikasi regresi tercakup di Task 5.
- Placeholder scan:
  - Tidak ada `TODO`, `TBD`, atau referensi "mirip task sebelumnya".
- Type consistency:
  - Property branding final memakai nama tetap: `appName`, `appLogoUrl`, `source`, `tenantId`.
  - Payload public memakai `appLogoUrl` secara konsisten.
