import { ensurePermission } from "@/lib/rbac";
import { MarketPriceClient } from "./MarketPriceClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Referensi Harga Pasar - Admin Portal",
};

/**
 * Halaman placeholder Referensi Harga Pasar.
 *
 * Page ini sengaja dibuat read-only/coming-soon dulu karena entitas
 * MarketPrice sebagai master data harga referensi belum di-model.
 * Sebelumnya halaman ini `notFound()` sehingga klik dari sidebar
 * memberikan 404 — sekarang minimal user mendarat di view yang jelas.
 */
export default async function MarketPricePage() {
  await ensurePermission("market_price:read");
  return <MarketPriceClient />;
}
