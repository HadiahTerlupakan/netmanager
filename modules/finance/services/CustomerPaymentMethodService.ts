import { CompanyBankAccountRepository } from "../repositories/CompanyBankAccountRepository";
import {
  PaymentGatewayManager,
  getCustomerPaymentMethodsByProvider,
} from "@/modules/payment-gateway";

interface GatewayManagerLike {
  getEnabledProviders(): Promise<Array<{ provider: string }>>;
}

interface BankAccountRepositoryLike {
  findActive(): Promise<ManualBankAccount[]>;
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
  ) {}

  /** Mengambil metode pembayaran customer dari gateway aktif dan rekening manual. */
  async getCustomerPaymentMethods() {
    const providers = await this.gatewayManager.getEnabledProviders();
    const paymentMethods = providers.flatMap((provider) =>
      getCustomerPaymentMethodsByProvider(provider.provider),
    );

    paymentMethods.push(
      ...this.mapManualMethods(await this.bankAccountRepository.findActive()),
    );

    if (paymentMethods.length === 0 && providers.length > 0) {
      paymentMethods.push({
        id: "generic_gateway",
        name: "Online Payment",
        provider: providers[0].provider,
        type: "ONLINE",
        code: "ONLINE",
        group: "Online Payment",
      });
    }

    return paymentMethods;
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
