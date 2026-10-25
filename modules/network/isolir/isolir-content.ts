import { prismaAuth } from "@/modules/database";
import { getCompanyBankAccountService } from "@/modules/finance";
import { getLogoSettings } from "@/modules/settings";
import type { IsolirPage } from "@prisma/client";
import { IsolirPageRepository } from "./IsolirPageRepository";
import { buildLogoDataUri } from "./isolir-logo";
import type { IsolirContent, IsolirPayment } from "./isolir-page.types";

export const DEFAULT_PRIMARY_COLOR = "#1d4ed8";
export const DEFAULT_TITLE = "Layanan Internet Anda Sedang Diisolir";
export const DEFAULT_MESSAGE =
  "Layanan internet Anda dihentikan sementara. Silakan lakukan pembayaran atau hubungi layanan pelanggan kami agar layanan aktif kembali.";
export const DEFAULT_ISP_NAME = "Layanan Internet";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const INDONESIA_COUNTRY_CODE = "62";

function filled(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Nomor lokal 08xx dan 8xx menjadi format internasional wa.me tanpa plus. */
function normalizeWhatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return INDONESIA_COUNTRY_CODE + digits.slice(1);
  }
  if (digits.startsWith("8")) {
    return INDONESIA_COUNTRY_CODE + digits;
  }
  return digits;
}

function parsePayments(value: unknown): IsolirPayment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const { label, number, holder } = item as Record<string, unknown>;
    return typeof label === "string" &&
      typeof number === "string" &&
      typeof holder === "string"
      ? [{ label, number, holder }]
      : [];
  });
}

async function readTenantName(tenantId: string | null): Promise<string | null> {
  if (!tenantId) {
    return null;
  }
  // Tenant ada di ignoreModels, jadi dibaca lewat prismaAuth.
  const tenant = await prismaAuth.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return tenant?.name ?? null;
}

async function readBankPayments(
  tenantId: string | null,
): Promise<IsolirPayment[]> {
  if (!tenantId) {
    return [];
  }
  const accounts =
    await getCompanyBankAccountService().listActiveAccounts(tenantId);
  return accounts.map((account) => ({
    label: account.bankName,
    number: account.accountNumber,
    holder: account.accountName,
  }));
}

async function readLogo(
  tenantId: string | null,
  page: IsolirPage | null,
): Promise<string | null> {
  const own = filled(page?.logoUrl);
  if (own) {
    return buildLogoDataUri(own);
  }
  if (!tenantId) {
    return null;
  }
  const { logoAplikasi } = await getLogoSettings(tenantId);
  return buildLogoDataUri(logoAplikasi);
}

function buildWhatsapp(page: IsolirPage | null): IsolirContent["whatsapp"] {
  const number = normalizeWhatsappNumber(page?.whatsappNumber ?? "");
  return number ? { number, text: page?.whatsappText ?? "" } : null;
}

function buildLink(page: IsolirPage | null): IsolirContent["link"] {
  const label = filled(page?.linkLabel);
  const url = filled(page?.linkUrl);
  return label && url ? { label, url } : null;
}

/**
 * Menyusun isi halaman isolir satu tenant. Selalu memfilter dengan tenantId
 * yang diberikan, jadi aman dipanggil dari request maupun dari
 * `runAsSystemContext` di pekerjaan latar belakang.
 */
export async function resolveIsolirContent(
  tenantId: string | null,
): Promise<IsolirContent> {
  const page = await IsolirPageRepository.findByTenant(tenantId);
  const [tenantName, bankPayments, logoDataUri] = await Promise.all([
    readTenantName(tenantId),
    readBankPayments(tenantId),
    readLogo(tenantId, page),
  ]);
  const ownPayments = parsePayments(page?.payments);
  const color = filled(page?.primaryColor);

  return {
    ispName: filled(page?.ispName) ?? tenantName ?? DEFAULT_ISP_NAME,
    title: filled(page?.title) ?? DEFAULT_TITLE,
    message: filled(page?.message) ?? DEFAULT_MESSAGE,
    logoDataUri,
    payments: ownPayments.length > 0 ? ownPayments : bankPayments,
    whatsapp: buildWhatsapp(page),
    link: buildLink(page),
    contactText: filled(page?.contactText),
    primaryColor:
      color && HEX_COLOR_PATTERN.test(color) ? color : DEFAULT_PRIMARY_COLOR,
  };
}
