import { FinanceService } from "@/modules/finance";
import * as z from "zod";
import { createHandler, apiSuccess } from "@/lib/api";
import {
  CASH_ACCOUNT_READ_PERMISSIONS,
  TREASURY_ACCOUNT_CREATE_PERMISSIONS,
} from "@/lib/financial-write-permissions";

const accountSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi"),
  type: z.enum(["BANK", "CASH", "EWALLET", "OTHER"]),
  accountNumber: z.string().optional(),
  description: z.string().optional(),
  initialBalance: z.number().optional().default(0),
  // Tautan COA membuat akun ini bisa dipakai jurnal otomatis.
  coaId: z.string().optional(),
});

export const GET = createHandler(
  { auth: true, permissions: CASH_ACCOUNT_READ_PERMISSIONS },
  async () => {
    const financeService = new FinanceService();
    const accounts = await financeService.getAccounts();
    return apiSuccess(accounts);
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: TREASURY_ACCOUNT_CREATE_PERMISSIONS,
    schema: accountSchema,
  },
  async (req, ctx) => {
    const financeService = new FinanceService();
    const { accountNumber, description, coaId, ...rest } = ctx.validated;

    const account = await financeService.createAccount({
      ...rest,
      tenantId: ctx.session!.user.tenantId ?? null,
      ...(accountNumber ? { accountNumber } : {}),
      ...(description ? { description } : {}),
      ...(coaId ? { coaId } : {}),
    });

    return apiSuccess(account, {
      status: 201,
      message: "Akun berhasil dibuat",
    });
  },
);
