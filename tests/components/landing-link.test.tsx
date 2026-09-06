// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isExternalHref,
  LandingLink,
} from "@/components/landing/landing-buttons";

/**
 * Regresi: klik "Masuk" di landing berakhir di apex, bukan di host portal.
 *
 * `next/link` menangkap klik dan menjalankan navigasi klien ke path yang sama
 * pada origin yang sedang dibuka, sehingga host pada tautan lintas subdomain
 * ikut hilang. Terverifikasi di produksi: klik tautan
 * `https://admin.radpro.id/login` menghasilkan permintaan `?_rsc=` ke
 * `https://radpro.id/admin/login` dan berhenti di sana.
 */

const ADMIN_LOGIN_URL = "https://admin.radpro.id/login";

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("isExternalHref", () => {
  it("menganggap URL absolut sebagai eksternal", () => {
    expect(isExternalHref(ADMIN_LOGIN_URL)).toBe(true);
  });

  it("menganggap mailto dan jangkar sebagai eksternal", () => {
    expect(isExternalHref("mailto:sales@radpro.id")).toBe(true);
    expect(isExternalHref("#features")).toBe(true);
  });

  it("menganggap path internal bukan eksternal", () => {
    expect(isExternalHref("/kebijakan-privasi")).toBe(false);
  });
});

describe("LandingLink", () => {
  it("merender tautan lintas host sebagai anchor biasa dengan href utuh", async () => {
    await act(async () => {
      root.render(<LandingLink href={ADMIN_LOGIN_URL}>Masuk</LandingLink>);
    });

    const anchor = container.querySelector("a");

    expect(anchor?.getAttribute("href")).toBe(ADMIN_LOGIN_URL);
  });

  // Inti regresi: navigasi harus diserahkan ke browser. `next/link`
  // memanggil preventDefault lalu menavigasi sendiri, dan di situlah origin
  // tautan hilang.
  it("tidak mencegat klik pada tautan lintas host", async () => {
    await act(async () => {
      root.render(<LandingLink href={ADMIN_LOGIN_URL}>Masuk</LandingLink>);
    });

    const anchor = container.querySelector("a") as HTMLAnchorElement;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
  });
});
