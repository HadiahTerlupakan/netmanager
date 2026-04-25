// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://admin.radpro.id/login"}

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  push: vi.fn(),
  searchGet: vi.fn(),
  signIn: vi.fn(),
  getSubdomainFromWindow: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockFns.push }),
  useSearchParams: () => ({ get: mockFns.searchGet }),
}));

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockFns.signIn(...args),
}));

vi.mock("@/lib/utils/subdomain-client", () => ({
  getAdminUrl: (path: string) => `https://admin.radpro.id${path}`,
  getSubdomainFromWindow: () => mockFns.getSubdomainFromWindow(),
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    type = "button",
    disabled,
    className,
  }: {
    children?: React.ReactNode;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    className?: string;
  }) => (
    <button type={type} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

import LoginForm from "@/components/auth/LoginForm";

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );

  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("LoginForm", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    window.history.replaceState({}, "", "/login");
    mockFns.searchGet.mockReturnValue(null);
    mockFns.signIn.mockResolvedValue({ url: "/admin" });
    mockFns.getSubdomainFromWindow.mockReturnValue("admin");
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    document.body.innerHTML = "";
  });

  it("does not log successful login redirects to console", async () => {
    await act(async () => {
      createRoot(container).render(<LoginForm />);
      await Promise.resolve();
    });

    const emailInput = container.querySelector(
      'input[type="email"]',
    ) as HTMLInputElement;
    const passwordInput = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      setInputValue(emailInput, "admin@radpro.id");
      setInputValue(passwordInput, "secret123");
      form.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFns.signIn).toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      "[LoginForm] Login successful, redirecting...",
      expect.anything(),
    );
  });
});
