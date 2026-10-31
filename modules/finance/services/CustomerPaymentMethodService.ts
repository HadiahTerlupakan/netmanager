import { CompanyBankAccountRepository } from "../repositories/CompanyBankAccountRepository";
import {
  PaymentGatewayManager,
  getActivePaymentChannels,
  getCustomerPaymentMethodsByProvider,
} from "@/modules/payment-gateway";

interface GatewayManagerLike {
  getEnabledProviders(tenantId?: string): Promise<Array<{ provider: string }>>;
}

type ActiveChannelLookup = (input: {
  provider: string;
  tenantId?: string;
  amount: number;
}) => Promise<Set<string> | null>;

// Nominal tagihan bulanan biasa, untuk klien yang tidak mengirim nominal:
// kanal tidak tersembunyi hanya karena nominal contoh di bawah minimumnya.
const DEFAULT_CHANNEL_CHECK_AMOUNT = 100000;

interface BankAccountRepositoryLike {
  findActive(tenantId?: string): Promise<ManualBankAccount[]>;
}

interface ManualBankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export class CustomerPaymentMethodService {
  constructor(
    private readonly gatewayManager: GatewayManagerLike = new PaymentGatewayManager(),
    private readonly bankAccountRepository: BankAccountRepositoryLike = new CompanyBankAccountRepository(),
    private readonly findActiveChannels: ActiveChannelLookup = getActivePaymentChannels,
  ) {}

  /**
   * Mengambil metode pembayaran customer dari gateway aktif dan rekening
   * manual. `amount`: total tagihan yang akan dibayar, bila diketahui.
   */
  async getCustomerPaymentMethods(tenantId?: string, amount?: number) {
    const providers = await this.gatewayManager.getEnabledProviders(tenantId);
    const gatewayMethods = await Promise.all(
      providers.map((provider) =>
        this.findOfferedMethods(
          provider.provider,
          tenantId,
          amount ?? DEFAULT_CHANNEL_CHECK_AMOUNT,
        ),
      ),
    );
    const paymentMethods = gatewayMethods.flat();

    paymentMethods.push(
      ...this.mapManualMethods(
        await this.bankAccountRepository.findActive(tenantId),
      ),
    );

    const firstProvider = providers[0];
    if (paymentMethods.length === 0 && firstProvider) {
      paymentMethods.push({
        id: "generic_gateway",
        name: "Online Payment",
        provider: firstProvider.provider,
        type: "ONLINE",
        code: "ONLINE",
        group: "Online Payment",
      });
    }

    return paymentMethods;
  }

  /**
   * Metode katalog gateway ini yang dilaporkan aktif untuk merchant; kanal
   * yang belum diaktifkan selalu ditolak saat checkout. Daftar kanal yang
   * tidak terbaca tidak mengosongkan pilihan: seluruh katalog ditawarkan.
   */
  private async findOfferedMethods(
    provider: string,
    tenantId: string | undefined,
    amount: number,
  ) {
    const catalog = getCustomerPaymentMethodsByProvider(provider);
    const active = await this.findActiveChannels({
      provider,
      tenantId,
      amount,
    });
    return active
      ? catalog.filter((method) => active.has(method.code))
      : catalog;
  }

  private mapManualMethods(accounts: ManualBankAccount[]) {
    return accounts.map((account) => ({
      id: `manual_${account.id}`,
      name: account.bankName,
      provider: "MANUAL",
      type: "MANUAL",
      code: `MANUAL_${account.id}`,
      group: "Transfer Manual",
      details: {
        bankName: account.bankName,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
      },
    }));
  }
}
