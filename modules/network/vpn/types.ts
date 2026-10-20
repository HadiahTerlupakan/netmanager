/** Status hub di core netmanager-vpn. */
export type CoreHubStatus =
  | "pending_install"
  | "online"
  | "offline"
  | "expired";

/** Hub WireGuard seperti dikembalikan API core. */
export interface CoreHub {
  id: string;
  name: string;
  publicHost: string;
  listenPort: number;
  /** Kunci publik WireGuard hub, untuk endpoint peer router. */
  publicKey: string;
  status: CoreHubStatus;
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
  hubs: { hubId: string; name: string; priority: number; syncState: string }[];
  activeHubId: string | null;
  lastHandshakeAt: string | null;
  events: { fromHubId: string; toHubId: string; at: string }[];
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
