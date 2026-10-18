import { describe, expect, it } from "vitest";

import { loginActionBadge } from "@/app/admin/log/login/login-log-action";

describe("loginActionBadge", () => {
  it("names a refused outdated app in plain words, in red", () => {
    const badge = loginActionBadge("LOGIN_REJECTED_OUTDATED_APP");

    expect(badge.label).toBe("Ditolak: versi aplikasi lama");
    expect(badge.className).toContain("bg-red-100");
  });

  it("keeps a successful login green", () => {
    expect(loginActionBadge("LOGIN")).toMatchObject({ label: "Login" });
    expect(loginActionBadge("LOGIN").className).toContain("bg-green-100");
  });

  it("shows unknown actions as they are", () => {
    expect(loginActionBadge("LOGOUT").label).toBe("LOGOUT");
  });
});
