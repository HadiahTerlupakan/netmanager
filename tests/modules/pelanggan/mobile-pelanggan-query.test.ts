import { describe, expect, it } from "vitest";
import { parseListQuery } from "@/app/api/mobile/pelanggan/route";

describe("parseListQuery", () => {
  it("memakai halaman 1 dan limit 20 ketika query kosong", () => {
    expect(parseListQuery(new URLSearchParams())).toEqual({
      status: null,
      search: null,
      siteId: null,
      page: 1,
      limit: 20,
    });
  });

  it("membatasi limit maksimal 50", () => {
    expect(parseListQuery(new URLSearchParams("limit=500")).limit).toBe(50);
  });

  it("menolak page dan limit tidak masuk akal", () => {
    const parsed = parseListQuery(new URLSearchParams("page=0&limit=-3"));
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it("meneruskan status, pencarian, dan siteId apa adanya", () => {
    const parsed = parseListQuery(
      new URLSearchParams("status=ISOLIR&search=budi&siteId=site-a"),
    );
    expect(parsed).toMatchObject({
      status: "ISOLIR",
      search: "budi",
      siteId: "site-a",
    });
  });
});
