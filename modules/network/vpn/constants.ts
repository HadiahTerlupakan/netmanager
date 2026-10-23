// Berkas murni tanpa dependensi server: dipakai juga oleh validasi dan UI.

/** Port API RouterOS yang dibuka script VPN; mode VPN tidak bisa memakai port lain. */
export const VPN_API_PORT = 8728;

/** Status hub core yang boleh dipilih untuk router. */
export const VPN_SERVER_STATUS_ONLINE = "online";

/**
 * Batas waktu nyata satu operasi RouterOS VPN, dari connect sampai tulis
 * terakhir. `timeout` node-routeros-v2 dibaca dalam detik dan connect ke port
 * yang difilter menunggu SYN timeout OS, jadi batasnya dipasang sendiri di
 * `withVpnRouterConnection`.
 */
export const VPN_ROUTEROS_OP_TIMEOUT_MS = 15_000;
