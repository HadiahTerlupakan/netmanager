import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirect: vi.fn(),
  verifyPelangganAccessToken: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockFns.cookies,
}));

vi.mock("next/navigation", () => ({
  redirect: mockFns.redirect,
}));

vi.mock("@/lib/jwt", () => ({
  verifyPelangganAccessToken: mockFns.verifyPelangganAccessToken,
  generatePelangganAccessToken: vi.fn(),
}));

import {
  CUSTOMER_ACCESS_TOKEN_COOKIE,
  getCustomerSessionFromCookies,
  requireCustomerPageAuth,
  type CustomerSession,
} from "@/lib/customer-auth";

const activeSession: CustomerSession = {
  id: "customer-1",
  idPelanggan: "PLG-001",
  nama: "Pelanggan Satu",
  username: "pelanggan1",
  status: "AKTIF",
};

const inactiveSession: CustomerSession = {
  ...activeSession,
  status: "NONAKTIF",
};

describe("customer page auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the customer token cookie is missing", async () => {
    mockFns.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    const session = await getCustomerSessionFromCookies();

    expect(session).toBeNull();
    expect(mockFns.redirect).not.toHaveBeenCalled();
  });

  it("returns the decoded customer session from cookies", async () => {
    mockFns.verifyPelangganAccessToken.mockReturnValue(activeSession);
    mockFns.cookies.mockResolvedValue({
      get: vi.fn().mockImplementation((name: string) => {
        if (name === CUSTOMER_ACCESS_TOKEN_COOKIE) {
          return { value: "access-token" };
        }

        return undefined;
      }),
    });

    const session = await getCustomerSessionFromCookies();

    expect(session).toEqual(activeSession);
    expect(mockFns.verifyPelangganAccessToken).toHaveBeenCalledWith(
      "access-token",
    );
  });

  it("redirects guests to the login page", async () => {
    mockFns.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    mockFns.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });

    await expect(requireCustomerPageAuth()).rejects.toThrow("redirect:/login");
    expect(mockFns.redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects inactive customers to login with inactive reason", async () => {
    mockFns.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "inactive-token" }),
    });
    mockFns.verifyPelangganAccessToken.mockReturnValue(inactiveSession);
    mockFns.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });

    await expect(requireCustomerPageAuth()).rejects.toThrow(
      "redirect:/login?reason=inactive",
    );
    expect(mockFns.redirect).toHaveBeenCalledWith("/login?reason=inactive");
  });

  it("returns the active session for authenticated customers", async () => {
    mockFns.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "active-token" }),
    });
    mockFns.verifyPelangganAccessToken.mockReturnValue(activeSession);

    const session = await requireCustomerPageAuth();

    expect(session).toEqual(activeSession);
    expect(mockFns.redirect).not.toHaveBeenCalled();
  });

  it("returns null when token verification fails", async () => {
    mockFns.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "invalid-token" }),
    });
    mockFns.verifyPelangganAccessToken.mockReturnValue(null);

    await expect(getCustomerSessionFromCookies()).resolves.toBeNull();
  });
});
