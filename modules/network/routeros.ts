// Sub-entrypoint murni untuk UI: escaping string RouterOS tanpa dependensi
// server, sehingga script yang dibuat di browser memakai aturan yang sama
// dengan script VPN.
export { quoteRouterOs } from "./services/vpn-api-user-script";
