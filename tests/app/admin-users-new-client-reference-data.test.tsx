// @vitest-environment jsdom

import { act, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const EMAIL_CHECK_DEBOUNCE_MS = 800;

function renderWithQueryClient(container: HTMLElement, ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  createRoot(container).render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn((permission: string) => permission === "users:create"),
  searchGet: vi.fn(() => null),
  push: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockFns.push }),
  useSearchParams: () => ({ get: mockFns.searchGet }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children?: ReactNode;
    href?: string;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: (...args: unknown[]) => mockFns.toastError(...args),
  },
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({ hasPermission: mockFns.hasPermission }),
}));

vi.mock("@/app/admin/users/components/MultiSiteSelect", () => ({
  default: () => <div data-testid="multi-site-select" />,
}));

vi.mock("@/app/admin/users/[id]/WorkingHoursSettings", () => ({
  default: () => <div data-testid="working-hours-settings" />,
}));

vi.mock("@/app/admin/users/[id]/LeaveBalanceSettings", () => ({
  default: () => <div data-testid="leave-balance-settings" />,
}));

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setReactSelectValue(select: HTMLSelectElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillRequiredCreateUserFields(args: {
  emailInput: HTMLInputElement;
  nameInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  roleSelect: HTMLSelectElement;
}) {
  setReactInputValue(args.emailInput, "test@example.com");
  setReactInputValue(args.nameInput, "Test User");
  setReactInputValue(args.passwordInput, "password123");
  setReactSelectValue(args.roleSelect, "role-1");
}

function submitCreateUserForm(form: HTMLFormElement) {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("UsersNewClient reference data loading", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.replaceChildren();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("tetap memuat dropdown role saat endpoint departemen gagal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/admin/departments")) {
          return Promise.reject(new Error("departments failed"));
        }

        if (url.includes("/api/roles?filterRestricted=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "role-1", name: "Admin" }],
          } as Response);
        }

        if (url.includes("/api/admin/sites?activeOnly=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [{ id: "site-1", code: "HQ", name: "Site A" }],
            }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        } as Response);
      }),
    );

    const { ClientComponent } =
      await import("@/app/admin/users/new/UsersNewClient");

    await act(async () => {
      renderWithQueryClient(container, <ClientComponent />);
      await flushPromises();
      await flushPromises();
    });

    const roleSelect = container.querySelector(
      'select[name="roleId"]',
    ) as HTMLSelectElement | null;

    expect(roleSelect).not.toBeNull();
    expect(roleSelect?.textContent || "").toContain("Admin");
  });

  it("memuat ulang data referensi pada mount berikutnya setelah fetch awal gagal", async () => {
    let roleCallCount = 0;
    let siteCallCount = 0;

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/roles?filterRestricted=true")) {
        roleCallCount += 1;

        if (roleCallCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: async () => ({ error: "forbidden" }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: async () => [{ id: "role-1", name: "Admin" }],
        } as Response);
      }

      if (url.includes("/api/admin/departments")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: "dep-1", name: "Ops" }] }),
        } as Response);
      }

      if (url.includes("/api/admin/sites?activeOnly=true")) {
        siteCallCount += 1;

        if (siteCallCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: async () => ({ error: "forbidden" }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{ id: "site-1", code: "HQ", name: "Site A" }],
          }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { ClientComponent } =
      await import("@/app/admin/users/new/UsersNewClient");

    await act(async () => {
      renderWithQueryClient(container, <ClientComponent />);
      await flushPromises();
      await flushPromises();
    });

    const firstRoleSelect = container.querySelector(
      'select[name="roleId"]',
    ) as HTMLSelectElement | null;
    expect(firstRoleSelect?.textContent || "").not.toContain("Admin");

    document.body.replaceChildren();
    container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      renderWithQueryClient(container, <ClientComponent />);
      await flushPromises();
      await flushPromises();
    });

    const secondRoleSelect = container.querySelector(
      'select[name="roleId"]',
    ) as HTMLSelectElement | null;
    expect(secondRoleSelect?.textContent || "").toContain("Admin");
  });

  it("membaca role dari payload apiSuccess berbentuk data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/roles?filterRestricted=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: [{ id: "role-1", name: "Admin Wrapped" }],
            }),
          } as Response);
        }

        if (url.includes("/api/admin/departments")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [{ id: "dep-1", name: "Ops" }] }),
          } as Response);
        }

        if (url.includes("/api/admin/sites?activeOnly=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [{ id: "site-1", code: "HQ", name: "Site A" }],
            }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        } as Response);
      }),
    );

    const { ClientComponent } =
      await import("@/app/admin/users/new/UsersNewClient");

    await act(async () => {
      renderWithQueryClient(container, <ClientComponent />);
      await flushPromises();
      await flushPromises();
    });

    const roleSelect = container.querySelector(
      'select[name="roleId"]',
    ) as HTMLSelectElement | null;

    expect(roleSelect?.textContent || "").toContain("Admin Wrapped");
  });
});

describe("UsersNewClient tenant-scoped behavior", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.replaceChildren();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("mengabaikan query param tenantId untuk user tanpa tenants:read", async () => {
    mockFns.hasPermission.mockImplementation(
      (permission: string) => permission === "users:create",
    );
    mockFns.searchGet.mockReturnValue("tenant-from-query");

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/roles?filterRestricted=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "role-1", name: "Admin" }],
          } as Response);
        }

        if (url.includes("/api/admin/departments")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          } as Response);
        }

        if (url.includes("/api/admin/sites?activeOnly=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        } as Response);
      }),
    );

    const { ClientComponent } =
      await import("@/app/admin/users/new/UsersNewClient");

    await act(async () => {
      renderWithQueryClient(container, <ClientComponent />);
      await flushPromises();
      await flushPromises();
    });

    const tenantInput = container.querySelector(
      'input[name="tenantId"]',
    ) as HTMLInputElement | null;

    expect(tenantInput?.value || "").toBe("");
  });

  it("tidak menampilkan tenant selector untuk user tanpa tenants:read", async () => {
    mockFns.hasPermission.mockImplementation(
      (permission: string) => permission === "users:create",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/roles?filterRestricted=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "role-1", name: "Admin" }],
          } as Response);
        }

        if (url.includes("/api/admin/departments")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          } as Response);
        }

        if (url.includes("/api/admin/sites?activeOnly=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        } as Response);
      }),
    );

    const { ClientComponent } =
      await import("@/app/admin/users/new/UsersNewClient");

    await act(async () => {
      renderWithQueryClient(container, <ClientComponent />);
      await flushPromises();
      await flushPromises();
    });

    const tenantLabel = Array.from(container.querySelectorAll("label")).find(
      (label) => label.textContent?.includes("Tenant"),
    );

    expect(tenantLabel).toBeUndefined();
  });

  it("tidak mengirim tenantId dalam payload submit untuk user tanpa tenants:read", async () => {
    // Pakai real timer karena useApi dynamic key + debounce useEffect
    // butuh microtask + Promise resolution, tidak fit dengan fake timer.
    mockFns.hasPermission.mockImplementation(
      (permission: string) => permission === "users:create",
    );

    let submitPayload: unknown = null;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/api/admin/users") && init?.method === "POST") {
          submitPayload = JSON.parse(init.body as string);
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }

        if (url.includes("/api/admin/users/check-identifier")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: { exists: false, role: "" },
            }),
          } as Response);
        }

        if (url.includes("/api/roles?filterRestricted=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "role-1", name: "Admin" }],
          } as Response);
        }

        if (url.includes("/api/admin/departments")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          } as Response);
        }

        if (url.includes("/api/admin/sites?activeOnly=true")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        } as Response);
      }),
    );

    const { ClientComponent } =
      await import("@/app/admin/users/new/UsersNewClient");

    try {
      await act(async () => {
        renderWithQueryClient(container, <ClientComponent />);
        await flushPromises();
        await flushPromises();
      });

      const emailInput = container.querySelector(
        'input[name="email"]',
      ) as HTMLInputElement;
      const nameInput = container.querySelector(
        'input[name="name"]',
      ) as HTMLInputElement;
      const passwordInput = container.querySelector(
        'input[name="password"]',
      ) as HTMLInputElement;
      const roleSelect = container.querySelector(
        'select[name="roleId"]',
      ) as HTMLSelectElement;
      const submitButton = container.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;
      const form = container.querySelector("form") as HTMLFormElement;

      await act(async () => {
        fillRequiredCreateUserFields({
          emailInput,
          nameInput,
          passwordInput,
          roleSelect,
        });
        await flushPromises();
      });

      expect(emailInput.value).toBe("test@example.com");
      expect(nameInput.value).toBe("Test User");
      expect(passwordInput.value).toBe("password123");
      expect(roleSelect.value).toBe("role-1");

      // Tunggu debounce 800ms (real timer) + Promise resolution chain.
      await act(async () => {
        await new Promise((resolve) =>
          setTimeout(resolve, EMAIL_CHECK_DEBOUNCE_MS + 100),
        );
        await flushPromises();
        await flushPromises();
        await flushPromises();
      });

      // Tambahan flush untuk hydrate via if-flag setelah TanStack Query
      // resolve cache (butuh re-render lagi).
      await act(async () => {
        await flushPromises();
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await flushPromises();
      });

      expect(container.textContent || "").toContain("Email tersedia");
      expect(submitButton.disabled).toBe(false);

      await act(async () => {
        submitCreateUserForm(form);
        await flushPromises();
        await flushPromises();
      });

      expect(submitPayload).toBeTruthy();
      expect(submitPayload).not.toHaveProperty("tenantId");
    } finally {
      // No-op cleanup: real timers sepanjang test ini.
    }
  });
});
