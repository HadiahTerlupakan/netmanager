# Sidebar Logo Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah tampilan logo sidebar agar tidak lagi terlihat bulat/dekoratif, tetap proporsional untuk logo tenant, dan menghilangkan warning `Image fill`.

**Architecture:** Perubahan dibatasi pada komponen `SidebarBrandingLogo` yang sudah dipakai bersama oleh sidebar admin dan employee. Pendekatannya adalah TDD: perbarui ekspektasi test komponen terlebih dahulu, lalu ubah wrapper image menjadi kotak rounded halus dengan parent `relative` dan `object-contain`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, next/image

---

## File Structure

- Modify: `components/layout/SidebarBrandingLogo.tsx` — sumber utama tampilan logo sidebar
- Test: `tests/components/layout/SidebarBrandingLogo.test.tsx` — verifikasi markup image/fallback tetap sesuai
- Verify only: `components/layout/Sidebar.tsx` — kontrak pemanggilan tetap sama, tidak diubah
- Verify only: `components/layout/EmployeeSidebar.tsx` — ikut memakai komponen bersama, tidak diubah

### Task 1: Update component test for the new logo container

**Files:**
- Modify: `tests/components/layout/SidebarBrandingLogo.test.tsx:7-25`
- Test: `tests/components/layout/SidebarBrandingLogo.test.tsx`

- [ ] **Step 1: Write the failing test**

Ganti isi file test menjadi:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SidebarBrandingLogo } from "@/components/layout/SidebarBrandingLogo";

describe("SidebarBrandingLogo", () => {
  it("renders logo inside a rounded square relative container when logoUrl is provided", () => {
    const markup = renderToStaticMarkup(
      <SidebarBrandingLogo appName="NetManager" logoUrl="/uploads/logo.png" />,
    );

    expect(markup).toContain("relative h-10 w-10 overflow-hidden rounded-xl");
    expect(markup).toContain("<img");
    expect(markup).toContain('alt="NetManager logo"');
    expect(markup).toContain("/_next/image?url=%2Fuploads%2Flogo.png");
    expect(markup).toContain('data-nimg="fill"');
    expect(markup).toContain("object-contain");
  });

  it("renders monogram fallback when logoUrl is empty", () => {
    const markup = renderToStaticMarkup(
      <SidebarBrandingLogo appName="NetManager" logoUrl={null} />,
    );

    expect(markup).not.toContain("<img");
    expect(markup).toContain(">N<");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/components/layout/SidebarBrandingLogo.test.tsx`
Expected: FAIL karena class container baru (`relative h-10 w-10 overflow-hidden rounded-xl`) dan `object-contain` belum ada di komponen.

- [ ] **Step 3: Commit**

```bash
git add tests/components/layout/SidebarBrandingLogo.test.tsx
git commit -m "test: cover square sidebar branding logo container"
```

### Task 2: Implement the square rounded logo container

**Files:**
- Modify: `components/layout/SidebarBrandingLogo.tsx:18-39`
- Test: `tests/components/layout/SidebarBrandingLogo.test.tsx`

- [ ] **Step 1: Write minimal implementation**

Ubah komponen menjadi:

```tsx
import Image from "next/image";

type SidebarBrandingLogoProps = {
  appName: string;
  logoUrl?: string | null;
};

function getMonogram(appName: string): string {
  const trimmedName = appName.trim();

  if (!trimmedName) {
    return "N";
  }

  return trimmedName.charAt(0).toUpperCase();
}

/** Menampilkan logo aplikasi pada header sidebar dengan fallback monogram. */
export function SidebarBrandingLogo({
  appName,
  logoUrl,
}: SidebarBrandingLogoProps) {
  const monogram = getMonogram(appName);

  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700 shrink-0">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${appName} logo`}
          fill
          sizes="40px"
          className="object-contain p-1.5"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-linear-to-tr from-indigo-600 to-violet-500 text-white">
          <span className="font-bold text-xl">{monogram}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test:run -- tests/components/layout/SidebarBrandingLogo.test.tsx`
Expected: PASS

- [ ] **Step 3: Run typecheck to verify integration stays valid**

Run: `npm run typecheck`
Expected: exit code 0 dan `Types generated successfully`

- [ ] **Step 4: Commit**

```bash
git add components/layout/SidebarBrandingLogo.tsx tests/components/layout/SidebarBrandingLogo.test.tsx
git commit -m "fix: use rounded square sidebar branding logo"
```

### Task 3: Verify the sidebar consumers and runtime behavior

**Files:**
- Verify only: `components/layout/Sidebar.tsx:346-348`
- Verify only: `components/layout/EmployeeSidebar.tsx:318-320`
- Verify only: `components/layout/SidebarBrandingLogo.tsx`

- [ ] **Step 1: Confirm both sidebars still use the shared branding component**

Check these lines still call the shared component:

```tsx
<SidebarBrandingLogo appName={appName} logoUrl={logoUrl} />
```

- [ ] **Step 2: Start the dev server if it is not already running**

Run: `npm run dev`
Expected: server tersedia di `http://localhost:3000`

- [ ] **Step 3: Open the admin sidebar and verify the visual result**

Manual check:
- logo tampil kotak rounded halus, tidak terasa bulet/dekoratif
- logo tenant tidak terpotong
- fallback monogram tetap center saat logo kosong
- warning `Image with src ... has "fill" and parent element with invalid "position"` tidak muncul lagi

- [ ] **Step 4: Verify employee sidebar uses the same shape**

Manual check:
- employee sidebar mewarisi tampilan logo yang sama
- tidak ada pergeseran layout header sidebar

- [ ] **Step 5: Commit**

```bash
git add components/layout/SidebarBrandingLogo.tsx tests/components/layout/SidebarBrandingLogo.test.tsx
git commit -m "test: verify sidebar branding logo layout"
```
