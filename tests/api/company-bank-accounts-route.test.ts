import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  service: {
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
  },
  pushIsolirPage: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (req: Request, ctx: unknown) => unknown,
  ) => handler,
  apiSuccess: <T>(data: T) => ({ data }),
  ApiErrors: {
    unauthorized: () => ({ status: 401 }),
    forbidden: (message: string) => ({ error: message, status: 403 }),
    badRequest: (message: string) => ({ error: message, status: 400 }),
    notFound: (message: string) => ({ error: message, status: 404 }),
    internalError: (message: string) => ({ error: message, status: 500 }),
  },
}));
vi.mock("@/lib/rbac", () => ({ hasPermission: async () => true }));
vi.mock("@/modules/finance", () => ({
  getCompanyBankAccountService: () => mocks.service,
}));
vi.mock("@/modules/network", () => ({
  pushIsolirPageInBackground: mocks.pushIsolirPage,
}));

import { POST } from "@/app/api/admin/company-bank-accounts/route";
import { DELETE, PUT } from "@/app/api/admin/company-bank-accounts/[id]/route";

const session = { user: { id: "u1", tenantId: "tenant-1" } };
const input = { bankName: "BCA", accountNumber: "123", accountName: "PT" };
const req = new NextRequest("http://localhost/api/admin/company-bank-accounts");
const failed = { success: false, error: "db down" };

const calls = {
  create: () => POST(req, { session, validated: input } as never),
  update: () =>
    PUT(req, { session, validated: input, params: { id: "a1" } } as never),
  delete: () => DELETE(req, { session, params: { id: "a1" } } as never),
};

describe("rekening perusahaan mengirim ulang halaman isolir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.service.createAccount.mockResolvedValue({ success: true, data: {} });
    mocks.service.updateAccount.mockResolvedValue({ success: true, data: {} });
    mocks.service.deleteAccount.mockResolvedValue({ success: true });
  });

  it.each(Object.keys(calls) as Array<keyof typeof calls>)(
    "%s berhasil: halaman isolir tenant sesi dikirim ulang",
    async (action) => {
      await calls[action]();

      expect(mocks.pushIsolirPage).toHaveBeenCalledWith("tenant-1");
    },
  );

  it.each([
    ["create", mocks.service.createAccount],
    ["update", mocks.service.updateAccount],
    ["delete", mocks.service.deleteAccount],
  ] as const)("%s gagal: tidak mengirim apa pun", async (action, method) => {
    method.mockResolvedValue(failed);

    const result = await calls[action]();

    expect(result).toMatchObject({ status: 500 });
    expect(mocks.pushIsolirPage).not.toHaveBeenCalled();
  });
});
