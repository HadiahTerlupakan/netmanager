import { z } from "zod";
import { apiSuccess, createHandler } from "@/lib/api";
import { getInvestorDepositService } from "@/modules/investor";

const createDepositSchema = z.object({
  amount: z.number().positive("Amount harus positif"),
  depositType: z.enum(["MODAL_AWAL", "TAMBAHAN_MODAL", "PINJAMAN"]),
  date: z.string().transform((s) => new Date(s)),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  proofFileUrl: z.string().optional(),
});

/** GET: Mengambil daftar deposit untuk investor tertentu. */
export const GET = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const service = getInvestorDepositService();
    const deposits = await service.listByInvestor(id);
    return apiSuccess(deposits);
  },
);

/** POST: Membuat deposit baru untuk investor. */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (req, ctx) => {
    const { id } = ctx.params;
    const body = await req.json();
    const data = createDepositSchema.parse(body);
    const tenantId = ctx.session?.user.tenantId;

    const service = getInvestorDepositService();
    const deposit = await service.createDeposit({
      investorId: id,
      amount: data.amount,
      depositType: data.depositType,
      date: data.date,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountName: data.accountName,
      reference: data.reference,
      notes: data.notes,
      proofFileUrl: data.proofFileUrl,
      tenantId: tenantId ?? undefined,
    });

    return apiSuccess(deposit, { status: 201 });
  },
);
