import { prismaBilling } from "@/lib/prisma-billing";
import type {
  Invoice,
  Payment,
  PrismaClient,
  Prisma,
} from "@prisma/client-billing";

/**
 * Akses invoice + payment untuk resolusi mutasi bank yang belum ter-match.
 *
 * Scope sengaja sempit: kebutuhan invoice/payment umum sudah dilayani
 * `InvoiceRepository` dan `PaymentRepository`. Jangan tambah query baru di
 * sini kecuali memang khusus alur unmatched mutation.
 */
export class BillingRepository {
  constructor(private readonly client: PrismaClient = prismaBilling) {}

  /** Mengambil invoice beserta pembayarannya untuk validasi pencocokan mutasi. */
  async findInvoiceById(
    id: string,
  ): Promise<(Invoice & { payment: Payment[] }) | null> {
    return this.client.invoice.findUnique({
      where: { id },
      include: { payment: true },
    });
  }

  /** Membuat payment hasil resolusi mutasi bank. */
  async createPayment(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.client.payment.create({ data });
  }
}
