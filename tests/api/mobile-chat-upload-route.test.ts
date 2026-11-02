import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  convertAndSaveImage: vi.fn(),
}));

vi.mock("next-auth", async () => {
  const actual = await vi.importActual<typeof import("next-auth")>("next-auth");
  return { ...actual, getServerSession: mocks.getServerSession };
});
vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveImage: mocks.convertAndSaveImage,
}));

import { POST } from "@/app/api/mobile/chat/upload/route";

const params = { params: Promise.resolve({}) };

function unggah(file: File, headers: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("image", file);
  return POST(
    new NextRequest("https://radpro.id/api/mobile/chat/upload", {
      method: "POST",
      body: formData,
      headers: { host: "radpro.id", "x-forwarded-proto": "https", ...headers },
    }),
    params,
  );
}

const fotoKecil = () =>
  new File([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "image/jpeg" });

describe("POST /api/mobile/chat/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "a@radpro.id",
        tenantId: "tenant-1",
        permissions: ["m_chat:create"],
      },
    });
  });

  it("menolak kiriman raksasa dari header, sebelum body dibaca ke memori", async () => {
    const response = await unggah(fotoKecil(), {
      "content-length": String(50 * 1024 * 1024),
    });

    expect(response.status).toBe(413);
    expect(mocks.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("menolak body chunked raksasa tanpa Content-Length saat dibaca", async () => {
    const formData = new FormData();
    formData.set(
      "image",
      new File([new Uint8Array(6 * 1024 * 1024)], "besar.jpg", {
        type: "image/jpeg",
      }),
    );
    const multipart = new Request("https://radpro.id/x", {
      method: "POST",
      body: formData,
    });
    // Stream chunked yang patuh pada cancel: produsen FormData bawaan undici
    // masih mencoba enqueue sesudah pembacaan dibatalkan.
    const bytes = new Uint8Array(await multipart.arrayBuffer());
    const CHUNK = 64 * 1024;
    let posisi = 0;
    const streamChunked = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (posisi >= bytes.byteLength) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.slice(posisi, posisi + CHUNK));
        posisi += CHUNK;
      },
    });
    const tanpaUkuran = new NextRequest(
      "https://radpro.id/api/mobile/chat/upload",
      {
        method: "POST",
        headers: {
          host: "radpro.id",
          "content-type": multipart.headers.get("content-type")!,
        },
        body: streamChunked,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );
    expect(tanpaUkuran.headers.get("content-length")).toBeNull();

    const response = await POST(tanpaUkuran, params);

    expect(response.status).toBe(413);
    expect(mocks.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("meng-encode ulang gambar ke folder chat tenant dan mengembalikan URL absolut", async () => {
    mocks.convertAndSaveImage.mockResolvedValueOnce(
      "/uploads/tenants/tenant-1/chat/user-1-1.webp",
    );

    const response = await unggah(fotoKecil());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        imageUrl:
          "https://radpro.id/uploads/tenants/tenant-1/chat/user-1-1.webp",
      },
    });
    expect(mocks.convertAndSaveImage).toHaveBeenCalledWith(
      expect.any(File),
      "public/uploads/tenants/tenant-1/chat",
      expect.stringMatching(/^user-1-\d+$/),
      "chat",
    );
  });

  it("isi bukan gambar → 400 dengan pesan yang jelas", async () => {
    mocks.convertAndSaveImage.mockRejectedValueOnce(
      new Error(
        "Gagal mengkonversi gambar: Input buffer contains unsupported image format",
      ),
    );

    const response = await unggah(fotoKecil());

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("rusak");
  });

  it("gangguan penyimpanan tetap 500, bukan disebut gambar rusak", async () => {
    mocks.convertAndSaveImage.mockRejectedValueOnce(
      new Error("Gagal mengkonversi gambar: R2 PutObject timeout"),
    );

    const response = await unggah(fotoKecil());

    expect(response.status).toBe(500);
  });

  it("menolak tipe selain gambar", async () => {
    const response = await unggah(
      new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.convertAndSaveImage).not.toHaveBeenCalled();
  });
});
