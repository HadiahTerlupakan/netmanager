import { describe, expect, it } from "vitest";

import {
  isPublicUploadPath,
  sanitizeUploadFolder,
  validateUploadFile,
} from "@/lib/upload/upload-policy";

describe("upload policy", () => {
  it("rejects unknown folder", () => {
    const result = sanitizeUploadFolder("evil-folder");
    expect(result.ok).toBe(false);
  });

  it("accepts invoice pdf under size limit", () => {
    const result = validateUploadFile({
      folder: "invoices",
      mimeType: "application/pdf",
      size: 1024 * 1024,
      fileName: "invoice-001.pdf",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects oversize file", () => {
    const result = validateUploadFile({
      folder: "invoices",
      mimeType: "application/pdf",
      size: 6 * 1024 * 1024,
      fileName: "invoice-001.pdf",
    });

    expect(result.ok).toBe(false);
  });

  it("allows attendance uploads to stay public when served from local storage", () => {
    expect(isPublicUploadPath("/uploads/employee/attendance/test.webp")).toBe(
      true,
    );
    expect(
      isPublicUploadPath("/uploads/employee/attendance/user-1/test.webp"),
    ).toBe(true);
    expect(isPublicUploadPath("/uploads/profiles/test.webp")).toBe(false);
  });
});
