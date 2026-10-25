import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHasPermission = vi.fn();
const mockPush = vi.fn();
const mockFind = vi.fn();
const mockUpsert = vi.fn();
const mockResolveContent = vi.fn();
const mockSaveFile = vi.fn();
const mockDeleteUploaded = vi.fn();

vi.mock("@/lib/api", () => ({
  createHandler:
    (
      options: {
        schema?: {
          safeParse: (v: unknown) => { success: boolean; data: unknown };
        };
      },
      handler: (req: Request, ctx: unknown) => unknown,
    ) =>
    async (req: Request, ctx: Record<string, unknown>) => {
      if (options.schema) {
        const parsed = options.schema.safeParse(await req.json());
        if (!parsed.success) return { status: 400 };
        ctx = { ...ctx, validated: parsed.data };
      }
      return handler(req, ctx);
    },
  apiSuccess: <T>(data: T) => data,
  ApiErrors: {
    forbidden: (message: string) => ({ error: message, status: 403 }),
    badRequest: (message: string) => ({ error: message, status: 400 }),
  },
}));
vi.mock("@/lib/rbac", () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/utils/image-upload", () => ({
  isImageFile: (file: File) => file.type.startsWith("image/"),
  saveFile: (...args: unknown[]) => mockSaveFile(...args),
  deleteUploadedFile: (...args: unknown[]) => mockDeleteUploaded(...args),
}));
vi.mock("@/modules/network/isolir/IsolirPageRepository", () => ({
  IsolirPageRepository: {
    findByTenant: (...args: unknown[]) => mockFind(...args),
    upsertForTenant: (...args: unknown[]) => mockUpsert(...args),
  },
}));
vi.mock("@/modules/network/isolir/isolir-content", () => ({
  resolveIsolirContent: (...args: unknown[]) => mockResolveContent(...args),
}));
vi.mock("@/modules/network", async () => {
  const service = await import("@/modules/network/isolir/IsolirPageService");
  const instance = service.createIsolirPageService(mockPush);
  return {
    getIsolirPageService: () => instance,
    IsolirLogoError: service.IsolirLogoError,
  };
});

import type { IsolirContent } from "@/modules/network/isolir/isolir-page.types";
import { GET, PUT } from "@/app/api/admin/isolir-page/route";
import { GET as PREVIEW } from "@/app/api/admin/isolir-page/preview/route";
import { DELETE, POST } from "@/app/api/admin/isolir-page/logo/route";

const content: IsolirContent = {
  ispName: "Net Contoh",
  title: "Diisolir",
  message: "Bayar dulu",
  logoDataUri: null,
  payments: [],
  whatsapp: null,
  link: null,
  contactText: null,
  primaryColor: "#1d4ed8",
};
const session = (tenantId: string | null) =>
  ({ session: { user: { id: "u1", tenantId } } }) as never;
const jsonRequest = (method: string, body: unknown) =>
  new NextRequest("http://localhost/api/admin/isolir-page", {
    method,
    body: JSON.stringify(body),
  });
const logoRequest = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return new NextRequest("http://localhost/api/admin/isolir-page/logo", {
    method: "POST",
    body: form,
  });
};

describe("API halaman isolir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
    mockPush.mockResolvedValue(undefined);
    mockFind.mockResolvedValue(null);
    mockUpsert.mockImplementation(async (_tenant, data) => ({ ...data }));
    mockResolveContent.mockResolvedValue(content);
  });

  it("menolak GET tanpa isolir_page:read", async () => {
    mockHasPermission.mockResolvedValue(false);
    const result = await GET(
      new NextRequest("http://localhost/api/admin/isolir-page"),
      session("t1"),
    );
    expect(mockHasPermission).toHaveBeenCalledWith("isolir_page:read");
    expect(result).toMatchObject({ status: 403 });
  });

  it("menolak PUT tanpa isolir_page:update dan tidak menyimpan", async () => {
    mockHasPermission.mockResolvedValue(false);
    const result = await PUT(jsonRequest("PUT", { title: "x" }), session("t1"));
    expect(mockHasPermission).toHaveBeenCalledWith("isolir_page:update");
    expect(result).toMatchObject({ status: 403 });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("PUT valid menyimpan untuk tenant sesi, mengirim sekali, dan memberi preview", async () => {
    const result = (await PUT(
      jsonRequest("PUT", { title: "  Diisolir  ", message: "", tenantId: "x" }),
      session("t1"),
    )) as unknown as { preview: { dropped: string[]; html: string } };

    expect(mockUpsert).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ title: "Diisolir", message: null }),
    );
    expect(mockUpsert.mock.calls[0][1]).not.toHaveProperty("logoUrl");
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("t1");
    expect(result.preview.dropped).toEqual([]);
    expect(result.preview.html).toContain("Diisolir");
  });

  it("PUT tetap 200 bila pengiriman ke router gagal", async () => {
    mockPush.mockRejectedValue(new Error("router mati"));
    const result = await PUT(jsonRequest("PUT", { title: "x" }), session("t1"));
    expect(result).toHaveProperty("preview");
  });

  it.each([
    ["primaryColor", { primaryColor: "red" }],
    ["linkUrl", { linkUrl: "javascript:alert(1)" }],
    ["whatsappNumber", { whatsappNumber: "abc" }],
    ["title terlalu panjang", { title: "a".repeat(121) }],
    [
      "payments kosong",
      { payments: [{ label: "BCA", number: "", holder: "A" }] },
    ],
    [
      "payments lebih dari 10",
      {
        payments: Array.from({ length: 11 }, () => ({
          label: "a",
          number: "1",
          holder: "b",
        })),
      },
    ],
  ])("PUT menolak %s tidak valid dengan 400", async (_name, body) => {
    const result = await PUT(jsonRequest("PUT", body), session("t1"));
    expect(result).toMatchObject({ status: 400 });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("super admin tanpa tenant mendapat 400 Pilih tenant", async () => {
    const result = await PUT(jsonRequest("PUT", {}), session(null));
    expect(result).toEqual({ error: "Pilih tenant", status: 400 });
  });

  it("pratinjau mengembalikan text/html dari renderer", async () => {
    const response = (await PREVIEW(
      new NextRequest("http://localhost/api/admin/isolir-page/preview"),
      session("t1"),
    )) as Response;
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(mockResolveContent).toHaveBeenCalledWith("t1");
    expect(await response.text()).toContain("Net Contoh");
  });

  describe("logo", () => {
    it("unggah menyimpan path ke tenant sesi dan memicu pengiriman", async () => {
      mockSaveFile.mockResolvedValue("/uploads/logos/isolir-t1-1.png");
      const result = await POST(
        logoRequest(new File(["x"], "logo.png", { type: "image/png" })),
        session("t1"),
      );
      expect(mockUpsert).toHaveBeenCalledWith("t1", {
        logoUrl: "/uploads/logos/isolir-t1-1.png",
      });
      expect(result).toEqual({ logoUrl: "/uploads/logos/isolir-t1-1.png" });
      expect(mockPush).toHaveBeenCalledWith("t1");
    });

    it("unggah ulang menghapus berkas lama", async () => {
      mockFind.mockResolvedValue({ logoUrl: "/uploads/logos/lama.png" });
      mockSaveFile.mockResolvedValue("/uploads/logos/baru.png");
      await POST(
        logoRequest(new File(["x"], "logo.png", { type: "image/png" })),
        session("t1"),
      );
      expect(mockDeleteUploaded).toHaveBeenCalledWith(
        "http://localhost/uploads/logos/lama.png",
      );
    });

    it("menolak unggah tanpa isolir_page:update", async () => {
      mockHasPermission.mockResolvedValue(false);
      const result = await POST(
        logoRequest(new File(["x"], "logo.png", { type: "image/png" })),
        session("t1"),
      );
      expect(result).toMatchObject({ status: 403 });
      expect(mockSaveFile).not.toHaveBeenCalled();
    });

    it("menolak berkas yang bukan gambar", async () => {
      const result = await POST(
        logoRequest(new File(["x"], "a.pdf", { type: "application/pdf" })),
        session("t1"),
      );
      expect(result).toMatchObject({ status: 400 });
      expect(mockSaveFile).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("hapus mengosongkan logoUrl, menghapus berkas, dan memicu pengiriman", async () => {
      mockFind.mockResolvedValue({ logoUrl: "/uploads/logos/lama.png" });
      const result = await DELETE(
        new NextRequest("http://localhost/api/admin/isolir-page/logo", {
          method: "DELETE",
        }),
        session("t1"),
      );
      expect(mockUpsert).toHaveBeenCalledWith("t1", { logoUrl: null });
      expect(mockDeleteUploaded).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("t1");
      expect(result).toEqual({ success: true });
    });
  });
});
