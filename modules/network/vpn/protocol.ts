import type { VpnProtocol } from "@prisma/client";
import type { CoreVpnProtocol } from "./types";

/** Protokol di database ke nilai yang dipakai API core. */
export function toCoreProtocol(protocol: VpnProtocol): CoreVpnProtocol {
  return protocol === "L2TP" ? "l2tp" : "wireguard";
}

/** Protokol dari core ke database; nilai kosong dari core lama berarti WireGuard. */
export function fromCoreProtocol(
  protocol: CoreVpnProtocol | undefined,
): VpnProtocol {
  return protocol === "l2tp" ? "L2TP" : "WIREGUARD";
}
