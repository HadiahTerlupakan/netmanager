// @vitest-environment jsdom

import React, { act, createRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PhotoUploadRef,
  UploadedPhoto,
} from "@/components/inventory/PhotoUpload";
import { RestockReceiveModal } from "@/app/admin/inventory/restock/RestockReceiveModal";
import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const UPLOADED_URL = "https://cdn.radpro.id/uploads/inventory/masuk/bukti.webp";

const REQUEST: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-20260916-0001",
  status: "ORDERED",
  createdAt: "2026-09-16T00:00:00.000Z",
  requester: { name: "Admin Gudang" },
  gudangId: "gudang-1",
  gudang: { id: "gudang-1", nama: "Gudang Utama" },
  items: [
    {
      id: "item-1",
      barangId: "barang-1",
      jumlah: 10,
      receivedQuantity: 0,
      barang: { nama: "ONT ZTE F609", kode: "ONT-01", satuan: "pcs" },
    },
  ],
};

async function waitFor(predicate: () => unknown, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timeout after ${timeoutMs}ms`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

function ReceiveModalHarness({
  photoUploadRef,
}: {
  photoUploadRef: React.RefObject<PhotoUploadRef | null>;
}) {
  const [receivedPhotos, setReceivedPhotos] = useState<UploadedPhoto[]>([]);

  return (
    <RestockReceiveModal
      request={REQUEST}
      receivedItems={{ "barang-1": 10 }}
      onReceivedItemsChange={() => {}}
      barangs={[]}
      substitutions={{}}
      onSubstitutionsChange={() => {}}
      cancellations={{}}
      onCancellationsChange={() => {}}
      receivedPhotos={receivedPhotos}
      onReceivedPhotosChange={setReceivedPhotos}
      isFinishingPO={false}
      onIsFinishingPOChange={() => {}}
      submitting={false}
      photoUploadRef={photoUploadRef}
      onClose={() => {}}
      onSubmit={() => {}}
    />
  );
}

function selectPhoto(file: File) {
  const input =
    document.body.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Input file foto tidak ditemukan");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Verifikasi Barang Sampai — kontrak ref PhotoUpload", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { urls: [UPLOADED_URL], count: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("mengunggah foto yang sudah dipilih saat ref dipanggil", async () => {
    const photoUploadRef = createRef<PhotoUploadRef>();

    await act(async () => {
      root.render(<ReceiveModalHarness photoUploadRef={photoUploadRef} />);
    });

    await act(async () => {
      selectPhoto(new File(["foto"], "bukti.png", { type: "image/png" }));
    });
    await waitFor(() => document.body.textContent?.includes("Foto (1/3)"));

    expect(photoUploadRef.current).not.toBeNull();

    let urls: string[] = [];
    await act(async () => {
      urls = await photoUploadRef.current!.uploadPhotos();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/inventory/upload-photo",
      expect.objectContaining({ method: "POST" }),
    );
    expect(urls).toEqual([UPLOADED_URL]);
  });
});
