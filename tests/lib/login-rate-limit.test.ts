import { beforeEach, describe, expect, it, vi } from "vitest";
import { redisMock } from "../setup";

describe("strict login rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.incr.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.setex.mockResolvedValue("OK");
  });

  it("returns unavailable when Redis rate limit storage fails", async () => {
    redisMock.incr.mockRejectedValueOnce(new Error("NOAUTH"));

    const { checkStrictLoginRateLimit } =
      await import("@/lib/security/login-rate-limit");

    const result = await checkStrictLoginRateLimit(
      "login:user@example.com",
      5,
      300,
    );

    expect(result).toBe("unavailable");
  });

  it("returns rate_limited when attempts exceed the limit", async () => {
    redisMock.incr.mockResolvedValueOnce(6);

    const { checkStrictLoginRateLimit } =
      await import("@/lib/security/login-rate-limit");

    const result = await checkStrictLoginRateLimit(
      "login:user@example.com",
      5,
      300,
    );

    expect(result).toBe("rate_limited");
    expect(redisMock.setex).toHaveBeenCalledWith(
      "delay:login:user_example_com",
      30,
      "1",
    );
  });
});
