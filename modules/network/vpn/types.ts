/** Status hub di core netmanager-vpn. */
export type CoreHubStatus =
  | "pending_install"
  | "online"
  | "offline"
  | "expired";

/** Protokol VPN sebuah router di core. */
export type CoreVpnProtocol = "wireguard" | "l2tp";

/** Hub VPN seperti dikembalikan API core. */
export interface CoreHub {
  id: string;
  name: string;
  publicHost: string;
  listenPort: number;
  /** Kunci publik WireGuard hub, untuk endpoint peer router. */
  publicKey: string;
  status: CoreHubStatus;
  /** Protokol yang dilayani hub; core lama tidak mengirimnya. */
  protocols?: string[];
  routerCount: number;
  lastSeenAt: string | null;
}

/** Router beserta hub-nya seperti dikembalikan API core. */
export interface CoreRouter {
  id: string;
  label: string;
  ref: string;
  address: string;
  status: "pending" | "active";
  /** Core lama tidak mengirimnya; artinya WireGuard. */
  protocol?: CoreVpnProtocol;
  hubs: { hubId: string; name: string; priority: number; syncState: string }[];
  activeHubId: string | null;
  lastHandshakeAt: string | null;
  events: { fromHubId: string; toHubId: string; at: string }[];
}

/** Server pertama (prioritas terendah) router, untuk skrip koneksi awal. */
export interface CoreFirstServer {
  protocol: CoreVpnProtocol;
  host?: string;
  port?: number;
  /** Hanya WireGuard. */
  publicKey?: string;
  /** Hanya L2TP: PSK IPsec hub dalam teks asli. */
  ipsecSecret?: string;
}

/** Peer WireGuard untuk admin seperti dikembalikan API core. */
export interface CoreAdminPeer {
  id: string;
  label: string;
  address: string;
  publicKey: string;
  createdAt: string;
}

/** Bagian skrip RouterOS yang bisa diminta dari core. */
export type RouterScriptPart = "full" | "scheduler" | "switch";
