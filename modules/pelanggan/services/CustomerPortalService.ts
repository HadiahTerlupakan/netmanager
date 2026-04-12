import { PelangganRepository } from "../repositories/PelangganRepository";
import { hash, compare } from "bcryptjs";

export class CustomerPortalService {
  private pelangganRepository: PelangganRepository;

  constructor() {
    this.pelangganRepository = new PelangganRepository();
  }

  /**
   * Get customer profile for customer portal
   */
  async getProfile(customerId: string) {
    const customer =
      await this.pelangganRepository.findByIdWithPackage(customerId);
    if (!customer) {
      throw new Error("Data pelanggan tidak ditemukan");
    }

    return {
      id: customer.id,
      idPelanggan: customer.idPelanggan,
      nama: customer.nama,
      username: customer.username,
      email: customer.email,
      noTelp: customer.noTelp,
      alamat: customer.alamat,
      status: customer.status,
      tipe: customer.tipe,
      tanggalAktif: customer.tanggalAktif,
      jatuhTempo: customer.jatuhTempo,
      lokasi: {
        provinsi: customer.provinsi,
        kabupatenKota: customer.kabupatenKota,
        kecamatan: customer.kecamatan,
        kelurahanDesa: customer.kelurahanDesa,
      },
      preferences: {
        is2FAEnabled: customer.is2FAEnabled,
        isBillNotifEnabled: customer.isBillNotifEnabled,
        isPromoEnabled: customer.isPromoEnabled,
      },
      paket: customer.hargaPaket
        ? {
            nama: customer.hargaPaket.name,
            harga: customer.hargaPaket.harga,
            durasi: customer.hargaPaket.durasi,
            kecepatan: customer.hargaPaket.description,
            bandwidth: customer.hargaPaket.bandwidth
              ? {
                  nama: customer.hargaPaket.bandwidth.name,
                  download: customer.hargaPaket.bandwidth.maxLimitDownload,
                  upload: customer.hargaPaket.bandwidth.maxLimitUpload,
                }
              : null,
          }
        : null,
    };
  }

  /**
   * Get customer package context for portal routes.
   */
  async getCustomerWithPackage(customerId: string) {
    return this.pelangganRepository.findByIdWithPackage(customerId);
  }

  /**
   * Update customer profile (phone, preferences)
   */
  async updateProfile(
    customerId: string,
    data: {
      noTelp?: string;
      is2FAEnabled?: boolean;
      isBillNotifEnabled?: boolean;
      isPromoEnabled?: boolean;
    },
  ) {
    const updateData: Record<string, unknown> = {};

    if (typeof data.is2FAEnabled === "boolean")
      updateData.is2FAEnabled = data.is2FAEnabled;
    if (typeof data.isBillNotifEnabled === "boolean")
      updateData.isBillNotifEnabled = data.isBillNotifEnabled;
    if (typeof data.isPromoEnabled === "boolean")
      updateData.isPromoEnabled = data.isPromoEnabled;
    if (data.noTelp !== undefined) updateData.noTelp = data.noTelp;

    if (Object.keys(updateData).length === 0) {
      throw new Error("Tidak ada data yang diupdate");
    }

    return this.pelangganRepository.updateProfile(customerId, updateData);
  }

  /**
   * Change customer password
   */
  async changePassword(
    customerId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    // Validate new password
    if (newPassword.length < 6) {
      throw new Error("Password baru minimal 6 karakter");
    }

    // Verify current password
    const currentHash =
      await this.pelangganRepository.getPasswordHash(customerId);
    if (!currentHash) {
      throw new Error("Akun tidak memiliki password");
    }

    const isValid = await compare(currentPassword, currentHash);
    if (!isValid) {
      throw new Error("Password saat ini salah");
    }

    // Hash and update new password
    const newHash = await hash(newPassword, 12);
    return this.pelangganRepository.updateProfile(customerId, {
      passwordHash: newHash,
    });
  }

  /**
   * Get payment history with pagination
   */
  async getPaymentHistory(
    customerId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const { payments, total } =
      await this.pelangganRepository.getPaymentHistory(customerId, {
        page,
        limit,
      });

    const formattedPayments = payments.map((pay) => ({
      id: pay.id,
      amount: Number(pay.amount),
      paymentDate: pay.paymentDate,
      paymentMethod: pay.paymentMethod,
      reference: pay.reference,
      notes: pay.notes,
      invoice: pay.invoice
        ? {
            invoiceNumber: pay.invoice.invoiceNumber,
            status: pay.invoice.status,
          }
        : null,
      verified: !!pay.verifiedAt,
    }));

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      payments: formattedPayments,
      summary: {
        totalPaid,
        transactionCount: total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invoices with pagination
   */
  async getInvoices(
    customerId: string,
    page: number = 1,
    limit: number = 10,
    status?: string[],
  ) {
    const { invoices, total } = await this.pelangganRepository.getInvoices(
      customerId,
      { page, limit, status },
    );

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Validate invoices for payment
   */
  async validateInvoicesForPayment(invoiceIds: string[], customerId: string) {
    const validInvoices = await this.pelangganRepository.getInvoicesByIds(
      invoiceIds,
      customerId,
      ["SENT", "OVERDUE"],
    );

    if (validInvoices.length !== invoiceIds.length) {
      throw new Error("Beberapa tagihan tidak valid atau sudah dibayar");
    }

    const totalAmount = validInvoices.reduce(
      (sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.paidAmount)),
      0,
    );

    return { invoices: validInvoices, totalAmount };
  }
}

// Singleton instance
let customerPortalServiceInstance: CustomerPortalService | null = null;

export function getCustomerPortalService(): CustomerPortalService {
  if (!customerPortalServiceInstance) {
    customerPortalServiceInstance = new CustomerPortalService();
  }
  return customerPortalServiceInstance;
}
