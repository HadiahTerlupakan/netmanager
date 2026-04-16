import { POST } from "@/app/api/investor/auth/login/route";
import { prismaMock } from "../setup";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { compare } from "bcryptjs";

const mockCheckStrictLoginRateLimit = vi.hoisted(() => vi.fn());

vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
}));

vi.mock("jose", () => {
  // Use a class so `new SignJWT()` works (arrow functions can't be constructors)
  class MockSignJWT {
    setProtectedHeader() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "mocked-jwt-token";
    }
  }
  return { SignJWT: MockSignJWT };
});

vi.mock("@/lib/security/login-rate-limit", () => ({
  checkStrictLoginRateLimit: (...args: unknown[]) =>
    mockCheckStrictLoginRateLimit(...args),
  isLoginRateLimitEnabled: () => true,
  LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE:
    "Layanan login sementara tidak tersedia. Coba lagi beberapa saat.",
}));

describe("Investor Login API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...process.env,
      NEXTAUTH_SECRET: "test-secret-at-least-32-chars-long-standard",
      NODE_ENV: "production",
    };
  });

  it("should return 400 if username or password missing", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "test" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Username dan Password wajib diisi");
  });

  it("should return 401 if investor not found", async () => {
    prismaMock.investor.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "nonexistent", password: "password" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe("Username atau Password salah");
  });

  it("should return 401 if passwordHash is missing (verified legacy removal)", async () => {
    prismaMock.investor.findFirst.mockResolvedValue({
      id: "1",
      username: "investor1",
      passwordHash: null,
      isActive: true,
    } as unknown as {
      id: string;
      username: string;
      passwordHash: string | null;
      isActive: boolean;
    });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "investor1", password: "password" }),
    });
    const res = await POST(req);
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(401);
    expect(data.error).toBe("Username atau Password salah");
  });

  it("should return 401 if password does not match", async () => {
    prismaMock.investor.findFirst.mockResolvedValue({
      id: "1",
      username: "investor1",
      passwordHash: "hashed_pw",
      isActive: true,
    } as unknown as {
      id: string;
      username: string;
      passwordHash: string;
      isActive: boolean;
    });
    (vi.mocked(compare) as Mock).mockResolvedValue(false);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        username: "investor1",
        password: "wrongpassword",
      }),
    });
    const res = await POST(req);
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(401);
    expect(data.error).toBe("Username atau Password salah");
  });

  it("should return 200 and set cookie on successful login", async () => {
    const mockInvestor = {
      id: "1",
      username: "investor1",
      passwordHash: "hashed_pw",
      namaLengkap: "Investor One",
      tenantId: "tenant1",
      isActive: true,
    };
    prismaMock.investor.findFirst.mockResolvedValue(
      mockInvestor as unknown as {
        id: string;
        username: string;
        passwordHash: string;
        namaLengkap: string;
        tenantId: string;
        isActive: boolean;
      },
    );
    (vi.mocked(compare) as Mock).mockResolvedValue(true);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        username: "investor1",
        password: "correctpassword",
      }),
    });
    const res = await POST(req);
    const data = (await res.json()) as {
      success: boolean;
      data: { user: { username: string } };
    };

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.user.username).toBe("investor1");

    // Verify cookie was set via Set-Cookie header
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("investor_auth_token=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("should return 403 if account is inactive", async () => {
    prismaMock.investor.findFirst.mockResolvedValue({
      id: "1",
      username: "investor1",
      passwordHash: "hashed_pw",
      isActive: false,
    } as unknown as {
      id: string;
      username: string;
      passwordHash: string;
      isActive: boolean;
    });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "investor1", password: "password" }),
    });
    const res = await POST(req);
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(403);
    expect(data.error).toBe("Akun dinonaktifkan. Silakan hubungi Admin.");
  });

  it("should fail closed when investor login rate limit storage is unavailable", async () => {
    mockCheckStrictLoginRateLimit.mockResolvedValueOnce("unavailable");

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "investor1", password: "password" }),
    });
    const res = await POST(req);
    const data = (await res.json()) as { error: string; code: string };

    expect(res.status).toBe(503);
    expect(data.error).toBe(
      "Layanan login sementara tidak tersedia. Coba lagi beberapa saat.",
    );
    expect(data.code).toBe("INTERNAL_ERROR");
    expect(prismaMock.investor.findFirst).not.toHaveBeenCalled();
  });

  it("should normalize investor identifier before building the rate limit key", async () => {
    mockCheckStrictLoginRateLimit.mockResolvedValueOnce("unavailable");

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "  InVesTor1  ", password: "password" }),
    });

    await POST(req);

    expect(mockCheckStrictLoginRateLimit).toHaveBeenCalledWith(
      "investor-login:investor1",
      50,
      300,
    );
  });
});
