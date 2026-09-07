import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Setiap `link` pada notifikasi harus menunjuk rute yang benar-benar ada.
 *
 * Terverifikasi sebelumnya: notifikasi absensi menunjuk `/attendance`, pengingat
 * izin menunjuk `/admin/attendance/leaves/<id>`, notifikasi canvasing menunjuk
 * `/marketing/canvasing/<id>`, dan notifikasi hari libur menunjuk
 * `/employee/holidays` — keempatnya bukan rute yang ada, sehingga pengguna yang
 * menekan notifikasi mendarat di 404. Tidak ada yang memeriksa string itu,
 * jadi pemeriksaannya ditaruh di sini.
 */

const REPO_ROOT = join(__dirname, "..", "..");
const APP_DIR = join(REPO_ROOT, "app");
const SCANNED_DIRS = ["modules", "lib"];
const IGNORED_SEGMENTS = new Set(["node_modules", ".next", "__tests__"]);

/** Segmen grup rute `(customer)` tidak muncul di URL. */
const isRouteGroup = (segment: string) => segment.startsWith("(");
const isDynamicSegment = (segment: string) => segment.startsWith("[");

/** Kumpulkan seluruh pola rute halaman dari direktori `app/`. */
function collectRoutePatterns(dir: string, segments: string[] = []): string[] {
  const patterns: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);

    if (entry === "page.tsx" || entry === "page.ts") {
      patterns.push("/" + segments.join("/"));
      continue;
    }

    if (!statSync(fullPath).isDirectory()) continue;
    if (IGNORED_SEGMENTS.has(entry)) continue;

    patterns.push(
      ...collectRoutePatterns(
        fullPath,
        isRouteGroup(entry) ? segments : [...segments, entry],
      ),
    );
  }

  return patterns;
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    if (IGNORED_SEGMENTS.has(entry)) continue;
    const fullPath = join(dir, entry);

    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

const LINK_PATTERN = /\blink:\s*(?:"([^"]+)"|`([^`]+)`)/g;

interface NotificationLink {
  file: string;
  link: string;
}

function collectNotificationLinks(): NotificationLink[] {
  const links: NotificationLink[] = [];

  for (const dir of SCANNED_DIRS) {
    for (const file of collectSourceFiles(join(REPO_ROOT, dir))) {
      const source = readFileSync(file, "utf8");

      for (const match of source.matchAll(LINK_PATTERN)) {
        const link = match[1] ?? match[2] ?? "";
        if (link.startsWith("/")) {
          links.push({ file: relative(REPO_ROOT, file), link });
        }
      }
    }
  }

  return links;
}

/** Ubah `/admin/x/${id}?tab=1` menjadi bentuk segmen yang bisa dicocokkan. */
function toComparableSegments(link: string): string[] {
  return link
    .split("?")[0]!
    .split("#")[0]!
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.includes("${") ? "[param]" : segment));
}

function matchesRoute(linkSegments: string[], routePattern: string): boolean {
  const routeSegments = routePattern.split("/").filter(Boolean);
  if (routeSegments.length !== linkSegments.length) return false;

  return routeSegments.every((routeSegment, index) => {
    const linkSegment = linkSegments[index]!;
    if (isDynamicSegment(routeSegment)) return true;
    return routeSegment === linkSegment;
  });
}

const routePatterns = collectRoutePatterns(APP_DIR);
const notificationLinks = collectNotificationLinks();

describe("tautan notifikasi menunjuk rute yang ada", () => {
  it("menemukan rute aplikasi untuk diperiksa", () => {
    expect(routePatterns.length).toBeGreaterThan(50);
  });

  it("menemukan tautan notifikasi untuk diperiksa", () => {
    expect(notificationLinks.length).toBeGreaterThan(5);
  });

  it("setiap tautan cocok dengan satu rute", () => {
    const broken = notificationLinks.filter(({ link }) => {
      const segments = toComparableSegments(link);
      if (segments.length === 0) return false; // "/" selalu ada

      return !routePatterns.some((pattern) => matchesRoute(segments, pattern));
    });

    expect(
      broken.map(({ file, link }) => `${link} (${file})`),
      "tautan notifikasi menunjuk rute yang tidak ada",
    ).toEqual([]);
  });
});
