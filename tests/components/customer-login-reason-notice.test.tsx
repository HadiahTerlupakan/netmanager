// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pelanggan yang sesinya diakhiri karena dismantle dialihkan ke
 * /login?reason=dismantled. Halaman login hanya menampilkan teks tetap yang
 * dipetakan dari kode alasan, tidak pernah isi query itu sendiri.
 */

const palsu = vi.hoisted(() => ({ query: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(palsu.query),
}));

import { CustomerLoginReasonNotice } from "@/components/customer/CustomerLoginReasonNotice";
import { getCustomerLoginReasonMessage } from "@/lib/customer-login-reason";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const PESAN = "Layanan Anda sudah berhenti berlangganan. Hubungi admin bila ini keliru.";

describe("alasan logout di halaman login pelanggan", () => {
  it("memetakan kode alasan ke teks tetap", () => {
    expect(getCustomerLoginReasonMessage("dismantled")).toBe(PESAN);
    expect(getCustomerLoginReasonMessage("inactive")).toMatch(/tidak aktif/i);
  });

  it.each([null, "", "toString", "constructor", "<b>Hubungi 0812</b>"])(
    "mengabaikan alasan yang tidak dikenal: %s",
    (reason) => {
      expect(getCustomerLoginReasonMessage(reason)).toBeNull();
    },
  );

  describe("komponen", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    it("menampilkan pesan dismantle", () => {
      palsu.query = "reason=dismantled";
      act(() => root.render(<CustomerLoginReasonNotice />));

      expect(container.textContent).toBe(PESAN);
    });

    it("tidak menampilkan apa pun untuk teks bebas di query", () => {
      palsu.query = "reason=Akun+Anda+diblokir.+Transfer+ke+rekening+123";
      act(() => root.render(<CustomerLoginReasonNotice />));

      expect(container.textContent).toBe("");
    });
  });
});
