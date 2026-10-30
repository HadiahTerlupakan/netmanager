// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const showToast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/components/customer/CustomerAuthProvider", () => ({
  useCustomerAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({
    data: {
      profile: {
        idPelanggan: "PLG-0002",
        nama: "TES LAB 02",
        username: "teslab02",
        email: null as string | null,
        noTelp: "0812",
        alamat: "Lab",
        status: "AKTIF",
        lokasi: {
          provinsi: null as string | null,
          kabupatenKota: null as string | null,
          kecamatan: null as string | null,
          kelurahanDesa: null as string | null,
        },
        preferences: {
          is2FAEnabled: false,
          isBillNotifEnabled: true,
          isPromoEnabled: false,
        },
      },
    },
    isLoading: false,
    error: null as Error | null,
    mutate: vi.fn(),
  }),
}));

import CustomerProfilPage from "@/app/(customer)/profil/page";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function byText(text: string) {
  return [...document.body.querySelectorAll("button")].find(
    (el) => el.textContent?.trim() === text,
  );
}

function type(label: string, value: string) {
  const input = document.body.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  );
  if (!input) throw new Error(`no input ${label}`);
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("halaman Pengaturan Akun pelanggan", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    showToast.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<CustomerProfilPage />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function openAndSubmit(current: string, next: string, confirm: string) {
    act(() => byText("Ganti Password")?.click());
    type("Password saat ini", current);
    type("Password baru", next);
    type("Ulangi password baru", confirm);
    await act(async () => byText("Simpan Password")?.click());
  }

  // Login never checks the flag, so a toggle would promise protection that
  // does not exist.
  it("does not offer two-step verification", () => {
    expect(document.body.textContent).not.toContain("Verifikasi 2 Langkah");
  });

  it("refuses a confirmation that does not match, without calling the server", async () => {
    await openAndSubmit("lama123", "baru123", "baru124");

    expect(document.body.textContent).toContain(
      "Konfirmasi password tidak cocok",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's message when the current password is wrong", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "Password saat ini salah" }),
    });

    await openAndSubmit("salah", "baru123", "baru123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/customer/profile",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: "salah",
          newPassword: "baru123",
        }),
      }),
    );
    expect(document.body.textContent).toContain("Password saat ini salah");
  });

  it("closes the form and confirms once the password is changed", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await openAndSubmit("lama123", "baru123", "baru123");

    expect(showToast).toHaveBeenCalledWith(
      "success",
      "Password berhasil diubah",
    );
    expect(byText("Simpan Password")).toBeUndefined();
  });
});
