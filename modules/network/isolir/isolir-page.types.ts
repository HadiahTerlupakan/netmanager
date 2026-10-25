import type { IsolirPage } from "@prisma/client";

export type IsolirPayment = { label: string; number: string; holder: string };

/** Isi halaman isolir yang sudah final: default terpasang, siap dirender. */
export type IsolirContent = {
  ispName: string;
  title: string;
  message: string;
  logoDataUri: string | null;
  payments: IsolirPayment[];
  whatsapp: { number: string; text: string } | null;
  link: { label: string; url: string } | null;
  contactText: string | null;
  primaryColor: string;
};

/** Field IsolirPage yang boleh diisi tenant. */
export type IsolirPageInput = Omit<
  IsolirPage,
  "id" | "tenantId" | "createdAt" | "updatedAt"
>;
