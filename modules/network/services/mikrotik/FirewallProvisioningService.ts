import { logger } from "@/lib/logger";
import { RouterOSAPI } from "node-routeros-v2";
import { MikroTikConnectionHelper } from "./MikroTikConnectionHelper";

const ADDRESS_LIST_NAME = "netmanager_allow";
const INPUT_RULE_COMMENT = "netmanager-input-bypass";
const FORWARD_RULE_COMMENT = "netmanager-forward-bypass";

export interface AddressListItem {
  address: string;
  comment: string;
}

/** Service untuk provisioning firewall rules di MikroTik. */
export class FirewallProvisioningService {
  constructor(private readonly helper: MikroTikConnectionHelper) {}

  /** Provision firewall address lists. */
  async provisionAddressLists(
    conn: RouterOSAPI,
    serverIp: string,
    isolirUrl: string | null | undefined,
  ): Promise<string[]> {
    const logs: string[] = [];
    const items = this.buildAddressListItems(serverIp, isolirUrl);

    for (const item of items) {
      const exists = await this.addressListExists(conn, item.address);
      if (!exists) {
        await this.addAddressList(conn, item);
        logs.push(`Added Firewall Address List: ${item.address}`);
      }
    }

    return logs;
  }

  /** Provision firewall filter rules. */
  async provisionFilterRules(conn: RouterOSAPI): Promise<string[]> {
    const logs: string[] = [];
    const placeBeforeArgs = await this.getTopPositionArgs(conn);

    await this.provisionInputRule(conn, placeBeforeArgs, logs);
    await this.provisionForwardRule(conn, placeBeforeArgs, logs);

    return logs;
  }

  /** Deprovision firewall address lists. */
  async deprovisionAddressLists(
    conn: RouterOSAPI,
    addresses: string[],
  ): Promise<string[]> {
    const logs: string[] = [];

    for (const address of addresses) {
      const existing = await this.findAddressList(conn, address);
      if (existing.length > 0) {
        for (const item of existing) {
          await conn.write("/ip/firewall/address-list/remove", [
            "=.id=" + item[".id"],
          ]);
          await this.helper.delay(200);
          logs.push(`Removed Address List: ${address} (ID: ${item[".id"]})`);
        }
      }
    }

    return logs;
  }

  /** Deprovision firewall filter rules. */
  async deprovisionFilterRules(conn: RouterOSAPI): Promise<string[]> {
    const logs: string[] = [];

    await this.removeRuleByComment(conn, INPUT_RULE_COMMENT, logs);
    await this.removeRuleByComment(conn, FORWARD_RULE_COMMENT, logs);

    return logs;
  }

  private buildAddressListItems(
    serverIp: string,
    isolirUrl: string | null | undefined,
  ): AddressListItem[] {
    const items: AddressListItem[] = [
      { address: serverIp, comment: `accept.${serverIp}` },
    ];

    if (isolirUrl) {
      try {
        const domain = isolirUrl.replace(/^https?:\/\//, "").split("/")[0];
        if (domain) {
          items.push({ address: domain, comment: `accept.${domain}` });
        }
      } catch (_e) {
        logger.warn("Invalid Isolir URL format");
      }
    }

    return items;
  }

  private async addressListExists(
    conn: RouterOSAPI,
    address: string,
  ): Promise<boolean> {
    const existing = await this.findAddressList(conn, address);
    return existing.length > 0;
  }

  private async findAddressList(
    conn: RouterOSAPI,
    address: string,
  ): Promise<Array<{ ".id": string }>> {
    return (await conn.write("/ip/firewall/address-list/print", [
      "?list=" + ADDRESS_LIST_NAME,
      "?address=" + address,
    ])) as Array<{ ".id": string }>;
  }

  private async addAddressList(
    conn: RouterOSAPI,
    item: AddressListItem,
  ): Promise<void> {
    await conn.write("/ip/firewall/address-list/add", [
      "=list=" + ADDRESS_LIST_NAME,
      "=address=" + item.address,
      "=comment=" + item.comment,
    ]);
    await this.helper.delay(200);
  }

  private async getTopPositionArgs(conn: RouterOSAPI): Promise<string[]> {
    try {
      const firstRule = (await conn.write("/ip/firewall/filter/print", [
        "=.proplist=.id",
        "=.limit=1",
      ])) as Array<{ ".id": string }>;

      if (firstRule && firstRule.length > 0) {
        return ["=place-before=" + firstRule[0][".id"]];
      }
    } catch (_e) {
      /* ignore */
    }
    return [];
  }

  private async provisionInputRule(
    conn: RouterOSAPI,
    placeBeforeArgs: string[],
    logs: string[],
  ): Promise<void> {
    const exists = await this.ruleExists(conn, INPUT_RULE_COMMENT);
    if (!exists) {
      await conn.write("/ip/firewall/filter/add", [
        "=chain=input",
        "=action=accept",
        "=src-address-list=" + ADDRESS_LIST_NAME,
        ...placeBeforeArgs,
        "=comment=" + INPUT_RULE_COMMENT,
      ]);
      await this.helper.delay(200);
      logs.push("Added Firewall Filter: Input Bypass (Top Priority)");
    }
  }

  private async provisionForwardRule(
    conn: RouterOSAPI,
    placeBeforeArgs: string[],
    logs: string[],
  ): Promise<void> {
    const exists = await this.ruleExists(conn, FORWARD_RULE_COMMENT);
    if (!exists) {
      await conn.write("/ip/firewall/filter/add", [
        "=chain=forward",
        "=action=accept",
        "=dst-address-list=" + ADDRESS_LIST_NAME,
        ...placeBeforeArgs,
        "=comment=" + FORWARD_RULE_COMMENT,
      ]);
      await this.helper.delay(200);
      logs.push("Added Firewall Filter: Forward Bypass (Top Priority)");
    }
  }

  private async ruleExists(
    conn: RouterOSAPI,
    comment: string,
  ): Promise<boolean> {
    const existing = (await conn.write("/ip/firewall/filter/print", [
      "?comment=" + comment,
    ])) as Array<{ ".id": string }>;
    return existing.length > 0;
  }

  private async removeRuleByComment(
    conn: RouterOSAPI,
    comment: string,
    logs: string[],
  ): Promise<void> {
    const existing = (await conn.write("/ip/firewall/filter/print", [
      "?comment=" + comment,
    ])) as Array<{ ".id": string }>;

    if (existing.length > 0) {
      for (const rule of existing) {
        await conn.write("/ip/firewall/filter/remove", ["=.id=" + rule[".id"]]);
        await this.helper.delay(200);
        logs.push(`Removed Firewall Filter: ${comment} (ID: ${rule[".id"]})`);
      }
    }
  }
}
