import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePelangganAccessToken } from "@/lib/jwt";
import { CUSTOMER_ACCESS_TOKEN_COOKIE } from "@/lib/customer-auth";

const mockFns = vi.hoisted(() => ({ convertAndSaveImage: vi.fn() }));

vi.mock("@/lib/utils/image-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/image-upload")>()),
  convertAndSaveImage: mockFns.convertAndSaveImage,
}));

import { POST } from "@/app/api/customer/tickets/attachments/route";

const UPLOAD_URL = "http://localhost/api/customer/tickets/attachments";
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const SIX_MB = 6 * 1024 * 1024;

function customerCookie() {
  const token = generatePelangganAccessToken({
    id: "pelanggan-1",
    idPelanggan: "ID-1",
    nama: "Pelanggan",
    username: "pelanggan1",
    status: "AKTIF",
  });
  return `${CUSTOMER_ACCESS_TOKEN_COOKIE}=${token}`;
}

function uploadRequest(file: File, withSession = true) {
  const formData = new FormData();
  formData.append("file", file);
  const headers = new Headers();
  if (withSession) headers.set("cookie", customerCookie());
  return new NextRequest(UPLOAD_URL, {
    method: "POST",
    headers,
    body: formData,
  });
}

function pngFile(size = PNG_BYTES.length) {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_BYTES);
  return new File([bytes], "foto.png", { type: "image/png" });
}

describe("POST /api/customer/tickets/attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.convertAndSaveImage.mockResolvedValue(
      "/uploads/tickets/upload-1.webp",
    );
  });

  it("menolak unggahan tanpa sesi pelanggan", async () => {
    const response = await POST(uploadRequest(pngFile(), false));

    expect(response.status).toBe(401);
    expect(mockFns.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("menyimpan gambar valid ke folder lampiran tiket", async () => {
    const response = await POST(uploadRequest(pngFile()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.url).toBe("/uploads/tickets/upload-1.webp");
    // Each customer uploads into their own folder; /uploads/ and the reply
    // route both key ownership on it.
    expect(mockFns.convertAndSaveImage.mock.calls[0]![1]).toBe(
      "public/uploads/tickets/p-pelanggan-1",
    );
  });

  it("menolak tipe file selain gambar", async () => {
    const pdf = new File([Uint8Array.from([0x25, 0x50, 0x44, 0x46])], "a.pdf", {
      type: "application/pdf",
    });

    const response = await POST(uploadRequest(pdf));

    expect(response.status).toBe(400);
    expect(mockFns.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("menolak file yang mengaku PNG tetapi isinya bukan PNG", async () => {
    const fake = new File(
      [Uint8Array.from([0x3c, 0x73, 0x76, 0x67])],
      "x.png",
      {
        type: "image/png",
      },
    );

    const response = await POST(uploadRequest(fake));

    expect(response.status).toBe(400);
    expect(mockFns.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("menolak file lebih dari 5MB", async () => {
    const response = await POST(uploadRequest(pngFile(SIX_MB)));

    expect(response.status).toBe(400);
    expect(mockFns.convertAndSaveImage).not.toHaveBeenCalled();
  });
});
