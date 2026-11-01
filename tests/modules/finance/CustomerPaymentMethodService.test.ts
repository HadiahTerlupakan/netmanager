import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerPaymentMethodService } from "@/modules/finance";

const gatewayManager = {
  getEnabledProviders: vi.fn(),
};
const bankAccountRepository = {
  findActive: vi.fn(),
};
const findActiveChannels = vi.fn();

const service = () =>
  new CustomerPaymentMethodService(
    gatewayManager as never,
    bankAccountRepository as never,
    findActiveChannels,
  );

const duitkuCodes = (methods: Array<{ provider: string; code: string }>) =>
  methods.filter((m) => m.provider === "DUITKU").map((m) => m.code);

describe("CustomerPaymentMethodService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bankAccountRepository.findActive.mockResolvedValue([]);
    findActiveChannels.mockResolvedValue(null);
  });

  it("menggabungkan metode provider dan rekening manual aktif", async () => {
    gatewayManager.getEnabledProviders.mockResolvedValue([
      { provider: "MOOTA" },
    ]);
    bankAccountRepository.findActive.mockResolvedValue([
      {
        id: "bank-1",
        bankName: "BCA",
        accountName: "PT Net",
        accountNumber: "123",
      },
    ]);

    const methods = await service().getCustomerPaymentMethods("tenant-1");

    expect(gatewayManager.getEnabledProviders).toHaveBeenCalledWith("tenant-1");
    expect(bankAccountRepository.findActive).toHaveBeenCalledWith("tenant-1");
    expect(methods).toContainEqual(
      expect.objectContaining({ id: "manual_bank-1", code: "MANUAL_bank-1" }),
    );
    expect(methods.some((method) => method.provider === "MOOTA")).toBe(true);
  });

  // Produksi 2026-10-31: DANA, ShopeePay, dan FT ditawarkan walau belum aktif
  // di merchant, lalu setiap pembayarannya ditolak Duitku dengan 502.
  describe("kanal Duitku", () => {
    beforeEach(() => {
      gatewayManager.getEnabledProviders.mockResolvedValue([
        { provider: "DUITKU" },
      ]);
    });

    it("hanya kanal yang dilaporkan aktif oleh Duitku yang ditawarkan", async () => {
      findActiveChannels.mockResolvedValue(new Set(["BC", "SP", "IR", "XX"]));

      const methods = await service().getCustomerPaymentMethods("tenant-1");

      expect(duitkuCodes(methods)).toEqual(["BC", "SP", "IR"]);
    });

    it("nominal tagihan dipakai untuk menanyakan kanal aktif", async () => {
      await service().getCustomerPaymentMethods("tenant-1", 11100);

      expect(findActiveChannels).toHaveBeenCalledWith({
        provider: "DUITKU",
        tenantId: "tenant-1",
        amount: 11100,
      });
    });

    it("tanpa nominal, kanal ditanyakan dengan nominal tagihan biasa", async () => {
      await service().getCustomerPaymentMethods("tenant-1");

      expect(findActiveChannels).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100000 }),
      );
    });

    // Uji produksi 2026-11-01: VA BCA, Mandiri, BRI, dan Indomaret ditolak
    // Duitku di Rp 9.990 ("Minimum Payment 10000 IDR"), sedangkan QRIS, OVO,
    // dan LinkAja menerimanya; dulu keempatnya tetap ditawarkan.
    it("kanal yang menolak nominal di bawah minimumnya tidak ditawarkan", async () => {
      const codes = duitkuCodes(
        await service().getCustomerPaymentMethods("tenant-1", 9990),
      );

      expect(codes).toEqual(expect.arrayContaining(["SP", "OV", "LA"]));
      for (const code of ["BC", "M2", "BR", "IR"]) {
        expect(codes).not.toContain(code);
      }
    });

    it("kanal bernominal minimum ditawarkan lagi tepat di minimumnya", async () => {
      const codes = duitkuCodes(
        await service().getCustomerPaymentMethods("tenant-1", 10000),
      );

      expect(codes).toEqual(
        expect.arrayContaining(["BC", "M2", "BR", "IR", "SP"]),
      );
    });

    it("Duitku yang tidak terjangkau tidak mengosongkan pilihan: katalog statis dipakai", async () => {
      findActiveChannels.mockResolvedValue(null);

      const methods = await service().getCustomerPaymentMethods("tenant-1");

      expect(duitkuCodes(methods)).toEqual(
        expect.arrayContaining(["BC", "SP", "DA", "FT", "IR"]),
      );
    });
  });
});
