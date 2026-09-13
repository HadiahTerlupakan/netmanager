import { describe, expect, it } from "vitest";
import { unwrapApiData } from "@/lib/utils/fetch-wrapper";

describe("unwrapApiData", () => {
  it("unwraps the apiSuccess envelope", () => {
    const body = {
      success: true,
      data: { notifications: [{ id: "n-1" }], unreadCount: 3 },
    };

    expect(unwrapApiData(body)).toEqual({
      notifications: [{ id: "n-1" }],
      unreadCount: 3,
    });
  });

  it("returns an already-unwrapped body as is", () => {
    const body = { notifications: [] as unknown[], unreadCount: 0 };

    expect(unwrapApiData(body)).toBe(body);
  });

  it("keeps the body when data is not an object", () => {
    const body = { success: true, data: null as unknown };

    expect(unwrapApiData(body)).toBe(body);
  });
});
