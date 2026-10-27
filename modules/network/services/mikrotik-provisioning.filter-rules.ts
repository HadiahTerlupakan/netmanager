import { ISOLIR_ALLOW_LIST } from "./mikrotik-provisioning.isolir-allow";

const ADDRESS_LIST_NAME = "netmanager_allow";
const EXPIRED_NETWORK = "10.127.0.0/18";

/**
 * Rule filter milik provisioning, berurutan: rule baru disisipkan di atas
 * rule pertama chain, jadi urutan array ini juga urutannya di router.
 */
export const FILTER_RULES = [
  {
    comment: "netmanager-input-bypass",
    addArgs: [
      "=chain=input",
      "=action=accept",
      `=src-address-list=${ADDRESS_LIST_NAME}`,
    ],
    log: "Added Firewall Filter: Input Bypass (Top Priority)",
  },
  {
    comment: "netmanager-forward-bypass",
    addArgs: [
      "=chain=forward",
      "=action=accept",
      `=dst-address-list=${ADDRESS_LIST_NAME}`,
    ],
    log: "Added Firewall Filter: Forward Bypass (Top Priority)",
  },
  {
    comment: "netmanager-isolir-allow",
    // Di router lama rule ini ditambahkan paling atas, tetap di atas rule
    // reject isolir di bawah.
    addArgs: [
      "=chain=forward",
      "=action=accept",
      `=src-address=${EXPIRED_NETWORK}`,
      `=dst-address-list=${ISOLIR_ALLOW_LIST}`,
    ],
    log: "Added Firewall Filter: Isolir Walled Garden",
  },
  {
    comment: "netmanager-drop-expired-tcp",
    addArgs: [
      "=chain=forward",
      "=action=reject",
      "=protocol=tcp",
      `=src-address=${EXPIRED_NETWORK}`,
    ],
    log: "Added Firewall Filter: Drop Expired TCP",
  },
  {
    comment: "netmanager-drop-expired-udp",
    addArgs: [
      "=chain=forward",
      "=action=reject",
      "=protocol=udp",
      `=src-address=${EXPIRED_NETWORK}`,
      "=dst-port=!53",
    ],
    log: "Added Firewall Filter: Drop Expired UDP",
  },
  {
    comment: "netmanager-drop-expired-icmp",
    // Added at the top on routers provisioned before it existed, above the
    // accept rules, so it exempts the walled garden itself.
    addArgs: [
      "=chain=forward",
      "=action=reject",
      "=protocol=icmp",
      `=src-address=${EXPIRED_NETWORK}`,
      `=dst-address-list=!${ISOLIR_ALLOW_LIST}`,
    ],
    log: "Added Firewall Filter: Drop Expired ICMP",
  },
] as const;
