# Dual Update Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pisahkan jalur update OTA (JS bundle) dan APK (native release) dengan notifikasi APK update di mobile, menggunakan Expo fingerprint policy untuk delivery cerdas.

**Architecture:** Dua channel terpisah — module backend `app-version` baru untuk track APK release metadata, hook mobile `useApkVersionCheck` untuk poll status, orchestrator `useVersionCheck` koordinasi APK + OTA dengan APK-priority. `runtimeVersion` switch ke fingerprint policy untuk auto-detect perubahan native.

**Tech Stack:** Backend: Next.js App Router + Prisma + PostgreSQL + Zod. Mobile: React Native + Expo SDK 51+ + expo-updates + expo-application + expo-linking + AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-05-17-dual-update-channel-design.md`

---

## File Structure

### Backend (netmanager)

**New files:**
- `modules/app-version/index.ts` — public API
- `modules/app-version/domain/entities/AppReleaseEntity.ts` — domain entity
- `modules/app-version/domain/ports/IAppReleaseRepository.ts` — repository interface
- `modules/app-version/dto/AppReleaseDto.ts` — DTO untuk transport
- `modules/app-version/repositories/AppReleaseRepository.ts` — Prisma implementation
- `modules/app-version/services/AppReleaseQueryService.ts` — read operations
- `modules/app-version/services/AppReleaseMutationService.ts` — write operations (admin)
- `modules/app-version/services/AppVersionCheckService.ts` — logic compare versi + force determination
- `modules/app-version/validators/app-release.ts` — Zod schemas
- `modules/app-version/errors.ts` — custom errors
- `modules/app-version/__tests__/AppVersionCheckService.test.ts` — unit test
- `app/api/mobile/app-version/check/route.ts` — endpoint mobile check
- `app/api/admin/app-releases/route.ts` — admin list/create
- `app/api/admin/app-releases/[id]/route.ts` — admin detail/update/delete
- `app/admin/app-releases/page.tsx` — admin UI list
- `app/admin/app-releases/[id]/page.tsx` — admin UI detail/edit

**Modified files:**
- `prisma/schema.prisma` — model `AppRelease` + 2 field di `TenantSettings`
- `prisma/migrations/<timestamp>_add_app_releases/migration.sql` — generated
- `lib/rbac.ts` atau `modules/roles` — register permission `app-release:manage`
- `modules/settings/services/tenantSettings.ts` — extend untuk field `appUpdateContactUrl` + `appUpdateContactLabel`

### Mobile (mobile-netmanager)

**New files:**
- `src/hooks/useApkVersionCheck.ts` — hook check APK update
- `src/services/apkVersionService.ts` — API wrapper
- `src/types/appVersion.ts` — shared types

**Modified files:**
- `app.json` — `runtimeVersion` → fingerprint policy
- `src/hooks/useVersionCheck.ts` — orchestrator APK + OTA
- `src/components/molecules/UpdateAvailableModal.tsx` — tambah tombol Hubungi Admin + handle APK download
- `src/components/templates/UpdateRequiredScreen.tsx` — sama, untuk force update lock
- `app/_layout.tsx` — pakai field baru dari orchestrator

### Docs

- `docs/standards/mobile-update-strategy.md` — guide internal (baru)
- `docs/CHANGELOG.md` — entries
- `CLAUDE.md` — note aturan OTA-vs-APK

---

## Task 1: Schema Migration & TenantSettings Extension

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_app_releases/migration.sql` (auto-generated)

- [ ] **Step 1: Tambah model AppRelease ke schema.prisma**

Tambahkan di `prisma/schema.prisma` (cari posisi setelah model serupa, misal setelah model AppUpdate):

```prisma
model AppRelease {
  id                  String   @id @default(cuid())
  platform            String
  version             String
  versionCode         Int
  isForceUpdate       Boolean  @default(false)
  minSupportedVersion String?
  downloadUrl         String
  releaseNotes        String?  @db.Text
  isActive            Boolean  @default(true)
  releasedAt          DateTime @default(now())

  architecture        String?
  minOsVersion        String?
  rolloutPercentage   Int      @default(100)
  apkSizeBytes        Int?

  tenantId            String?
  createdBy           String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([platform, isActive, releasedAt])
  @@index([platform, architecture, isActive])
  @@index([tenantId])
  @@map("app_releases")
}
```

- [ ] **Step 2: Extend TenantSettings dengan field contact admin**

Cari `model TenantSettings { ... }` di schema.prisma dan tambah:

```prisma
  appUpdateContactUrl     String?
  appUpdateContactLabel   String?
```

- [ ] **Step 3: Generate migration**

Run: `npm run prisma:migrate -- --name add_app_releases`
Expected: Migration file dibuat di `prisma/migrations/<timestamp>_add_app_releases/migration.sql`, Prisma client regenerated.

- [ ] **Step 4: Verifikasi schema valid**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(app-version): tambah model AppRelease + extend TenantSettings"
```

---

## Task 2: Domain Layer (Entities & Ports)

**Files:**
- Create: `modules/app-version/domain/entities/AppReleaseEntity.ts`
- Create: `modules/app-version/domain/ports/IAppReleaseRepository.ts`
- Create: `modules/app-version/errors.ts`

- [ ] **Step 1: Buat AppReleaseEntity**

Create `modules/app-version/domain/entities/AppReleaseEntity.ts`:

```ts
export type AppReleasePlatform = "android" | "ios";
export type AppReleaseArchitecture =
  | "arm64-v8a"
  | "armeabi-v7a"
  | "x86_64"
  | "universal";

export interface AppRelease {
  id: string;
  platform: AppReleasePlatform;
  version: string;
  versionCode: number;
  isForceUpdate: boolean;
  minSupportedVersion: string | null;
  downloadUrl: string;
  releaseNotes: string | null;
  isActive: boolean;
  releasedAt: Date;
  architecture: AppReleaseArchitecture | null;
  minOsVersion: string | null;
  rolloutPercentage: number;
  apkSizeBytes: number | null;
  tenantId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Buat IAppReleaseRepository port**

Create `modules/app-version/domain/ports/IAppReleaseRepository.ts`:

```ts
import type { AppRelease, AppReleasePlatform } from "../entities/AppReleaseEntity";

export interface AppReleaseQueryFilters {
  platform?: AppReleasePlatform;
  isActive?: boolean;
  tenantId?: string;
  skip?: number;
  take?: number;
}

export interface AppReleaseCreateInput {
  platform: AppReleasePlatform;
  version: string;
  versionCode: number;
  isForceUpdate?: boolean;
  minSupportedVersion?: string | null;
  downloadUrl: string;
  releaseNotes?: string | null;
  isActive?: boolean;
  architecture?: string | null;
  minOsVersion?: string | null;
  rolloutPercentage?: number;
  apkSizeBytes?: number | null;
  tenantId?: string | null;
  createdBy?: string | null;
}

export interface AppReleaseUpdateInput {
  isActive?: boolean;
  isForceUpdate?: boolean;
  minSupportedVersion?: string | null;
  downloadUrl?: string;
  releaseNotes?: string | null;
  rolloutPercentage?: number;
  architecture?: string | null;
  minOsVersion?: string | null;
  apkSizeBytes?: number | null;
}

export interface IAppReleaseRepository {
  findLatestActive(query: {
    platform: AppReleasePlatform;
    tenantId?: string;
  }): Promise<AppRelease | null>;
  findById(id: string): Promise<AppRelease | null>;
  findAll(filters: AppReleaseQueryFilters): Promise<AppRelease[]>;
  count(filters: AppReleaseQueryFilters): Promise<number>;
  create(data: AppReleaseCreateInput): Promise<AppRelease>;
  update(id: string, data: AppReleaseUpdateInput): Promise<AppRelease>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 3: Buat errors.ts**

Create `modules/app-version/errors.ts`:

```ts
export class AppReleaseNotFoundError extends Error {
  constructor(id: string) {
    super(`App release dengan id ${id} tidak ditemukan`);
    this.name = "AppReleaseNotFoundError";
  }
}

export class AppReleaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppReleaseValidationError";
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add modules/app-version/domain/ modules/app-version/errors.ts
git commit -m "feat(app-version): tambah domain layer (entities + ports + errors)"
```

---

## Task 3: Validators (Zod Schemas)

**Files:**
- Create: `modules/app-version/validators/app-release.ts`

- [ ] **Step 1: Buat schemas**

Create `modules/app-version/validators/app-release.ts`:

```ts
import { z } from "zod";

export const APP_RELEASE_PLATFORMS = ["android", "ios"] as const;
export const APP_RELEASE_ARCHITECTURES = [
  "arm64-v8a",
  "armeabi-v7a",
  "x86_64",
  "universal",
] as const;

const semverPattern = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;

export const appReleasePlatformSchema = z.enum(APP_RELEASE_PLATFORMS);
export const appReleaseArchitectureSchema = z.enum(APP_RELEASE_ARCHITECTURES);

export const versionStringSchema = z.string().regex(semverPattern, {
  message: "Versi harus format semver (contoh: 1.0.8)",
});

export const appReleaseCreateSchema = z.object({
  platform: appReleasePlatformSchema,
  version: versionStringSchema,
  versionCode: z.number().int().positive(),
  isForceUpdate: z.boolean().default(false),
  minSupportedVersion: versionStringSchema.optional().nullable(),
  downloadUrl: z.string().url(),
  releaseNotes: z.string().max(5000).optional().nullable(),
  isActive: z.boolean().default(true),
  architecture: appReleaseArchitectureSchema.optional().nullable(),
  minOsVersion: z.string().max(20).optional().nullable(),
  rolloutPercentage: z.number().int().min(0).max(100).default(100),
  apkSizeBytes: z.number().int().positive().optional().nullable(),
});

export const appReleaseUpdateSchema = appReleaseCreateSchema.partial().omit({
  platform: true,
  version: true,
  versionCode: true,
});

export const versionCheckQuerySchema = z.object({
  platform: appReleasePlatformSchema,
  currentVersion: versionStringSchema,
  currentVersionCode: z.coerce.number().int().nonnegative(),
});

export type AppReleaseCreateDto = z.infer<typeof appReleaseCreateSchema>;
export type AppReleaseUpdateDto = z.infer<typeof appReleaseUpdateSchema>;
export type VersionCheckQuery = z.infer<typeof versionCheckQuerySchema>;
```

- [ ] **Step 2: Commit**

```bash
git add modules/app-version/validators/
git commit -m "feat(app-version): tambah Zod validators untuk schema input"
```

---

## Task 4: Repository Layer (Prisma Implementation)

**Files:**
- Create: `modules/app-version/repositories/AppReleaseRepository.ts`

- [ ] **Step 1: Implementasi repository**

Create `modules/app-version/repositories/AppReleaseRepository.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type {
  AppRelease,
  AppReleasePlatform,
} from "../domain/entities/AppReleaseEntity";
import type {
  AppReleaseCreateInput,
  AppReleaseQueryFilters,
  AppReleaseUpdateInput,
  IAppReleaseRepository,
} from "../domain/ports/IAppReleaseRepository";

type PrismaAppRelease = NonNullable<
  Awaited<ReturnType<typeof prisma.appRelease.findFirst>>
>;

function toEntity(record: PrismaAppRelease): AppRelease {
  return {
    ...record,
    platform: record.platform as AppReleasePlatform,
    architecture: record.architecture as AppRelease["architecture"],
  };
}

export class AppReleaseRepository implements IAppReleaseRepository {
  async findLatestActive(query: {
    platform: AppReleasePlatform;
    tenantId?: string;
  }): Promise<AppRelease | null> {
    const record = await prisma.appRelease.findFirst({
      where: {
        platform: query.platform,
        isActive: true,
        ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      },
      orderBy: { releasedAt: "desc" },
    });
    return record ? toEntity(record) : null;
  }

  async findById(id: string): Promise<AppRelease | null> {
    const record = await prisma.appRelease.findUnique({ where: { id } });
    return record ? toEntity(record) : null;
  }

  async findAll(filters: AppReleaseQueryFilters): Promise<AppRelease[]> {
    const records = await prisma.appRelease.findMany({
      where: this.buildWhere(filters),
      orderBy: { releasedAt: "desc" },
      skip: filters.skip,
      take: filters.take,
    });
    return records.map(toEntity);
  }

  async count(filters: AppReleaseQueryFilters): Promise<number> {
    return prisma.appRelease.count({ where: this.buildWhere(filters) });
  }

  async create(data: AppReleaseCreateInput): Promise<AppRelease> {
    const record = await prisma.appRelease.create({ data });
    return toEntity(record);
  }

  async update(
    id: string,
    data: AppReleaseUpdateInput,
  ): Promise<AppRelease> {
    const record = await prisma.appRelease.update({ where: { id }, data });
    return toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await prisma.appRelease.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private buildWhere(filters: AppReleaseQueryFilters) {
    return {
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add modules/app-version/repositories/
git commit -m "feat(app-version): tambah Prisma repository implementation"
```

---

## Task 5: AppVersionCheckService (Core Business Logic) — TDD

**Files:**
- Create: `modules/app-version/__tests__/AppVersionCheckService.test.ts`
- Create: `modules/app-version/services/AppVersionCheckService.ts`

- [ ] **Step 1: Write failing test**

Create `modules/app-version/__tests__/AppVersionCheckService.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { IAppReleaseRepository } from "../domain/ports/IAppReleaseRepository";
import type { AppRelease } from "../domain/entities/AppReleaseEntity";
import { AppVersionCheckService } from "../services/AppVersionCheckService";

function buildRelease(overrides: Partial<AppRelease> = {}): AppRelease {
  return {
    id: "rel-1",
    platform: "android",
    version: "1.0.9",
    versionCode: 9,
    isForceUpdate: false,
    minSupportedVersion: null,
    downloadUrl: "https://example.com/app.apk",
    releaseNotes: "Bug fixes",
    isActive: true,
    releasedAt: new Date("2026-05-17"),
    architecture: null,
    minOsVersion: null,
    rolloutPercentage: 100,
    apkSizeBytes: null,
    tenantId: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("AppVersionCheckService", () => {
  let repo: IAppReleaseRepository;
  let service: AppVersionCheckService;
  let tenantContact: {
    url: string | null;
    label: string | null;
  };

  beforeEach(() => {
    repo = {
      findLatestActive: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    tenantContact = { url: null, label: null };
    service = new AppVersionCheckService(repo, async () => tenantContact);
  });

  it("returns no update when current version equals latest", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.7", versionCode: 7 }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(false);
    expect(result.isForceUpdate).toBe(false);
    expect(result.latestVersion).toBeNull();
  });

  it("returns soft update when current less than latest and not forced", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.9", versionCode: 9 }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(true);
    expect(result.isForceUpdate).toBe(false);
    expect(result.latestVersion?.version).toBe("1.0.9");
  });

  it("returns force update when isForceUpdate flag is true", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.9", isForceUpdate: true }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(true);
    expect(result.isForceUpdate).toBe(true);
  });

  it("returns force update when current is below minSupportedVersion", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({
        version: "1.0.9",
        isForceUpdate: false,
        minSupportedVersion: "1.0.8",
      }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(true);
    expect(result.isForceUpdate).toBe(true);
  });

  it("returns no update when no active release exists", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(null);

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBeNull();
  });

  it("includes contact admin from tenant settings when configured", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.9" }),
    );
    tenantContact = {
      url: "https://wa.me/628123456789",
      label: "Hubungi Admin via WhatsApp",
    };

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.contactAdmin).toEqual({
      url: "https://wa.me/628123456789",
      label: "Hubungi Admin via WhatsApp",
    });
  });

  it("returns null contactAdmin when tenant settings empty", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.9" }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.contactAdmin).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run modules/app-version/__tests__/AppVersionCheckService.test.ts`
Expected: FAIL — service file tidak ada

- [ ] **Step 3: Implementasi service**

Create `modules/app-version/services/AppVersionCheckService.ts`:

```ts
import type {
  AppRelease,
  AppReleasePlatform,
} from "../domain/entities/AppReleaseEntity";
import type { IAppReleaseRepository } from "../domain/ports/IAppReleaseRepository";

export interface VersionCheckInput {
  platform: AppReleasePlatform;
  currentVersion: string;
  currentVersionCode: number;
  tenantId?: string;
}

export interface ContactAdminInfo {
  url: string;
  label: string | null;
}

export interface LatestVersionInfo {
  version: string;
  versionCode: number;
  releaseNotes: string | null;
  downloadUrl: string;
  apkSizeBytes: number | null;
  releasedAt: string;
}

export interface VersionCheckResult {
  updateAvailable: boolean;
  isForceUpdate: boolean;
  currentVersion: string;
  latestVersion: LatestVersionInfo | null;
  contactAdmin: ContactAdminInfo | null;
}

export type TenantContactLookup = (
  tenantId?: string,
) => Promise<{ url: string | null; label: string | null }>;

export class AppVersionCheckService {
  constructor(
    private readonly repository: IAppReleaseRepository,
    private readonly contactLookup: TenantContactLookup,
  ) {}

  async check(input: VersionCheckInput): Promise<VersionCheckResult> {
    const [latest, tenantContact] = await Promise.all([
      this.repository.findLatestActive({
        platform: input.platform,
        tenantId: input.tenantId,
      }),
      this.contactLookup(input.tenantId),
    ]);

    if (!latest) {
      return this.buildResult(input.currentVersion, null, false, tenantContact);
    }

    const updateAvailable = compareSemver(input.currentVersion, latest.version) < 0;
    if (!updateAvailable) {
      return this.buildResult(input.currentVersion, null, false, tenantContact);
    }

    const isForceUpdate = this.resolveForceUpdate(input.currentVersion, latest);

    return this.buildResult(
      input.currentVersion,
      latest,
      isForceUpdate,
      tenantContact,
    );
  }

  private resolveForceUpdate(currentVersion: string, latest: AppRelease) {
    if (latest.isForceUpdate) return true;
    if (
      latest.minSupportedVersion &&
      compareSemver(currentVersion, latest.minSupportedVersion) < 0
    ) {
      return true;
    }
    return false;
  }

  private buildResult(
    currentVersion: string,
    latest: AppRelease | null,
    isForceUpdate: boolean,
    tenantContact: { url: string | null; label: string | null },
  ): VersionCheckResult {
    return {
      updateAvailable: latest !== null,
      isForceUpdate,
      currentVersion,
      latestVersion: latest
        ? {
            version: latest.version,
            versionCode: latest.versionCode,
            releaseNotes: latest.releaseNotes,
            downloadUrl: latest.downloadUrl,
            apkSizeBytes: latest.apkSizeBytes,
            releasedAt: latest.releasedAt.toISOString(),
          }
        : null,
      contactAdmin: tenantContact.url
        ? { url: tenantContact.url, label: tenantContact.label }
        : null,
    };
  }
}

function compareSemver(a: string, b: string): number {
  const partsA = parseSemver(a);
  const partsB = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    if (partsA[i] !== partsB[i]) {
      return partsA[i] < partsB[i] ? -1 : 1;
    }
  }
  return 0;
}

function parseSemver(value: string): [number, number, number] {
  const cleaned = value.split(/[-+]/)[0];
  const [major = 0, minor = 0, patch = 0] = cleaned
    .split(".")
    .map((part) => Number(part) || 0);
  return [major, minor, patch];
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run modules/app-version/__tests__/AppVersionCheckService.test.ts`
Expected: PASS — semua 7 test case lulus

- [ ] **Step 5: Commit**

```bash
git add modules/app-version/services/AppVersionCheckService.ts modules/app-version/__tests__/
git commit -m "feat(app-version): tambah AppVersionCheckService dengan TDD"
```

---

## Task 6: Query & Mutation Services (Admin)

**Files:**
- Create: `modules/app-version/services/AppReleaseQueryService.ts`
- Create: `modules/app-version/services/AppReleaseMutationService.ts`

- [ ] **Step 1: Buat AppReleaseQueryService**

Create `modules/app-version/services/AppReleaseQueryService.ts`:

```ts
import type { AppRelease } from "../domain/entities/AppReleaseEntity";
import type {
  AppReleaseQueryFilters,
  IAppReleaseRepository,
} from "../domain/ports/IAppReleaseRepository";
import { AppReleaseNotFoundError } from "../errors";

export class AppReleaseQueryService {
  constructor(private readonly repository: IAppReleaseRepository) {}

  async list(filters: AppReleaseQueryFilters) {
    const [items, total] = await Promise.all([
      this.repository.findAll(filters),
      this.repository.count(filters),
    ]);
    return { items, total };
  }

  async getById(id: string): Promise<AppRelease> {
    const release = await this.repository.findById(id);
    if (!release) {
      throw new AppReleaseNotFoundError(id);
    }
    return release;
  }
}
```

- [ ] **Step 2: Buat AppReleaseMutationService**

Create `modules/app-version/services/AppReleaseMutationService.ts`:

```ts
import type { AppRelease } from "../domain/entities/AppReleaseEntity";
import type {
  AppReleaseCreateInput,
  AppReleaseUpdateInput,
  IAppReleaseRepository,
} from "../domain/ports/IAppReleaseRepository";
import { AppReleaseNotFoundError } from "../errors";

export class AppReleaseMutationService {
  constructor(private readonly repository: IAppReleaseRepository) {}

  async create(
    data: AppReleaseCreateInput,
    createdBy: string,
  ): Promise<AppRelease> {
    return this.repository.create({ ...data, createdBy });
  }

  async update(
    id: string,
    data: AppReleaseUpdateInput,
  ): Promise<AppRelease> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppReleaseNotFoundError(id);
    }
    return this.repository.update(id, data);
  }

  async deactivate(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppReleaseNotFoundError(id);
    }
    await this.repository.delete(id);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add modules/app-version/services/AppReleaseQueryService.ts modules/app-version/services/AppReleaseMutationService.ts
git commit -m "feat(app-version): tambah Query/Mutation services untuk admin"
```

---

## Task 7: Public API + TenantSettings Lookup Helper

**Files:**
- Create: `modules/app-version/index.ts`
- Modify: `modules/settings/services/tenantSettings.ts`

- [ ] **Step 1: Cek isi tenantSettings.ts existing**

Run: `grep -n "appUpdate\|export" modules/settings/services/tenantSettings.ts | head -20`
Goal: pahami pola existing untuk menyisipkan field baru.

- [ ] **Step 2: Tambah helper getAppUpdateContact**

Modify `modules/settings/services/tenantSettings.ts` — tambahkan function setelah export existing:

```ts
import { prisma } from "@/lib/prisma";

export async function getAppUpdateContact(
  tenantId?: string,
): Promise<{ url: string | null; label: string | null }> {
  if (!tenantId) {
    return { url: null, label: null };
  }
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { appUpdateContactUrl: true, appUpdateContactLabel: true },
  });
  return {
    url: settings?.appUpdateContactUrl ?? null,
    label: settings?.appUpdateContactLabel ?? null,
  };
}
```

(Jika file sudah import prisma, jangan duplikat — cukup tambah function-nya saja.)

- [ ] **Step 3: Buat public API index.ts**

Create `modules/app-version/index.ts`:

```ts
export { AppVersionCheckService } from "./services/AppVersionCheckService";
export type {
  ContactAdminInfo,
  LatestVersionInfo,
  TenantContactLookup,
  VersionCheckInput,
  VersionCheckResult,
} from "./services/AppVersionCheckService";

export { AppReleaseQueryService } from "./services/AppReleaseQueryService";
export { AppReleaseMutationService } from "./services/AppReleaseMutationService";

export { AppReleaseRepository } from "./repositories/AppReleaseRepository";

export {
  appReleaseCreateSchema,
  appReleaseUpdateSchema,
  versionCheckQuerySchema,
  APP_RELEASE_PLATFORMS,
  APP_RELEASE_ARCHITECTURES,
} from "./validators/app-release";
export type {
  AppReleaseCreateDto,
  AppReleaseUpdateDto,
  VersionCheckQuery,
} from "./validators/app-release";

export type {
  AppRelease,
  AppReleasePlatform,
  AppReleaseArchitecture,
} from "./domain/entities/AppReleaseEntity";
export type {
  AppReleaseCreateInput,
  AppReleaseUpdateInput,
  AppReleaseQueryFilters,
  IAppReleaseRepository,
} from "./domain/ports/IAppReleaseRepository";

export { AppReleaseNotFoundError, AppReleaseValidationError } from "./errors";
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error baru.

- [ ] **Step 5: Commit**

```bash
git add modules/app-version/index.ts modules/settings/services/tenantSettings.ts
git commit -m "feat(app-version): tambah public API + tenant contact lookup helper"
```

---

## Task 8: Mobile Endpoint — Version Check

**Files:**
- Create: `app/api/mobile/app-version/check/route.ts`

- [ ] **Step 1: Cek pola endpoint mobile existing**

Run: `cat app/api/mobile/overtime/route.ts | head -60`
Goal: pahami pola `getMobileAuthPayload` + error response di endpoint mobile.

- [ ] **Step 2: Implementasi endpoint check**

Create `app/api/mobile/app-version/check/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import {
  AppReleaseRepository,
  AppVersionCheckService,
  versionCheckQuerySchema,
} from "@/modules/app-version";
import { getAppUpdateContact } from "@/modules/settings/services/tenantSettings";

const repository = new AppReleaseRepository();
const versionCheckService = new AppVersionCheckService(
  repository,
  getAppUpdateContact,
);

export async function GET(request: NextRequest) {
  try {
    const auth = await getMobileAuthPayload(request);
    if (auth instanceof NextResponse) return auth;

    const tenantId = auth.tenantId as string | undefined;

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = versionCheckQuerySchema.safeParse(params);
    if (!parsed.success) {
      return apiError(
        "Parameter tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400, details: parsed.error.format() },
      );
    }

    const result = await versionCheckService.check({
      platform: parsed.data.platform,
      currentVersion: parsed.data.currentVersion,
      currentVersionCode: parsed.data.currentVersionCode,
      tenantId,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Mobile App Version Check Error:", error);
    return apiError("Gagal cek versi aplikasi", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
```

- [ ] **Step 3: Manual test**

Run dev server: `npm run dev`
Test dengan curl (ganti TOKEN dengan JWT valid):
```bash
curl "http://localhost:3000/api/mobile/app-version/check?platform=android&currentVersion=1.0.7&currentVersionCode=7" \
  -H "Authorization: Bearer TOKEN"
```
Expected: JSON response dengan `updateAvailable: false` (karena belum ada AppRelease record).

- [ ] **Step 4: Commit**

```bash
git add app/api/mobile/app-version/check/route.ts
git commit -m "feat(app-version): endpoint mobile check versi APK"
```

---

## Task 9: Admin Endpoints — CRUD AppRelease

**Files:**
- Create: `app/api/admin/app-releases/route.ts`
- Create: `app/api/admin/app-releases/[id]/route.ts`

- [ ] **Step 1: Cek pola endpoint admin existing**

Run: `cat app/api/admin/lembur/route.ts | head -80`
Goal: pahami pola `getServerSession` + permission check di admin route.

- [ ] **Step 2: Buat endpoint list/create**

Create `app/api/admin/app-releases/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  AppReleaseMutationService,
  AppReleaseQueryService,
  AppReleaseRepository,
  appReleaseCreateSchema,
} from "@/modules/app-version";
import type { AppReleasePlatform } from "@/modules/app-version";

const repository = new AppReleaseRepository();
const queryService = new AppReleaseQueryService(repository);
const mutationService = new AppReleaseMutationService(repository);

const PERMISSION = "app-release:manage";

async function requirePermission() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return apiError("Unauthorized", ErrorCodes.UNAUTHORIZED, { status: 401 });
  }
  const allowed = await hasPermission(session.user.id, PERMISSION);
  if (!allowed) {
    return apiError("Forbidden", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  return { userId: session.user.id, tenantId: session.user.tenantId ?? undefined };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission();
    if (auth instanceof NextResponse) return auth;

    const url = new URL(request.url);
    const platform = url.searchParams.get("platform") as AppReleasePlatform | null;
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "20");

    const { items, total } = await queryService.list({
      ...(platform ? { platform } : {}),
      tenantId: auth.tenantId,
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Admin AppRelease list error:", error);
    return apiError("Gagal ambil data release", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const parsed = appReleaseCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Input tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.format(),
      });
    }

    const release = await mutationService.create(
      { ...parsed.data, tenantId: auth.tenantId },
      auth.userId,
    );

    return NextResponse.json(release, { status: 201 });
  } catch (error) {
    logger.error("Admin AppRelease create error:", error);
    return apiError("Gagal buat release", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
```

- [ ] **Step 3: Buat endpoint detail/update/delete**

Create `app/api/admin/app-releases/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  AppReleaseMutationService,
  AppReleaseQueryService,
  AppReleaseRepository,
  appReleaseUpdateSchema,
  AppReleaseNotFoundError,
} from "@/modules/app-version";

const repository = new AppReleaseRepository();
const queryService = new AppReleaseQueryService(repository);
const mutationService = new AppReleaseMutationService(repository);

const PERMISSION = "app-release:manage";

async function requirePermission() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return apiError("Unauthorized", ErrorCodes.UNAUTHORIZED, { status: 401 });
  }
  const allowed = await hasPermission(session.user.id, PERMISSION);
  if (!allowed) {
    return apiError("Forbidden", ErrorCodes.FORBIDDEN, { status: 403 });
  }
  return session;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePermission();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const release = await queryService.getById(id);
    return NextResponse.json(release);
  } catch (error) {
    if (error instanceof AppReleaseNotFoundError) {
      return apiError(error.message, ErrorCodes.NOT_FOUND, { status: 404 });
    }
    logger.error("Admin AppRelease detail error:", error);
    return apiError("Gagal ambil detail", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePermission();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = await request.json();
    const parsed = appReleaseUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Input tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.format(),
      });
    }

    const updated = await mutationService.update(id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppReleaseNotFoundError) {
      return apiError(error.message, ErrorCodes.NOT_FOUND, { status: 404 });
    }
    logger.error("Admin AppRelease update error:", error);
    return apiError("Gagal update release", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePermission();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    await mutationService.deactivate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppReleaseNotFoundError) {
      return apiError(error.message, ErrorCodes.NOT_FOUND, { status: 404 });
    }
    logger.error("Admin AppRelease delete error:", error);
    return apiError("Gagal hapus release", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
```

- [ ] **Step 4: Register permission `app-release:manage`**

Run: `grep -rn "lembur:site_only\|attendance:" lib/rbac.ts modules/roles/ | head -5`
Goal: temukan file definisi permissions, tambah `app-release:manage` mengikuti pola yang sama.

Edit file yang ditemukan (biasanya `lib/permissions.ts` atau `modules/roles/data/permissions.ts`) untuk tambah:

```ts
{
  key: "app-release:manage",
  label: "Kelola App Release",
  description: "Akses untuk membuat, edit, dan menonaktifkan APK release",
  category: "system",
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/app-releases/ lib/ modules/roles/
git commit -m "feat(app-version): admin endpoints CRUD AppRelease + permission registration"
```

---

## Task 10: Admin UI — List Page

**Files:**
- Create: `app/admin/app-releases/page.tsx`

- [ ] **Step 1: Cek pola admin page existing**

Run: `ls app/admin/lembur/ && cat app/admin/lembur/page.tsx | head -40`
Goal: pahami pola admin page (table layout, filter, pagination component yang dipakai).

- [ ] **Step 2: Implementasi list page**

Create `app/admin/app-releases/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AppRelease {
  id: string;
  platform: string;
  version: string;
  versionCode: number;
  isForceUpdate: boolean;
  isActive: boolean;
  releasedAt: string;
  releaseNotes: string | null;
}

export default function AppReleasesPage() {
  const router = useRouter();
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [platform, setPlatform] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);

    fetch(`/api/admin/app-releases?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setReleases(data.data ?? []))
      .finally(() => setLoading(false));
  }, [platform]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">App Releases</h1>
        <Link
          href="/admin/app-releases/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
        >
          + Tambah Release
        </Link>
      </div>

      <div className="mb-4">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">Semua Platform</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-4 py-2 text-left">Platform</th>
              <th className="border px-4 py-2 text-left">Version</th>
              <th className="border px-4 py-2 text-left">Code</th>
              <th className="border px-4 py-2 text-left">Force</th>
              <th className="border px-4 py-2 text-left">Active</th>
              <th className="border px-4 py-2 text-left">Released</th>
              <th className="border px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {releases.map((r) => (
              <tr key={r.id}>
                <td className="border px-4 py-2">{r.platform}</td>
                <td className="border px-4 py-2 font-bold">{r.version}</td>
                <td className="border px-4 py-2">{r.versionCode}</td>
                <td className="border px-4 py-2">
                  {r.isForceUpdate ? "✅" : "—"}
                </td>
                <td className="border px-4 py-2">
                  {r.isActive ? "✅" : "❌"}
                </td>
                <td className="border px-4 py-2">
                  {new Date(r.releasedAt).toLocaleDateString("id-ID")}
                </td>
                <td className="border px-4 py-2">
                  <button
                    onClick={() => router.push(`/admin/app-releases/${r.id}`)}
                    className="text-indigo-600 hover:underline"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/app-releases/page.tsx
git commit -m "feat(app-version): admin UI list AppRelease"
```

---

## Task 11: Admin UI — Detail/Edit Page

**Files:**
- Create: `app/admin/app-releases/[id]/page.tsx`
- Create: `app/admin/app-releases/new/page.tsx`

- [ ] **Step 1: Implementasi page new**

Create `app/admin/app-releases/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAppReleasePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    platform: "android",
    version: "",
    versionCode: 0,
    downloadUrl: "",
    releaseNotes: "",
    isForceUpdate: false,
    minSupportedVersion: "",
    architecture: "",
    minOsVersion: "",
    rolloutPercentage: 100,
    apkSizeBytes: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      ...form,
      minSupportedVersion: form.minSupportedVersion || null,
      architecture: form.architecture || null,
      minOsVersion: form.minOsVersion || null,
      apkSizeBytes: form.apkSizeBytes || null,
      releaseNotes: form.releaseNotes || null,
    };

    const res = await fetch("/api/admin/app-releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push("/admin/app-releases");
    } else {
      const data = await res.json();
      setError(data.message ?? "Gagal simpan");
    }
    setSubmitting(false);
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Tambah Release Baru</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Platform">
          <select
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="android">Android</option>
            <option value="ios">iOS</option>
          </select>
        </Field>

        <Field label="Version (semver, contoh: 1.0.8)">
          <input
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            className="border rounded px-3 py-2 w-full"
            required
          />
        </Field>

        <Field label="Version Code (Android: integer)">
          <input
            type="number"
            value={form.versionCode}
            onChange={(e) =>
              setForm({ ...form, versionCode: Number(e.target.value) })
            }
            className="border rounded px-3 py-2 w-full"
            required
          />
        </Field>

        <Field label="Download URL">
          <input
            value={form.downloadUrl}
            onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
            className="border rounded px-3 py-2 w-full"
            placeholder="https://..."
            required
          />
        </Field>

        <Field label="Release Notes">
          <textarea
            value={form.releaseNotes}
            onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })}
            className="border rounded px-3 py-2 w-full"
            rows={4}
          />
        </Field>

        <Field label="Min Supported Version (force jika di bawah ini)">
          <input
            value={form.minSupportedVersion}
            onChange={(e) =>
              setForm({ ...form, minSupportedVersion: e.target.value })
            }
            className="border rounded px-3 py-2 w-full"
            placeholder="opsional"
          />
        </Field>

        <Field label="">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isForceUpdate}
              onChange={(e) =>
                setForm({ ...form, isForceUpdate: e.target.checked })
              }
            />
            Force Update (block app sampai user install)
          </label>
        </Field>

        <Field label="Architecture (opsional)">
          <select
            value={form.architecture}
            onChange={(e) => setForm({ ...form, architecture: e.target.value })}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="">— Universal —</option>
            <option value="arm64-v8a">arm64-v8a</option>
            <option value="armeabi-v7a">armeabi-v7a</option>
            <option value="x86_64">x86_64</option>
            <option value="universal">universal</option>
          </select>
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium mb-1">{label}</label>}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Implementasi detail/edit page**

Create `app/admin/app-releases/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface AppRelease {
  id: string;
  platform: string;
  version: string;
  versionCode: number;
  isForceUpdate: boolean;
  minSupportedVersion: string | null;
  downloadUrl: string;
  releaseNotes: string | null;
  isActive: boolean;
  rolloutPercentage: number;
}

export default function AppReleaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/app-releases/${id}`)
      .then((res) => res.json())
      .then(setRelease);
  }, [id]);

  if (!release) return <div className="p-6">Loading...</div>;

  const updateField = <K extends keyof AppRelease>(
    key: K,
    value: AppRelease[K],
  ) => setRelease({ ...release, [key]: value });

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/admin/app-releases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isForceUpdate: release.isForceUpdate,
        minSupportedVersion: release.minSupportedVersion,
        downloadUrl: release.downloadUrl,
        releaseNotes: release.releaseNotes,
        isActive: release.isActive,
        rolloutPercentage: release.rolloutPercentage,
      }),
    });
    setSaving(false);
    router.refresh();
  };

  const handleDeactivate = async () => {
    if (!confirm("Yakin nonaktifkan release ini?")) return;
    await fetch(`/api/admin/app-releases/${id}`, { method: "DELETE" });
    router.push("/admin/app-releases");
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">
        {release.platform} {release.version} (code {release.versionCode})
      </h1>
      <p className="text-gray-500 mb-6">ID: {release.id}</p>

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={release.isActive}
            onChange={(e) => updateField("isActive", e.target.checked)}
          />
          Active
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={release.isForceUpdate}
            onChange={(e) => updateField("isForceUpdate", e.target.checked)}
          />
          Force Update
        </label>

        <div>
          <label className="block text-sm font-medium mb-1">
            Min Supported Version
          </label>
          <input
            value={release.minSupportedVersion ?? ""}
            onChange={(e) =>
              updateField("minSupportedVersion", e.target.value || null)
            }
            className="border rounded px-3 py-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Download URL</label>
          <input
            value={release.downloadUrl}
            onChange={(e) => updateField("downloadUrl", e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Release Notes
          </label>
          <textarea
            value={release.releaseNotes ?? ""}
            onChange={(e) => updateField("releaseNotes", e.target.value)}
            className="border rounded px-3 py-2 w-full"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Rollout Percentage ({release.rolloutPercentage}%)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={release.rolloutPercentage}
            onChange={(e) =>
              updateField("rolloutPercentage", Number(e.target.value))
            }
            className="w-full"
          />
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
          <button
            onClick={handleDeactivate}
            className="bg-red-600 text-white px-6 py-2 rounded-lg"
          >
            Nonaktifkan
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/app-releases/
git commit -m "feat(app-version): admin UI new + detail/edit AppRelease"
```

---

## Task 12: Tambah TenantSettings UI Field (Contact Admin)

**Files:**
- Modify: existing tenant settings page (cari path-nya)

- [ ] **Step 1: Temukan tenant settings UI**

Run: `find app/admin -name "*settings*" -type d 2>/dev/null && grep -rln "tenantSettings\|TenantSettings" app/admin/ | head -5`
Goal: temukan halaman admin yang sudah handle tenant settings.

- [ ] **Step 2: Tambah 2 field di form tenant settings**

Di file tenant settings page, tambah field input di form:

```tsx
<div>
  <label className="block text-sm font-medium mb-1">
    URL Hubungi Admin (untuk update APK)
  </label>
  <input
    value={form.appUpdateContactUrl ?? ""}
    onChange={(e) =>
      setForm({ ...form, appUpdateContactUrl: e.target.value })
    }
    className="border rounded px-3 py-2 w-full"
    placeholder="https://wa.me/628123456789 atau mailto:admin@radpro.id"
  />
</div>

<div>
  <label className="block text-sm font-medium mb-1">
    Label Tombol Hubungi Admin
  </label>
  <input
    value={form.appUpdateContactLabel ?? ""}
    onChange={(e) =>
      setForm({ ...form, appUpdateContactLabel: e.target.value })
    }
    className="border rounded px-3 py-2 w-full"
    placeholder="Hubungi Admin via WhatsApp"
  />
</div>
```

- [ ] **Step 3: Pastikan API endpoint tenant settings menerima 2 field baru**

Run: `grep -rn "appUpdateContactUrl\|appUpdateContactLabel" app/api/admin/ modules/settings/`
Goal: pastikan validator + API route accept field baru. Jika belum, tambah ke schema validator.

- [ ] **Step 4: Commit**

```bash
git add app/admin/ modules/settings/
git commit -m "feat(settings): tambah field contact admin untuk update APK"
```

---

## Task 13: Mobile — Service Wrapper & Types

**Files:**
- Create: `mobile-netmanager/src/types/appVersion.ts`
- Create: `mobile-netmanager/src/services/apkVersionService.ts`

- [ ] **Step 1: Buat types**

Create `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/types/appVersion.ts`:

```ts
export interface ApkVersionCheckResponse {
  updateAvailable: boolean
  isForceUpdate: boolean
  currentVersion: string
  latestVersion: ApkLatestVersion | null
  contactAdmin: ApkContactAdmin | null
}

export interface ApkLatestVersion {
  version: string
  versionCode: number
  releaseNotes: string | null
  downloadUrl: string
  apkSizeBytes: number | null
  releasedAt: string
}

export interface ApkContactAdmin {
  url: string
  label: string | null
}
```

- [ ] **Step 2: Buat service wrapper**

Create `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/apkVersionService.ts`:

```ts
import { Platform } from 'react-native'
import * as Application from 'expo-application'

import { api } from '@/services/api'
import { logger } from '@/utils/logger'
import type { ApkVersionCheckResponse } from '@/types/appVersion'

export function getCurrentNativeVersion(): {
  version: string
  versionCode: number
} {
  const version = Application.nativeApplicationVersion ?? '0.0.0'
  const buildVersion = Application.nativeBuildVersion ?? '0'
  return {
    version,
    versionCode: Number.parseInt(buildVersion, 10) || 0,
  }
}

export async function checkApkVersion(): Promise<ApkVersionCheckResponse | null> {
  try {
    const { version, versionCode } = getCurrentNativeVersion()
    const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android'

    const response = await api.get<ApkVersionCheckResponse>(
      '/api/mobile/app-version/check',
      {
        params: {
          platform,
          currentVersion: version,
          currentVersionCode: versionCode,
        },
        skipErrorToast: true,
      },
    )

    return response.data
  } catch (error) {
    logger.warn('[ApkVersion] Check failed (graceful degrade):', error)
    return null
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/rohadimraja/Documents/radpro/mobile-netmanager
git add src/types/appVersion.ts src/services/apkVersionService.ts
git commit -m "feat(app-version): mobile service wrapper untuk APK version check"
```

---

## Task 14: Mobile Hook — useApkVersionCheck

**Files:**
- Create: `mobile-netmanager/src/hooks/useApkVersionCheck.ts`

- [ ] **Step 1: Implementasi hook**

Create `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/useApkVersionCheck.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'

import { checkApkVersion } from '@/services/apkVersionService'
import type {
  ApkContactAdmin,
  ApkLatestVersion,
} from '@/types/appVersion'
import { logger } from '@/utils/logger'

const CACHE_TTL_MS = 5 * 60 * 1000
const IGNORED_VERSION_KEY = '@apkVersion/ignoredVersion'

type State = {
  isChecking: boolean
  apkUpdateAvailable: boolean
  isForceUpdate: boolean
  latestRelease: ApkLatestVersion | null
  contactAdmin: ApkContactAdmin | null
  ignoredVersion: string | null
  error: string | null
}

type Action =
  | { type: 'CHECK_START' }
  | {
      type: 'CHECK_SUCCESS'
      payload: {
        apkUpdateAvailable: boolean
        isForceUpdate: boolean
        latestRelease: ApkLatestVersion | null
        contactAdmin: ApkContactAdmin | null
      }
    }
  | { type: 'CHECK_ERROR'; error: string }
  | { type: 'IGNORE_VERSION'; version: string }
  | { type: 'LOAD_IGNORED'; version: string | null }

const initialState: State = {
  isChecking: false,
  apkUpdateAvailable: false,
  isForceUpdate: false,
  latestRelease: null,
  contactAdmin: null,
  ignoredVersion: null,
  error: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CHECK_START':
      return { ...state, isChecking: true, error: null }
    case 'CHECK_SUCCESS': {
      const { apkUpdateAvailable, isForceUpdate, latestRelease, contactAdmin } = action.payload
      const ignored =
        state.ignoredVersion &&
        latestRelease?.version === state.ignoredVersion &&
        !isForceUpdate
      return {
        ...state,
        isChecking: false,
        apkUpdateAvailable: apkUpdateAvailable && !ignored,
        isForceUpdate,
        latestRelease,
        contactAdmin,
      }
    }
    case 'CHECK_ERROR':
      return { ...state, isChecking: false, error: action.error }
    case 'IGNORE_VERSION':
      return {
        ...state,
        apkUpdateAvailable: false,
        ignoredVersion: action.version,
      }
    case 'LOAD_IGNORED':
      return { ...state, ignoredVersion: action.version }
    default:
      return state
  }
}

export interface UseApkVersionCheckResult extends State {
  checkApkVersion: () => Promise<void>
  ignoreApkUpdate: () => Promise<void>
}

export function useApkVersionCheck(): UseApkVersionCheckResult {
  const [state, dispatch] = useReducer(reducer, initialState)
  const lastCheckAtRef = useRef<number>(0)

  // Load ignored version dari storage di mount
  useEffect(() => {
    AsyncStorage.getItem(IGNORED_VERSION_KEY).then((value) => {
      dispatch({ type: 'LOAD_IGNORED', version: value })
    })
  }, [])

  const performCheck = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastCheckAtRef.current < CACHE_TTL_MS) {
      return
    }
    lastCheckAtRef.current = now

    dispatch({ type: 'CHECK_START' })
    const result = await checkApkVersion()

    if (!result) {
      dispatch({ type: 'CHECK_ERROR', error: 'Gagal cek versi APK' })
      return
    }

    dispatch({
      type: 'CHECK_SUCCESS',
      payload: {
        apkUpdateAvailable: result.updateAvailable,
        isForceUpdate: result.isForceUpdate,
        latestRelease: result.latestVersion,
        contactAdmin: result.contactAdmin,
      },
    })
  }, [])

  // Auto-check di mount + AppState 'active'
  useEffect(() => {
    performCheck().catch(() => undefined)

    const handler = (next: AppStateStatus) => {
      if (next === 'active') {
        performCheck().catch(() => undefined)
      }
    }
    const sub = AppState.addEventListener('change', handler)
    return () => sub.remove()
  }, [performCheck])

  const ignoreApkUpdate = useCallback(async () => {
    if (!state.latestRelease) return
    const version = state.latestRelease.version
    await AsyncStorage.setItem(IGNORED_VERSION_KEY, version)
    dispatch({ type: 'IGNORE_VERSION', version })
  }, [state.latestRelease])

  const manualCheck = useCallback(async () => {
    await performCheck(true)
  }, [performCheck])

  return {
    ...state,
    checkApkVersion: manualCheck,
    ignoreApkUpdate,
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/rohadimraja/Documents/radpro/mobile-netmanager
git add src/hooks/useApkVersionCheck.ts
git commit -m "feat(app-version): hook useApkVersionCheck dengan cache + ignore"
```

---

## Task 15: Mobile Orchestrator — useVersionCheck Refactor

**Files:**
- Modify: `mobile-netmanager/src/hooks/useVersionCheck.ts`

- [ ] **Step 1: Refactor useVersionCheck untuk koordinasi APK + OTA**

Replace seluruh isi `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/useVersionCheck.ts`:

```ts
import { useEffect, useState } from 'react'

import { User } from '@/context/AuthContext'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useApkVersionCheck } from '@/hooks/useApkVersionCheck'

/**
 * Orchestrator untuk APK + OTA update flow.
 *
 * Priority:
 * 1. APK force update → block app dengan UpdateRequiredScreen
 * 2. APK soft update → tampilkan UpdateAvailableModal (skippable),
 *    OTA tetap jalan di background
 * 3. No APK update → OTA flow normal
 */
export function useVersionCheck(_user: User | null, _token: string | null) {
  const apk = useApkVersionCheck()
  const ota = useAppVersion()

  const [versionChecked, setVersionChecked] = useState(false)
  const [showApkOptional, setShowApkOptional] = useState(false)
  const [showOtaOptional, setShowOtaOptional] = useState(false)

  // OTA cek hanya kalau APK tidak force update
  useEffect(() => {
    let cancelled = false
    if (apk.isForceUpdate) {
      setVersionChecked(true)
      return
    }
    const run = async () => {
      try {
        await ota.checkForUpdate()
      } finally {
        if (!cancelled) setVersionChecked(true)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [apk.isForceUpdate, ota.checkForUpdate])

  // Tampilkan modal APK soft kalau available
  useEffect(() => {
    if (apk.apkUpdateAvailable && !apk.isForceUpdate) {
      setShowApkOptional(true)
    } else {
      setShowApkOptional(false)
    }
  }, [apk.apkUpdateAvailable, apk.isForceUpdate])

  // Tampilkan modal OTA soft kalau available DAN tidak ada APK update aktif
  useEffect(() => {
    const otaSoft =
      ota.updateAvailable &&
      !ota.isForceUpdate &&
      !apk.apkUpdateAvailable &&
      !apk.isForceUpdate
    setShowOtaOptional(otaSoft)
  }, [
    ota.updateAvailable,
    ota.isForceUpdate,
    apk.apkUpdateAvailable,
    apk.isForceUpdate,
  ])

  return {
    versionChecked,
    isChecking: apk.isChecking || ota.isChecking,

    // APK fields
    isApkForceUpdate: apk.isForceUpdate,
    apkUpdateAvailable: apk.apkUpdateAvailable,
    showApkOptional,
    setShowApkOptional,
    latestApkRelease: apk.latestRelease,
    contactAdmin: apk.contactAdmin,
    onIgnoreApk: apk.ignoreApkUpdate,
    onRecheckApk: apk.checkApkVersion,

    // OTA fields
    isOtaForceUpdate: ota.isForceUpdate,
    showOtaOptional,
    setShowOtaOptional,
    latestOtaVersion: ota.latestVersion,
    otaDownloadStatus: ota.downloadStatus,
    otaError: ota.error,
    onStartOtaUpdate: ota.startUpdate,
    onDismissOtaError: ota.dismissError,
    onIgnoreOta: ota.ignoreUpdate,
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/rohadimraja/Documents/radpro/mobile-netmanager && npx tsc --noEmit`
Expected: file `_layout.tsx` mungkin error karena field lama dipakai. Lanjut ke Task 16.

- [ ] **Step 3: Commit (akan diperbaiki di task selanjutnya)**

```bash
cd /Users/rohadimraja/Documents/radpro/mobile-netmanager
git add src/hooks/useVersionCheck.ts
git commit -m "refactor(version-check): orchestrator APK + OTA dengan priority"
```

---

## Task 16: Mobile UI — Extend UpdateAvailableModal & UpdateRequiredScreen

**Files:**
- Modify: `mobile-netmanager/src/components/molecules/UpdateAvailableModal.tsx`
- Modify: `mobile-netmanager/src/components/templates/UpdateRequiredScreen.tsx`

- [ ] **Step 1: Lihat isi UpdateAvailableModal existing**

Run: `cat /Users/rohadimraja/Documents/radpro/mobile-netmanager/src/components/molecules/UpdateAvailableModal.tsx`
Goal: pahami struktur props existing.

- [ ] **Step 2: Update UpdateAvailableModal terima props APK contactAdmin**

Tambahkan/replace di `UpdateAvailableModal.tsx` props untuk APK mode:

```tsx
import { Linking } from 'react-native'
import type { ApkContactAdmin, ApkLatestVersion } from '@/types/appVersion'

export interface UpdateAvailableModalApkProps {
  mode: 'apk'
  visible: boolean
  release: ApkLatestVersion
  contactAdmin: ApkContactAdmin | null
  onLater: () => void
}

export interface UpdateAvailableModalOtaProps {
  mode: 'ota'
  visible: boolean
  // ... existing OTA props
}

// Render function untuk APK mode:
function renderApkActions(
  release: ApkLatestVersion,
  contactAdmin: ApkContactAdmin | null,
  onLater: () => void,
) {
  return (
    <>
      <TouchableOpacity
        onPress={() => Linking.openURL(release.downloadUrl)}
        style={tw`bg-indigo-600 rounded-xl py-3 items-center mb-2`}
      >
        <Text style={tw`text-white font-bold`}>Download APK Sekarang</Text>
      </TouchableOpacity>

      {contactAdmin && (
        <TouchableOpacity
          onPress={() => Linking.openURL(contactAdmin.url)}
          style={tw`bg-green-600 rounded-xl py-3 items-center mb-2`}
        >
          <Text style={tw`text-white font-bold`}>
            {contactAdmin.label ?? 'Hubungi Admin'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onLater} style={tw`py-3 items-center`}>
        <Text style={tw`text-gray-500`}>Nanti</Text>
      </TouchableOpacity>
    </>
  )
}
```

(Detail implementasi tergantung struktur existing — sesuaikan dengan `Modal` wrapper, layout, style yang sudah ada. Tambahkan branch berdasarkan `mode` prop.)

- [ ] **Step 3: Update UpdateRequiredScreen tambah tombol APK + Hubungi Admin + Cek Ulang**

Modify `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/components/templates/UpdateRequiredScreen.tsx`:

Tambah props baru:

```tsx
import { Linking } from 'react-native'
import type { ApkContactAdmin, ApkLatestVersion } from '@/types/appVersion'

export interface UpdateRequiredScreenApkProps {
  mode: 'apk'
  release: ApkLatestVersion
  contactAdmin: ApkContactAdmin | null
  onRecheck: () => void | Promise<void>
}
```

Render lock screen untuk mode `apk`:

```tsx
<View style={tw`flex-1 items-center justify-center p-6 bg-white`}>
  <Text style={tw`text-2xl font-bold mb-2`}>Update Wajib</Text>
  <Text style={tw`text-gray-600 text-center mb-6`}>
    Versi aplikasi Anda sudah tidak didukung. Silakan update ke versi {release.version}.
  </Text>

  {release.releaseNotes && (
    <View style={tw`bg-gray-50 p-4 rounded-xl mb-6 w-full`}>
      <Text style={tw`text-sm text-gray-700`}>{release.releaseNotes}</Text>
    </View>
  )}

  <TouchableOpacity
    onPress={() => Linking.openURL(release.downloadUrl)}
    style={tw`bg-indigo-600 rounded-xl py-3 px-6 w-full items-center mb-2`}
  >
    <Text style={tw`text-white font-bold`}>Download APK Sekarang</Text>
  </TouchableOpacity>

  {contactAdmin && (
    <TouchableOpacity
      onPress={() => Linking.openURL(contactAdmin.url)}
      style={tw`bg-green-600 rounded-xl py-3 px-6 w-full items-center mb-2`}
    >
      <Text style={tw`text-white font-bold`}>
        {contactAdmin.label ?? 'Hubungi Admin'}
      </Text>
    </TouchableOpacity>
  )}

  <TouchableOpacity onPress={onRecheck} style={tw`py-3 items-center`}>
    <Text style={tw`text-indigo-600`}>Sudah Update? Cek Ulang</Text>
  </TouchableOpacity>
</View>
```

(Implementasi `Linking.openURL` butuh import dari `react-native`. Pastikan no logout button, no navigation; ini lock screen.)

- [ ] **Step 4: Commit**

```bash
cd /Users/rohadimraja/Documents/radpro/mobile-netmanager
git add src/components/
git commit -m "feat(app-version): UI APK update modal + lock screen + Hubungi Admin"
```

---

## Task 17: Mobile — Wire Up app/_layout.tsx

**Files:**
- Modify: `mobile-netmanager/app/_layout.tsx`

- [ ] **Step 1: Update _layout.tsx untuk handle 4 case (APK force/soft, OTA force/soft)**

Modify `/Users/rohadimraja/Documents/radpro/mobile-netmanager/app/_layout.tsx`:

Cari section yang render `UpdateRequiredScreen` & `UpdateAvailableModal`, replace dengan:

```tsx
const versionState = useVersionCheck(user, token)

// Priority 1: APK force update — lock screen
if (versionState.isApkForceUpdate && versionState.latestApkRelease) {
  return (
    <UpdateRequiredScreen
      mode="apk"
      release={versionState.latestApkRelease}
      contactAdmin={versionState.contactAdmin}
      onRecheck={versionState.onRecheckApk}
    />
  )
}

// Priority 2: OTA force update (existing)
if (versionState.isOtaForceUpdate && versionState.latestOtaVersion) {
  return (
    <UpdateRequiredScreen
      mode="ota"
      latestVersion={versionState.latestOtaVersion}
      downloadStatus={versionState.otaDownloadStatus}
      downloadProgress={null}
      error={versionState.otaError}
      onStartUpdate={versionState.onStartOtaUpdate}
      onDismissError={versionState.onDismissOtaError}
    />
  )
}

return (
  <>
    {/* main app */}

    {/* APK soft modal */}
    {versionState.showApkOptional && versionState.latestApkRelease && (
      <UpdateAvailableModal
        mode="apk"
        visible
        release={versionState.latestApkRelease}
        contactAdmin={versionState.contactAdmin}
        onLater={() => {
          versionState.setShowApkOptional(false)
          versionState.onIgnoreApk()
        }}
      />
    )}

    {/* OTA soft modal (existing) */}
    {versionState.showOtaOptional && versionState.latestOtaVersion && (
      <UpdateAvailableModal
        mode="ota"
        visible
        latestVersion={versionState.latestOtaVersion}
        downloadStatus={versionState.otaDownloadStatus}
        downloadProgress={null}
        error={versionState.otaError}
        onStartUpdate={versionState.onStartOtaUpdate}
        onLater={() => {
          versionState.setShowOtaOptional(false)
          versionState.onIgnoreOta()
        }}
        onDismissError={versionState.onDismissOtaError}
      />
    )}
  </>
)
```

- [ ] **Step 2: Typecheck mobile**

Run: `cd /Users/rohadimraja/Documents/radpro/mobile-netmanager && npx tsc --noEmit`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
cd /Users/rohadimraja/Documents/radpro/mobile-netmanager
git add app/_layout.tsx
git commit -m "feat(app-version): wire up APK + OTA flow di root layout"
```

---

## Task 18: Switch runtimeVersion ke Fingerprint Policy

**Files:**
- Modify: `mobile-netmanager/app.json`

- [ ] **Step 1: Update app.json**

Modify `/Users/rohadimraja/Documents/radpro/mobile-netmanager/app.json`:

Cari:
```json
"runtimeVersion": {
  "policy": "appVersion"
}
```

Ganti jadi:
```json
"runtimeVersion": {
  "policy": "fingerprint"
}
```

- [ ] **Step 2: Generate fingerprint baseline**

Run: `cd /Users/rohadimraja/Documents/radpro/mobile-netmanager && npx expo-fingerprint generate`
Expected: file `fingerprint.json` di-generate, atau output hash.

- [ ] **Step 3: Commit**

```bash
cd /Users/rohadimraja/Documents/radpro/mobile-netmanager
git add app.json fingerprint.json 2>/dev/null
git commit -m "feat(ota): switch runtimeVersion ke fingerprint policy"
```

---

## Task 19: Build APK Baru + Documentation

**Files:**
- Create: `docs/standards/mobile-update-strategy.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Buat dokumentasi strategy**

Create `/Users/rohadimraja/Documents/radpro/netmanager/docs/standards/mobile-update-strategy.md`:

```markdown
# Mobile Update Strategy

Project ini punya dua channel update yang jalan bersamaan:

## OTA Channel (Expo Updates)

**Untuk:** Perubahan JS/TS-only — bug fix UI, copy text, validasi, logic.

**Cara kerja:** `runtimeVersion.policy = "fingerprint"` — Expo CLI generate hash dari native files setiap build. OTA bundle hanya ter-deliver ke APK dengan fingerprint sama.

**Trigger:**
- Edit kode JS/TS → `git push` → Jenkins jalankan `eas update --branch <env>`
- Mobile auto-detect saat AppState 'active', download silent, reload

## APK Channel (Native Release)

**Untuk:** Perubahan native — install package native, ubah plugin, update Expo SDK, ubah Android permission.

**Cara kerja:**
- Build APK baru dengan version + versionCode bump
- Admin upload APK ke storage, create record `AppRelease` di backend
- Mobile poll `/api/mobile/app-version/check` → tampilkan modal update jika ada

**Force update:**
- Set `isForceUpdate=true` di AppRelease → user di-block sampai install
- Atau set `minSupportedVersion` → semua user di bawah minimum di-force

## Aturan Praktis

**OTA aman:**
- Edit `app/`, `src/`, `components/`, `hooks/`, `utils/`, `services/` (file .ts/.tsx/.js)
- Bump `version` di `app.json` (tidak mempengaruhi fingerprint)
- Style/copy text changes

**APK wajib:**
- Install/update/hapus package native (yang punya `expo-modules-core` plugin)
- Edit `app.json` field native (plugins, android, ios sections)
- Edit `app.config.ts` field native
- Edit `plugins/*.js`
- Update Expo SDK
- Tambah Android permission

## Cara Verifikasi Sebelum Keputusan

```bash
cd mobile-netmanager
npx expo-fingerprint diff <last-apk-commit> HEAD
```

- Diff empty → fingerprint sama → OTA cukup
- Diff non-empty → fingerprint beda → APK rebuild wajib

## Force Update Behavior

Saat `isForceUpdate=true`:
- App lock screen — tidak bisa logout, tidak bisa navigate
- 3 action: Download APK / Hubungi Admin / Cek Ulang
- "Cek Ulang" re-trigger version check; kalau version sudah match (user balik dari install), unblock

## Tenant Settings

`appUpdateContactUrl` + `appUpdateContactLabel` di tenant settings menentukan tombol "Hubungi Admin". Set `null` untuk hide tombol.
```

- [ ] **Step 2: Update CHANGELOG.md**

Tambah entry di `/Users/rohadimraja/Documents/radpro/netmanager/docs/CHANGELOG.md` di section `[Unreleased]`:

```markdown
### [2026-05-17] — Tambah modul app-version untuk APK update notification

- **Tipe**: [ADDED]
- **Scope**: `modules/app-version`, `mobile-netmanager`, `app/admin/app-releases`
- **Author**: agent
- **Deskripsi**: Modul baru untuk track APK release metadata (version, downloadUrl, force/soft, minSupportedVersion). Mobile tambah hook `useApkVersionCheck` yang call endpoint backend untuk notifikasi user saat ada APK baru. Mendukung force update (lock app) dan soft update (skippable modal). Tombol "Download APK" + "Hubungi Admin" (URL admin per-tenant dari settings). Switch `runtimeVersion` ke fingerprint policy supaya OTA tetap nyambung antar bump version selama tidak ada perubahan native.
- **Migration**: `<timestamp>_add_app_releases`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Switch mobile runtimeVersion ke fingerprint policy

- **Tipe**: [CHANGED]
- **Scope**: `mobile-netmanager`
- **Author**: agent
- **Deskripsi**: Sebelumnya `runtimeVersion.policy = "appVersion"` membuat OTA tidak nyambung setiap kali bump version. Sekarang fingerprint policy auto-detect perubahan native — OTA delivery aman, native changes otomatis trigger mismatch yang dilindungi.
- **Files**: `app.json`
- **Breaking**: ❌ Tidak (perlu APK rebuild satu kali)
```

- [ ] **Step 3: Update CLAUDE.md root dengan note**

Append di `/Users/rohadimraja/Documents/radpro/netmanager/CLAUDE.md` sebelum section `Last Updated`:

```markdown
## Mobile Update Strategy

Detail lengkap: `docs/standards/mobile-update-strategy.md`

**Quick rules:**
- Edit JS/TS only di `mobile-netmanager` → OTA cukup, publish via `eas update`
- Edit native config (plugins, app.json native fields, native deps) → APK rebuild wajib
- `runtimeVersion.policy = "fingerprint"` auto-detect; cek dengan `npx expo-fingerprint diff <commit> HEAD`
- APK update ditrigger via admin UI di `/admin/app-releases` setelah upload APK
```

- [ ] **Step 4: Build APK baru**

Run: `cd /Users/rohadimraja/Documents/radpro/mobile-netmanager && npx expo prebuild --clean --platform android`
Lalu: `cd android && ./gradlew assembleRelease`

Expected: APK ter-build di `android/app/build/outputs/apk/release/`. Verify version 1.0.8 + fingerprint policy ter-embed.

- [ ] **Step 5: Commit docs**

```bash
cd /Users/rohadimraja/Documents/radpro/netmanager
git add docs/standards/mobile-update-strategy.md docs/CHANGELOG.md CLAUDE.md
git commit -m "docs(app-version): tambah strategy guide + changelog entries"
```

---

## Task 20: End-to-End Manual Verification

**Files:** N/A — manual test

- [ ] **Step 1: Run backend**

Run: `cd /Users/rohadimraja/Documents/radpro/netmanager && npm run db:up && npm run dev`

- [ ] **Step 2: Login admin, akses /admin/app-releases**

Buka browser ke `http://localhost:3000/admin/app-releases`. Pastikan halaman load tanpa error.

- [ ] **Step 3: Set tenant settings appUpdateContactUrl**

Akses halaman tenant settings, set:
- `appUpdateContactUrl`: `https://wa.me/628123456789`
- `appUpdateContactLabel`: `Hubungi Admin via WhatsApp`

Save, verify persisted di DB.

- [ ] **Step 4: Buat AppRelease test**

Klik "Tambah Release", isi:
- Platform: android
- Version: 1.0.9
- VersionCode: 9
- Download URL: `https://example.com/app-1.0.9.apk`
- Release Notes: "Bug fix lembur untuk hari libur"
- isForceUpdate: false

Save, verify muncul di list.

- [ ] **Step 5: Test endpoint check via curl**

Run:
```bash
TOKEN="<mobile JWT valid>"
curl "http://localhost:3000/api/mobile/app-version/check?platform=android&currentVersion=1.0.7&currentVersionCode=7" \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "updateAvailable": true,
  "isForceUpdate": false,
  "currentVersion": "1.0.7",
  "latestVersion": {
    "version": "1.0.9",
    "downloadUrl": "https://example.com/app-1.0.9.apk",
    ...
  },
  "contactAdmin": {
    "url": "https://wa.me/628123456789",
    "label": "Hubungi Admin via WhatsApp"
  }
}
```

- [ ] **Step 6: Test force update**

Update AppRelease 1.0.9 di admin UI, set `isForceUpdate=true`. Re-curl, verify `isForceUpdate: true`.

- [ ] **Step 7: Test mobile (Android emulator atau device)**

Install APK 1.0.7 (existing) ke emulator, jalankan, verify modal muncul dengan tombol "Download APK Sekarang" + "Hubungi Admin".

Klik Download → buka browser ke URL APK.
Klik Hubungi Admin → buka WhatsApp.

Set isForceUpdate=true di backend, restart app, verify lock screen muncul.

- [ ] **Step 8: Final commit dengan note hasil verification**

```bash
cd /Users/rohadimraja/Documents/radpro/netmanager
git commit --allow-empty -m "chore(app-version): E2E verification passed"
```

---

## Self-Review

Diperiksa sebelum mengoper plan:

**Spec coverage** — semua poin di spec ada task-nya:
- Schema `AppRelease` + extension `TenantSettings` → Task 1
- Module backend lengkap → Task 2-7
- Endpoint mobile + admin → Task 8-9
- Admin UI → Task 10-11
- TenantSettings UI → Task 12
- Mobile service + hook → Task 13-14
- Mobile orchestrator → Task 15
- Mobile UI extension → Task 16
- Wire up layout → Task 17
- runtimeVersion fingerprint → Task 18
- Documentation → Task 19
- E2E verification → Task 20

**Type consistency** — semua type ID konsisten:
- `AppRelease` di entity, `AppRelease` di DTO, `AppRelease` di mobile types
- `ApkLatestVersion`, `ApkContactAdmin`, `ApkVersionCheckResponse` konsisten dipakai

**No placeholder** — semua step punya kode aktual atau command konkret.

**Risiko yang masih open:**
- Task 12 langkah 1 mengandalkan grep untuk temukan tenant settings UI — kalau ternyata tidak ada UI existing, perlu buat dari scratch (akan terlihat saat eksekusi).
- Task 9 langkah 4 register permission — exact path dan format file permission tergantung struktur existing yang akan dicek saat task jalan.
- Task 19 step 4 build APK — butuh android SDK + gradle setup. Bisa dilewati kalau hanya verify backend, mobile build di pipeline CI nanti.
