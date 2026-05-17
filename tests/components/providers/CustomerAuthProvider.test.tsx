// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFns = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockFns.push }),
}));

import {
  CustomerAuthProvider,
  useCustomerAuth,
} from "@/components/customer/CustomerAuthProvider";

function AuthProbe() {
  const { customer, isAuthenticated, isLoading, login } = useCustomerAuth();

  return (
    <div>
      <button
        id="login-button"
        onClick={() => {
          void login("pelanggan-demo", "secret");
        }}
      >
        Login
      </button>
      <span id="loading">{String(isLoading)}</span>
      <span id="authenticated">{String(isAuthenticated)}</span>
      <span id="customer-name">{customer?.nama ?? ""}</span>
    </div>
  );
}

function renderWithProviders(container: HTMLElement) {
  // Fresh QueryClient per test agar cache tidak leak antar test
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  createRoot(container).render(
    <QueryClientProvider client={queryClient}>
      <CustomerAuthProvider>
        <AuthProbe />
      </CustomerAuthProvider>
    </QueryClientProvider>,
  );
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timeout after ${timeoutMs}ms`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

describe("CustomerAuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("hydrates customer from api success envelope on mount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              customer: {
                id: "cust-1",
                idPelanggan: "P001",
                nama: "Pelanggan Demo",
                email: "demo@example.com",
              },
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      renderWithProviders(container);
    });
    await waitFor(
      () => container.querySelector("#loading")?.textContent === "false",
    );

    expect(container.querySelector("#loading")?.textContent).toBe("false");
    expect(container.querySelector("#authenticated")?.textContent).toBe("true");
    expect(container.querySelector("#customer-name")?.textContent).toBe(
      "Pelanggan Demo",
    );
  });

  it("sets authenticated customer after login success envelope", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              customer: {
                id: "cust-2",
                idPelanggan: "P002",
                nama: "Customer Login",
              },
            },
            message: "Login berhasil",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      renderWithProviders(container);
    });
    await waitFor(
      () => container.querySelector("#loading")?.textContent === "false",
    );

    const loginButton = container.querySelector("#login-button");

    await act(async () => {
      loginButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(
      () =>
        container.querySelector("#customer-name")?.textContent ===
        "Customer Login",
    );

    expect(container.querySelector("#authenticated")?.textContent).toBe("true");
    expect(container.querySelector("#customer-name")?.textContent).toBe(
      "Customer Login",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/customer/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "pelanggan-demo",
        password: "secret",
      }),
    });
  });
});
