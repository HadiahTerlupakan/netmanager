import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findTenantIdByVpnAddress: vi.fn(),
  resolveIsolirContent: vi.fn(),
  renderIsolirPage: vi.fn(),
  runAsSystemContext: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: mocks.runAsSystemContext,
}));
vi.mock("@/modules/network/isolir/IsolirPageRepository", () => ({
  IsolirPageRepository: {
    findTenantIdByVpnAddress: mocks.findTenantIdByVpnAddress,
  },
}));
vi.mock("@/modules/network/isolir/isolir-content", () => ({
  resolveIsolirContent: mocks.resolveIsolirContent,
}));
vi.mock("@/modules/network/isolir/isolir-render", () => ({
  renderIsolirPage: mocks.renderIsolirPage,
}));

import { IsolirServicePageService } from "@/modules/network/isolir/IsolirServicePageService";

describe("IsolirServicePageService.getPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runAsSystemContext.mockImplementation(
      (_reason: string, callback: () => Promise<unknown>) => callback(),
    );
    mocks.resolveIsolirContent.mockImplementation(
      async (tenantId: string | null) => ({ ispName: `isp:${tenantId}` }),
    );
    mocks.renderIsolirPage.mockImplementation(
      (content: { ispName: string }) => ({
        html: `<html>${content.ispName}</html>`,
        hash: `hash-${content.ispName}`,
      }),
    );
  });

  it("memakai tenant pemilik router untuk alamat yang dikenal", async () => {
    mocks.findTenantIdByVpnAddress.mockResolvedValue({ tenantId: "T" });

    const page = await new IsolirServicePageService().getPage("10.100.0.4");

    expect(mocks.runAsSystemContext).toHaveBeenCalledTimes(1);
    expect(mocks.findTenantIdByVpnAddress).toHaveBeenCalledWith("10.100.0.4");
    expect(mocks.resolveIsolirContent).toHaveBeenCalledWith("T");
    expect(page).toEqual({ html: "<html>isp:T</html>", hash: "hash-isp:T" });
  });

  it("jatuh ke isi default untuk alamat yang tidak dikenal", async () => {
    mocks.findTenantIdByVpnAddress.mockResolvedValue(null);

    const page = await new IsolirServicePageService().getPage("10.100.9.9");

    expect(mocks.resolveIsolirContent).toHaveBeenCalledWith(null);
    expect(page.hash).toBe("hash-isp:null");
  });

  it("memakai isi default untuk router tanpa tenant", async () => {
    mocks.findTenantIdByVpnAddress.mockResolvedValue({ tenantId: null });

    await new IsolirServicePageService().getPage("10.100.0.5");

    expect(mocks.resolveIsolirContent).toHaveBeenCalledWith(null);
  });
});
