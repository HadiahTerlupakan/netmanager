import { vi } from "vitest";
import type { LegalDocumentEntity } from "@/modules/legal/domain/entities/LegalDocument";

/** Dokumen legal contoh dengan nilai bawaan yang netral. */
export const legalDocument = (
  over: Partial<LegalDocumentEntity> = {},
): LegalDocumentEntity => ({
  id: "doc-1",
  title: "PKS Reseller Sumber Jaya",
  documentType: "KONTRAK",
  category: { id: "cat-1", name: "PKS Reseller", confidentiality: "BIASA" },
  documentNumber: "PKS/001",
  partyName: "CV Sumber Jaya",
  partyType: null,
  partyId: null,
  startDate: null,
  endDate: null,
  terminatedAt: null,
  terminationReason: null,
  value: null,
  currency: "IDR",
  paymentScheme: null,
  guaranteeDescription: null,
  guaranteeEndDate: null,
  isAutoRenew: false,
  noticePeriodDays: null,
  penaltyNotes: null,
  disputeResolution: null,
  notes: null,
  fileKey: "legal/tenant-1/doc-1/pks.pdf",
  fileName: "pks.pdf",
  fileHash: "a".repeat(64),
  fileContentType: "application/pdf",
  pic: { id: "pic-1", name: "Rina" },
  endorsementId: null,
  previousDocumentId: null,
  renewedById: null,
  createdById: "admin-1",
  tenantId: "tenant-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  obligations: [],
  ...over,
});

/** Repository tiruan dengan semua metode port. */
export const buildLegalRepository = () => ({
  countCategories: vi.fn().mockResolvedValue(1),
  createCategories: vi.fn(),
  listCategories: vi.fn().mockResolvedValue([]),
  findCategoryById: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  findDocuments: vi.fn(),
  findDocumentById: vi.fn(),
  createDocument: vi.fn(async (input: { id: string }) => legalDocument({ id: input.id })),
  updateDocument: vi.fn(async () => legalDocument()),
  terminateDocument: vi.fn(),
  findMonitoredDocuments: vi.fn().mockResolvedValue([]),
  recordReminder: vi.fn().mockResolvedValue(true),
});

export const wib = (date: string) => new Date(`${date}T00:00:00+07:00`);
