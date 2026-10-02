import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendFcm = vi.hoisted(() => vi.fn());
const mockRedisSet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/messaging", () => ({ sendFCMNotification: mockSendFcm }));
vi.mock("@/lib/redis", () => ({ redis: { set: mockRedisSet } }));
vi.mock("@/modules/database", () => ({ prismaAuth: {} }));

import { InvestorPushService } from "@/modules/investor/services/InvestorPushService";
import type { InvestorRepository } from "@/modules/investor/repositories/InvestorRepository";

const repo = {
  findFcmTokens: vi.fn(),
  addFcmToken: vi.fn(),
  removeFcmToken: vi.fn(),
};
const service = new InvestorPushService(repo as unknown as InvestorRepository);
const PESAN = {
  investorId: "inv-1",
  tenantId: "tenant-1",
  kunciUnik: "uang-dikirim:po-1",
  judul: "Uang sudah dikirim",
  isi: "Rp 2.000.000 sudah dikirim ke rekening Anda.",
  url: "/(investor)/keuangan?bagian=diterima",
};

describe("InvestorPushService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisSet.mockResolvedValue("OK");
    repo.findFcmTokens.mockResolvedValue(["tok-a", "tok-b"]);
  });

  it("mengirim ke semua HP investor dengan tautan layar di data", async () => {
    await service.kirim(PESAN);

    expect(mockRedisSet).toHaveBeenCalledWith(
      "investor-push:uang-dikirim:po-1",
      "1",
      "EX",
      expect.any(Number),
      "NX",
    );
    expect(mockSendFcm).toHaveBeenCalledWith(["tok-a", "tok-b"], PESAN.judul, PESAN.isi, {
      url: PESAN.url,
      sourceType: "INVESTOR",
      sourceId: "uang-dikirim:po-1",
    });
  });

  it("token dicari dengan tenant asal event", async () => {
    await service.kirim(PESAN);
    expect(repo.findFcmTokens).toHaveBeenCalledWith("inv-1", "tenant-1");
  });

  it("job diulang (kunci sudah ada) tidak mengirim ulang", async () => {
    mockRedisSet.mockResolvedValue(null);
    await service.kirim(PESAN);
    expect(mockSendFcm).not.toHaveBeenCalled();
  });

  it("Redis gagal → tetap dikirim; investor tanpa HP terdaftar → tidak ada kiriman", async () => {
    mockRedisSet.mockRejectedValueOnce(new Error("redis mati"));
    await service.kirim(PESAN);
    expect(mockSendFcm).toHaveBeenCalledTimes(1);

    repo.findFcmTokens.mockResolvedValueOnce([]);
    await service.kirim({ ...PESAN, kunciUnik: "lain" });
    expect(mockSendFcm).toHaveBeenCalledTimes(1);
  });

  it("aturToken meneruskan add/remove ke repository", async () => {
    repo.addFcmToken.mockResolvedValue(false);
    await expect(service.aturToken("inv-1", "tok", "add")).resolves.toBe(false);
    await expect(service.aturToken("inv-1", "tok", "remove")).resolves.toBe(true);
    expect(repo.removeFcmToken).toHaveBeenCalledWith("inv-1", "tok");
  });
});
