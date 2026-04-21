# Logo Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan slot logo khusus landing page yang dikelola dari menu logo admin tanpa mengubah penggunaan logo aplikasi di area internal.

**Architecture:** Perubahan mengikuti alur settings yang sudah ada: validasi request di route, orchestration di service `logoSettings`, dan konsumsi branding public lewat `getPublicPortalSettings()`. Slot baru `LOGO_LANDING_PAGE` ditambahkan ke kontrak admin dan public, lalu `app/page.tsx` memakai field baru itu dengan fallback ke logo default bawaan.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Vitest, settings service modular monolith.

---

## File Structure

### Modify
- `lib/validations/settings.ts` — tambah nilai `landing` ke `logoTypeSchema`.
- `modules/settings/services/logoSettings.ts` — tambah key setting, payload, deskripsi, dan penamaan file untuk logo landing page.
- `app/api/settings/logo/route.ts` — perluas mapping `type` ke key log aktivitas dan payload response tetap konsisten.
- `app/admin/pengaturan/logo/LogoSettingsClient.tsx` — tambah blok UI, state, preview, upload, dan delete untuk logo landing page.
- `modules/settings/services/publicPortalSettings.ts` — expose `landingLogoUrl` ke payload public.
- `app/api/settings/public/route.ts` — teruskan `landingLogoUrl` ke response API public.
- `app/page.tsx` — ganti sumber logo landing page dari `appLogoUrl` ke `landingLogoUrl` dengan fallback default.
- `tests/modules/settings/logoSettings.test.ts` — tambah cakupan untuk key dan payload `LOGO_LANDING_PAGE`.
- `tests/api/settings-logo-route.test.ts` — tambah cakupan upload/delete/read untuk type `landing`.
- `tests/modules/settings/publicPortalSettings.test.ts` — tambah cakupan `landingLogoUrl`.
- `tests/api/settings-public-route.test.ts` — tambah kontrak response `landingLogoUrl`.

### Verify existing behavior remains unchanged
- `app/(customer)/login/page.tsx` — tidak diubah; tetap pakai `appLogoUrl`.
- `app/kebijakan-privasi/PrivacyPolicyPageClient.tsx` — tidak diubah; tetap pakai `appLogoUrl`.

## Task 1: Perluas kontrak tipe logo dan service settings

**Files:**
- Modify: `lib/validations/settings.ts:3`
- Modify: `modules/settings/services/logoSettings.ts:7-174`
- Test: `tests/modules/settings/logoSettings.test.ts`

- [ ] **Step 1: Write failing service test for landing page payload and upload**

```ts
it("mengambil logo settings termasuk logo landing page", async () => {
  vi.mocked(SettingsRepository.findManyByKeys).mockResolvedValue([
    {
      key: "LOGO_APLIKASI",
      value: "/uploads/logos/logo-aplikasi.png",
      encrypted: false,
    },
    {
      key: "LOGO_INVOICE",
      value: "/uploads/logos/logo-invoice.png",
      encrypted: false,
    },
    {
      key: "LOGO_LANDING_PAGE",
      value: "/uploads/logos/logo-landing-page.png",
      encrypted: false,
    },
  ]);

  await expect(getLogoSettings()).resolves.toEqual({
    logoInvoice: "/uploads/logos/logo-invoice.png",
    logoAplikasi: "/uploads/logos/logo-aplikasi.png",
    logoLandingPage: "/uploads/logos/logo-landing-page.png",
  });

  expect(SettingsRepository.findManyByKeys).toHaveBeenCalledWith(
    ["LOGO_INVOICE", "LOGO_APLIKASI", "LOGO_LANDING_PAGE"],
    "tenant-1",
  );
});

it("menyimpan logo landing page tenant dengan key dan deskripsi baru", async () => {
  const file = new File(["logo"], "landing.png", { type: "image/png" });

  mockSaveFile.mockResolvedValue(
    "https://cdn.example.com/uploads/logos/logo-landing-page.png",
  );
  mockAccess.mockRejectedValue(
    Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
  );

  await expect(uploadLogo("landing", file)).resolves.toBe(
    "https://cdn.example.com/uploads/logos/logo-landing-page.png",
  );

  expect(SettingsRepository.findManyByKeys).toHaveBeenCalledWith(
    ["LOGO_LANDING_PAGE"],
    "tenant-1",
  );
  expect(mockSaveFile).toHaveBeenCalledWith(
    file,
    expect.stringContaining("public/uploads/logos"),
    "logo-landing-page.png",
    "logos",
  );
  expect(SettingsRepository.upsertMany).toHaveBeenCalledWith([
    {
      key: "LOGO_LANDING_PAGE",
      value: "https://cdn.example.com/uploads/logos/logo-landing-page.png",
      description: "Logo khusus landing page",
      encrypted: false,
      tenantId: "tenant-1",
    },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/modules/settings/logoSettings.test.ts`
Expected: FAIL karena `logoLandingPage` belum ada di payload dan `uploadLogo("landing", ...)` belum didukung.

- [ ] **Step 3: Extend validation and service implementation**

```ts
// lib/validations/settings.ts
export const logoTypeSchema = z.enum(["invoice", "aplikasi", "landing"]);
```

```ts
// modules/settings/services/logoSettings.ts
export type LogoType = "invoice" | "aplikasi" | "landing";

export type LogoSettingsPayload = {
  logoInvoice: string | null;
  logoAplikasi: string | null;
  logoLandingPage: string | null;
};

const LOGO_SETTINGS_KEYS = [
  "LOGO_INVOICE",
  "LOGO_APLIKASI",
  "LOGO_LANDING_PAGE",
] as const;

function getSettingKey(type: LogoType): (typeof LOGO_SETTINGS_KEYS)[number] {
  if (type === "invoice") {
    return "LOGO_INVOICE";
  }

  if (type === "landing") {
    return "LOGO_LANDING_PAGE";
  }

  return "LOGO_APLIKASI";
}

function getSettingDescription(type: LogoType): string {
  if (type === "invoice") {
    return "Logo untuk invoice";
  }

  if (type === "landing") {
    return "Logo khusus landing page";
  }

  return "Logo utama aplikasi";
}

export async function getLogoSettings(
  tenantId?: string | null,
): Promise<LogoSettingsPayload> {
  const activeTenantId = await resolveActiveTenantId(tenantId);
  const records = await SettingsRepository.findManyByKeys(
    LOGO_SETTINGS_KEYS,
    activeTenantId,
  );
  const settingsMap = new Map(records.map((record) => [record.key, record.value]));

  return {
    logoInvoice: settingsMap.get("LOGO_INVOICE") || null,
    logoAplikasi: settingsMap.get("LOGO_APLIKASI") || null,
    logoLandingPage: settingsMap.get("LOGO_LANDING_PAGE") || null,
  };
}

const fileNameByType: Record<LogoType, string> = {
  invoice: "logo-invoice",
  aplikasi: "logo-aplikasi",
  landing: "logo-landing-page",
};

const fileName = fileNameByType[type];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/modules/settings/logoSettings.test.ts`
Expected: PASS untuk semua test di file.

- [ ] **Step 5: Commit**

```bash
git add lib/validations/settings.ts modules/settings/services/logoSettings.ts tests/modules/settings/logoSettings.test.ts
git commit -m "feat: add landing page logo settings"
```

## Task 2: Perluas route admin logo untuk type landing

**Files:**
- Modify: `app/api/settings/logo/route.ts:25-98`
- Test: `tests/api/settings-logo-route.test.ts`

- [ ] **Step 1: Write failing route tests for landing type**

```ts
it("reads landing page logo in logo settings response", async () => {
  mockGetLogoSettings.mockResolvedValue({
    logoInvoice: "/uploads/logos/logo-invoice.png",
    logoAplikasi: "/uploads/logos/logo-aplikasi.png",
    logoLandingPage: "/uploads/logos/logo-landing-page.png",
  });

  const result = await GET(
    new NextRequest("http://localhost/api/settings/logo"),
    { session: { user: { tenantId: "tenant-1" } } } as never,
  );

  expect(result).toEqual({
    logoInvoice: "/uploads/logos/logo-invoice.png",
    logoAplikasi: "/uploads/logos/logo-aplikasi.png",
    logoLandingPage: "/uploads/logos/logo-landing-page.png",
  });
});

it("uploads landing page logo using tenant id from session", async () => {
  mockUploadLogo.mockResolvedValue("/uploads/logos/logo-landing-page.png");
  const file = new File(["logo"], "landing.png", { type: "image/png" });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "landing");

  const request = new NextRequest("http://localhost/api/settings/logo", {
    method: "POST",
    body: formData,
  });

  const result = await POST(request, {
    session: { user: { id: "user-1", tenantId: "tenant-1" } },
  } as never);

  expect(mockUploadLogo).toHaveBeenCalledWith(
    "landing",
    expect.objectContaining({ name: "landing.png", type: "image/png" }),
    "tenant-1",
  );
  expect(result).toEqual({
    success: true,
    logoPath: "/uploads/logos/logo-landing-page.png",
  });
});

it("deletes landing page logo using tenant id from session", async () => {
  mockDeleteLogo.mockResolvedValue(undefined);

  const request = new NextRequest("http://localhost/api/settings/logo", {
    method: "DELETE",
    body: JSON.stringify({ type: "landing" }),
    headers: { "Content-Type": "application/json" },
  });

  const result = await DELETE(request, {
    session: { user: { id: "user-1", tenantId: "tenant-1" } },
    validated: { type: "landing" },
  } as never);

  expect(mockDeleteLogo).toHaveBeenCalledWith("landing", "tenant-1");
  expect(result).toEqual({ success: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/api/settings-logo-route.test.ts`
Expected: FAIL karena kontrak route belum memasukkan `logoLandingPage` dan mapping `landing` belum ada.

- [ ] **Step 3: Update route mapping for landing type**

```ts
const settingKey =
  type === "invoice"
    ? "LOGO_INVOICE"
    : type === "landing"
      ? "LOGO_LANDING_PAGE"
      : "LOGO_APLIKASI";
```

Gunakan mapping yang sama pada handler `POST` dan `DELETE` agar activity log menyimpan key yang benar.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/api/settings-logo-route.test.ts`
Expected: PASS untuk semua test di file.

- [ ] **Step 5: Commit**

```bash
git add app/api/settings/logo/route.ts tests/api/settings-logo-route.test.ts
git commit -m "feat: support landing page logo in admin api"
```

## Task 3: Tambah kontrak public branding untuk landing page

**Files:**
- Modify: `modules/settings/services/publicPortalSettings.ts:4-28`
- Modify: `app/api/settings/public/route.ts:14-21`
- Test: `tests/modules/settings/publicPortalSettings.test.ts`
- Test: `tests/api/settings-public-route.test.ts`

- [ ] **Step 1: Write failing tests for public landing logo contract**

```ts
// tests/modules/settings/publicPortalSettings.test.ts
expect(result).toEqual({
  namaAplikasi: "Global Radpro",
  perusahaan: "PT Rad Pro",
  appLogoUrl: "/uploads/global-logo.png",
  landingLogoUrl: "/uploads/logo-landing-page.png",
  logoInvoice: "/uploads/logo-invoice.png",
});
```

Tambahkan record baru ke mock repository:

```ts
{
  key: "LOGO_LANDING_PAGE",
  value: "/uploads/logo-landing-page.png",
  encrypted: false,
}
```

Dan ubah signature keys yang diharapkan menjadi:

```ts
"GENERAL_PERUSAHAAN,LOGO_INVOICE,LOGO_LANDING_PAGE"
```

```ts
// tests/api/settings-public-route.test.ts
expect(payload).toEqual({
  success: true,
  data: {
    namaAplikasi: "NetManager",
    perusahaan: "PT Radpro",
    appLogoUrl: "/uploads/logo-app.png",
    landingLogoUrl: "/uploads/logo-landing-page.png",
    logoInvoice: "/uploads/logo-invoice.png",
  },
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- tests/modules/settings/publicPortalSettings.test.ts tests/api/settings-public-route.test.ts`
Expected: FAIL karena service dan route public belum expose `landingLogoUrl`.

- [ ] **Step 3: Extend service and API response**

```ts
// modules/settings/services/publicPortalSettings.ts
const PUBLIC_SETTINGS_KEYS = [
  "GENERAL_PERUSAHAAN",
  "LOGO_INVOICE",
  "LOGO_LANDING_PAGE",
] as const;

export type PublicPortalSettingsPayload = {
  namaAplikasi: string;
  perusahaan: string;
  appLogoUrl: string;
  landingLogoUrl: string | null;
  logoInvoice: string | null;
};

return {
  namaAplikasi: branding.appName,
  perusahaan: settingsMap.get("GENERAL_PERUSAHAAN") || "",
  appLogoUrl: branding.appLogoUrl,
  landingLogoUrl: settingsMap.get("LOGO_LANDING_PAGE") || null,
  logoInvoice: settingsMap.get("LOGO_INVOICE") || null,
};
```

```ts
// app/api/settings/public/route.ts
return NextResponse.json({
  success: true,
  data: {
    namaAplikasi: settings.namaAplikasi,
    perusahaan: settings.perusahaan,
    appLogoUrl: settings.appLogoUrl,
    landingLogoUrl: settings.landingLogoUrl,
    logoInvoice: settings.logoInvoice,
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- tests/modules/settings/publicPortalSettings.test.ts tests/api/settings-public-route.test.ts`
Expected: PASS untuk kedua file test.

- [ ] **Step 5: Commit**

```bash
git add modules/settings/services/publicPortalSettings.ts app/api/settings/public/route.ts tests/modules/settings/publicPortalSettings.test.ts tests/api/settings-public-route.test.ts
git commit -m "feat: expose landing page logo in public branding"
```

## Task 4: Tambah UI admin untuk Logo Landing Page

**Files:**
- Modify: `app/admin/pengaturan/logo/LogoSettingsClient.tsx:7-369`

- [ ] **Step 1: Write failing UI behavior note and targeted assertions**

Tambahkan type state baru di file agar komponen wajib memuat properti berikut:

```ts
type LogoSettings = {
  logoInvoice: string | null
  logoAplikasi: string | null
  logoLandingPage: string | null
}
```

Tambahkan state preview baru:

```ts
const [previewLandingPage, setPreviewLandingPage] = useState<string | null>(null)
const fileInputLandingPageRef = useRef<HTMLInputElement>(null)
```

Jika project sudah punya test UI untuk halaman ini, tambahkan assertion label baru `Logo Landing Page`. Jika belum ada, verifikasi task ini lewat typecheck dan manual browser check di Task 6.

- [ ] **Step 2: Run focused verification to catch current failure**

Run: `npm run typecheck`
Expected: setelah type baru dipakai di test/contract lain, file ini belum memenuhi shape `logoLandingPage`.

- [ ] **Step 3: Add landing page block with existing interaction pattern**

```tsx
const [settings, setSettings] = useState<LogoSettings>({
  logoInvoice: null,
  logoAplikasi: null,
  logoLandingPage: null,
})
```

```tsx
setSettings({
  logoInvoice: data.logoInvoice || null,
  logoAplikasi: data.logoAplikasi || null,
  logoLandingPage: data.logoLandingPage || null,
})
setPreviewLandingPage(data.logoLandingPage || null)
```

```tsx
if (type === 'landing') {
  setSettings((prev) => ({ ...prev, logoLandingPage: data.logoPath }))
  setPreviewLandingPage(data.logoPath)
  return
}
```

```tsx
if (type === 'landing') {
  setSettings((prev) => ({ ...prev, logoLandingPage: null }))
  setPreviewLandingPage(null)
  return
}
```

Tambahkan blok UI ketiga dengan struktur yang sama seperti dua blok existing, tetapi label dan deskripsinya:

```tsx
<h3 className="text-md font-semibold text-gray-900 dark:text-white mb-1">
  Logo Landing Page
</h3>
<p className="text-sm text-gray-600 dark:text-gray-400">
  Logo yang akan ditampilkan pada landing page public. Format yang didukung: PNG, JPG, JPEG (maksimal 5MB)
</p>
```

Gunakan `type="landing"` pada `handleFileSelect` dan `handleRemoveLogo`.

- [ ] **Step 4: Run typecheck to verify UI compiles**

Run: `npm run typecheck`
Expected: PASS atau hanya menampilkan error unrelated yang sudah ada sebelumnya. Jika ada blocker baru dari file ini, selesaikan sebelum lanjut.

- [ ] **Step 5: Commit**

```bash
git add app/admin/pengaturan/logo/LogoSettingsClient.tsx
git commit -m "feat: add landing page logo section in settings"
```

## Task 5: Integrasikan landing page public ke logo baru

**Files:**
- Modify: `app/page.tsx:62-121`

- [ ] **Step 1: Write failing assertion for landing page branding source**

Tambahkan verifikasi di test yang relevan bila sudah ada untuk `app/page.tsx`. Jika belum ada test server component untuk halaman ini, buat catatan verifikasi manual berikut sebagai acceptance check:

- saat `landingLogoUrl` tersedia, prop `brandingLogoUrl` yang dikirim ke `LandingPage` harus memakai nilai itu
- saat `landingLogoUrl` kosong, fallback ke `DEFAULT_PUBLIC_APP_LOGO_URL`
- `brandingName` tetap dari `namaAplikasi`

- [ ] **Step 2: Run existing related tests or typecheck to confirm current gap**

Run: `npm run typecheck`
Expected: belum ada kegagalan otomatis, tetapi implementasi masih memakai `appLogoUrl`.

- [ ] **Step 3: Update landing page logo resolution**

```ts
try {
  const branding = await getPublicPortalSettings();
  brandingName = branding.namaAplikasi || DEFAULT_PUBLIC_APP_NAME;
  brandingLogoUrl =
    branding.landingLogoUrl || DEFAULT_PUBLIC_APP_LOGO_URL;
} catch {
  // gunakan fallback publik default
}
```

Jangan ubah file berikut:
- `app/(customer)/login/page.tsx`
- `app/kebijakan-privasi/PrivacyPolicyPageClient.tsx`

- [ ] **Step 4: Run typecheck to verify integration compiles**

Run: `npm run typecheck`
Expected: PASS atau hanya menampilkan blocker unrelated yang sudah ada sebelum task ini.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: use dedicated logo for landing page"
```

## Task 6: Verifikasi end-to-end perubahan logo landing page

**Files:**
- Verify: `app/admin/pengaturan/logo/LogoSettingsClient.tsx`
- Verify: `app/page.tsx`
- Verify: `app/api/settings/logo/route.ts`
- Verify: `app/api/settings/public/route.ts`

- [ ] **Step 1: Run focused automated test suite**

Run: `npm run test:run -- tests/modules/settings/logoSettings.test.ts tests/api/settings-logo-route.test.ts tests/modules/settings/publicPortalSettings.test.ts tests/api/settings-public-route.test.ts`
Expected: PASS.

- [ ] **Step 2: Start dev server for manual UI verification**

Run: `npm run dev`
Expected: dev server aktif di `http://localhost:3000`.

- [ ] **Step 3: Verify admin logo settings UI in browser**

Manual checks:
- buka `http://localhost:3000/admin/pengaturan/logo`
- pastikan ada tiga blok: `Logo Invoice`, `Logo Aplikasi`, `Logo Landing Page`
- upload logo landing page baru
- pastikan preview slot landing page berubah
- hapus logo landing page
- pastikan preview slot landing page kembali kosong tanpa mengubah dua slot lain

- [ ] **Step 4: Verify public landing page behavior in browser**

Manual checks:
- isi `Logo Landing Page`, lalu buka `http://localhost:3000/`
- pastikan landing page menampilkan logo landing page
- kosongkan `Logo Landing Page`
- refresh landing page
- pastikan fallback ke logo default bawaan berjalan
- cek sidebar/header internal tetap memakai `Logo Aplikasi`

- [ ] **Step 5: Run final check**

Run: `npm run typecheck`
Expected: PASS atau hanya blocker unrelated yang sudah diketahui sebelumnya.

- [ ] **Step 6: Commit**

```bash
git add app/admin/pengaturan/logo/LogoSettingsClient.tsx app/api/settings/logo/route.ts app/api/settings/public/route.ts app/page.tsx lib/validations/settings.ts modules/settings/services/logoSettings.ts modules/settings/services/publicPortalSettings.ts tests/modules/settings/logoSettings.test.ts tests/api/settings-logo-route.test.ts tests/modules/settings/publicPortalSettings.test.ts tests/api/settings-public-route.test.ts
git commit -m "feat: add dedicated landing page logo"
```

## Self-Review

- Spec coverage lengkap: slot setting baru, UI admin tiga blok, kontrak public, integrasi `app/page.tsx`, fallback default, dan verifikasi non-regression area internal semuanya punya task.
- Placeholder scan selesai: tidak ada `TODO`, `TBD`, atau referensi samar tanpa file/command.
- Type consistency aman: nama properti konsisten `logoLandingPage` di admin payload dan `landingLogoUrl` di public payload; `type` request konsisten `landing`.
