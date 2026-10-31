import { LRUCache } from "lru-cache";
import { logger } from "@/lib/logger";
import { PaymentGatewayManager } from "./PaymentGatewayService";

// Kanal diaktifkan dari dasbor gateway dan jarang berubah.
const ACTIVE_CHANNELS_TTL_MS = 10 * 60 * 1000;
// Gateway yang tidak terjangkau tidak ditanya ulang di setiap pembukaan
// halaman pilihan metode.
const UNREACHABLE_RETRY_MS = 60 * 1000;
const MAX_CACHED_LOOKUPS = 500;

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
  const key = `${input.tenantId ?? "-"}:${input.provider}:${input.amount}`;
  const cached = activeChannels.get(key);
  if (cached) return cached.codes;

  try {
    const codes = await gateway.getActivePaymentMethods(
      input.provider,
      input.amount,
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
