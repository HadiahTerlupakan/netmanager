import { FinanceService } from "@/modules/finance";
import * as z from "zod";
import { createHandler, apiSuccess } from "@/lib/api";

const accountSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi"),
  type: z.enum(["BANK", "CASH", "EWALLET", "OTHER"]),
  accountNumber: z.string().optional(),
  description: z.string().optional(),
  initialBalance: z.number().optional().default(0),
});

export const GET = createHandler(
  { auth: true, permissions: ["finance:read"] },
  async () => {
    const financeService = new FinanceService();
    const accounts = await financeService.getAccounts();
    return apiSuccess(accounts);
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["treasury:create", "finance:read"],
    schema: accountSchema,
  },
  async (req, ctx) => {
    const financeService = new FinanceService();
    const { accountNumber, description, ...rest } = ctx.validated;

    const account = await financeService.createAccount({
      ...rest,
      ...(accountNumber ? { accountNumber } : {}),
      ...(description ? { description } : {}),
    });

    return apiSuccess(account, {
      status: 201,
      message: "Akun berhasil dibuat",
    });
  },
);
