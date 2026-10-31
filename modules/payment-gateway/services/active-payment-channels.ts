import { LRUCache } from "lru-cache";
import { logger } from "@/lib/logger";
import { PaymentGatewayManager } from "./PaymentGatewayService";

// Kanal diaktifkan dari dasbor gateway dan jarang berubah.
const ACTIVE_CHANNELS_TTL_MS = 10 * 60 * 1000;
// Gateway yang tidak terjangkau tidak ditanya ulang di setiap pembukaan
// halaman pilihan metode.
const UNREACHABLE_RETRY_MS = 60 * 1000;
const MAX_CACHED_LOOKUPS = 500;
// Nominal datang dari ?amount= pelanggan, jadi tidak boleh menjadi kunci
// cache apa adanya: tiap nominal berbeda memaksa panggilan baru ke Duitku.
// Nominal dibulatkan ke bawah ke salah satu batas ini (yang terkecil dan
// terbesar sekaligus menjadi batas jepit), sehingga satu tenant dan gateway
// paling banyak memicu tujuh panggilan per masa simpan. Batasnya angka bulat
// tempat minimum kanal biasa berada (Duitku: "Minimum Payment 10000 IDR").
const CHANNEL_CHECK_AMOUNT_FLOORS = [
  1_000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000,
];

type GatewayChannelSource = Pick<
  PaymentGatewayManager,
  "getActivePaymentMethods"
>;

const activeChannels = new LRUCache<string, { codes: Set<string> | null }>({
  max: MAX_CACHED_LOOKUPS,
  ttl: ACTIVE_CHANNELS_TTL_MS,
});

/**
 * Kode kanal yang dilaporkan gateway aktif untuk merchant tenant pada nominal
 * ini (Duitku getpaymentmethod), disimpan sementara. null berarti tidak
 * diketahui (gateway tanpa daftar kanal, atau tidak terjangkau): pemanggil
 * menawarkan katalog statis.
 */
export async function getActivePaymentChannels(
  input: { provider: string; tenantId?: string; amount: number },
  gateway: GatewayChannelSource = new PaymentGatewayManager(),
): Promise<Set<string> | null> {
  const amount = toChannelCheckAmount(input.amount);
  const key = `${input.tenantId ?? "-"}:${input.provider}:${amount}`;
  const cached = activeChannels.get(key);
  if (cached) return cached.codes;

  try {
    const codes = await gateway.getActivePaymentMethods(
      input.provider,
      amount,
      input.tenantId,
    );
    const channels = codes ? new Set(codes) : null;
    activeChannels.set(key, { codes: channels });
    return channels;
  } catch (error) {
    logger.warn(
      `[PaymentMethods] Kanal aktif ${input.provider} tidak terbaca; katalog statis dipakai:`,
      error,
    );
    activeChannels.set(key, { codes: null }, { ttl: UNREACHABLE_RETRY_MS });
    return null;
  }
}

function toChannelCheckAmount(amount: number): number {
  let floor = CHANNEL_CHECK_AMOUNT_FLOORS[0];
  for (const candidate of CHANNEL_CHECK_AMOUNT_FLOORS) {
    if (amount >= candidate) floor = candidate;
  }
  return floor;
}
