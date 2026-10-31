/**
 * Entry publik SEMPIT module payment-gateway untuk API route dan layout
 * admin: peringatan gateway sandbox di produksi.
 *
 * Health check dan layout admin dimuat di setiap probe dan setiap halaman
 * admin; `index.ts` memuat seluruh service gateway beserta module finance,
 * yang tidak dibutuhkan keduanya.
 */
export {
  isSandboxGatewayLive,
  SANDBOX_GATEWAY_WARNING,
} from "./services/sandbox-gateway-warning";
