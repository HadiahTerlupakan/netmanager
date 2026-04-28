import { logger } from "@/lib/logger";
import { RouterOSAPI } from "node-routeros-v2";
import { networkInterfaces } from "os";

// Cache IP publik selama 5 menit agar tidak terus-terusan request
let cachedPublicIp: string | null = null;
let cacheExpiry: number = 0;

export class MikroTikProvisioningService {
  /**
   * Helper to throttle commands to prevent CPU spikes on low-end routers
   */
  private async delay(ms: number = 200): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Deteksi IP publik server secara otomatis via layanan API publik.
   * Prioritas: env RADIUS_PUBLIC_IP > cache > API publik > IP lokal (fallback)
   */
  private async detectPublicIp(): Promise<string> {
    // 1. Prioritas utama: env var RADIUS_PUBLIC_IP
    if (process.env.RADIUS_PUBLIC_IP) {
      return process.env.RADIUS_PUBLIC_IP;
    }

    // 2. Cache masih valid
    if (cachedPublicIp && Date.now() < cacheExpiry) {
      return cachedPublicIp;
    }

    // 3. Auto-detect via API publik (coba beberapa service)
    const services = [
      "https://api.ipify.org",
      "https://ifconfig.me/ip",
      "https://icanhazip.com",
    ];

    for (const url of services) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const ip = (await res.text()).trim();
          // Validasi format IPv4
          if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
            cachedPublicIp = ip;
            cacheExpiry = Date.now() + 5 * 60 * 1000; // Cache 5 menit
            logger.info(
              `[Provisioning] Public IP detected: ${ip} (from ${url})`,
            );
            return ip;
          }
        }
      } catch {
        // Coba service berikutnya
        continue;
      }
    }

    // 4. Fallback: IP lokal (untuk development / jaringan lokal)
    logger.warn(
      "[Provisioning] Cannot detect public IP, falling back to local IP",
    );
    return this.detectLocalIp();
  }

  /**
   * Fallback: ambil IP lokal dari network interfaces
   */
  private detectLocalIp(): string {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]!) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
    return "127.0.0.1";
  }

  /**
   * Provisions the RADIUS configuration on a MikroTik router.
   *
   * @param routerDetails Connection details for the MikroTik router
   * @param radiusServerIp The IP address of the RADIUS server (public IP). If not provided, auto-detect.
   * @param radiusSecret The shared secret for RADIUS
   * @param isolirUrl Optional URL for isolation redirect
   * @param authPort RADIUS Authentication port (default: 1812)
   * @param accountingPort RADIUS Accounting port (default: 1813)
   */
  async provisionRadius(
    routerDetails: {
      ip: string;
      port: number;
      username: string;
      password: string;
    },
    radiusServerIp: string | null,
    radiusSecret: string,
    isolirUrl: string | null | undefined = null,
    authPort: number = 1812,
    accountingPort: number = 1813,
  ): Promise<{ success: boolean; logs: string[] }> {
    const logs: string[] = [];

    // Auto-detect public IP if not provided
    const finalServerIp = radiusServerIp || (await this.detectPublicIp());
    logs.push(`Using Server IP for RADIUS: ${finalServerIp}`);
    logs.push(`Auth Port: ${authPort}, Accounting Port: ${accountingPort}`);

    const conn = new RouterOSAPI({
      host: routerDetails.ip,
      port: routerDetails.port,
      user: routerDetails.username,
      password: routerDetails.password,
      timeout: 10000,
    });

    try {
      await conn.connect();
      logs.push(`Connected to MikroTik at ${routerDetails.ip}`);

      // --- 1. RADIUS Provisioning ---
      // Check if RADIUS entry for this server already exists
      const existingRadius = (await conn.write("/radius/print", [
        "?address=" + finalServerIp,
        "?comment=added by netmanager",
      ])) as Array<{ ".id": string }>;

      if (existingRadius && existingRadius.length > 0) {
        // Update existing
        for (const r of existingRadius) {
          await conn.write("/radius/set", [
            "=.id=" + r[".id"],
            "=secret=" + radiusSecret,
            "=service=ppp,login,hotspot",
            "=authentication-port=" + authPort,
            "=accounting-port=" + accountingPort,
            "=timeout=3000ms",
          ]);
          await this.delay(300);
          logs.push(
            `Updated existing RADIUS config for ${finalServerIp} (auth:${authPort}, acct:${accountingPort})`,
          );
        }
      } else {
        // Add new
        await conn.write("/radius/add", [
          "=address=" + finalServerIp,
          "=secret=" + radiusSecret,
          "=service=ppp,login,hotspot",
          "=authentication-port=" + authPort,
          "=accounting-port=" + accountingPort,
          "=timeout=3000ms",
          "=comment=added by netmanager",
        ]);
        await this.delay(300);
        logs.push(
          `Added new RADIUS config for ${finalServerIp} (auth:${authPort}, acct:${accountingPort})`,
        );
      }

      // Configure Incoming (CoA)
      await conn.write("/radius/incoming/set", ["=accept=yes", "=port=3799"]);
      await this.delay(200);
      logs.push(`Configured RADIUS Incoming (CoA) on port 3799`);

      // --- 2. Firewall Provisioning (Address Lists) ---
      const addressListItems = [
        { address: finalServerIp, comment: `accept.${finalServerIp}` },
      ];
      if (isolirUrl) {
        try {
          // Extract hostname
          const domain = isolirUrl.replace(/^https?:\/\//, "").split("/")[0];
          if (domain)
            addressListItems.push({
              address: domain,
              comment: `accept.${domain}`,
            });
        } catch (_e) {
          logger.warn("Invalid Isolir URL format");
        }
      }

      for (const item of addressListItems) {
        const existingList = (await conn.write(
          "/ip/firewall/address-list/print",
          ["?list=netmanager_allow", "?address=" + item.address],
        )) as Array<{ ".id": string }>;

        if (existingList.length === 0) {
          await conn.write("/ip/firewall/address-list/add", [
            "=list=netmanager_allow",
            "=address=" + item.address,
            "=comment=" + item.comment,
          ]);
          await this.delay(200);
          logs.push(`Added Firewall Address List: ${item.address}`);
        }
      }

      // --- 3. Firewall Filter Rules (WhiteList) ---
      // Determine "Top" position (before the first rule if any)
      let placeBeforeArgs: string[] = [];
      try {
        // Get the ID of the first rule to place explicitly before it
        const firstRule = (await conn.write("/ip/firewall/filter/print", [
          "=.proplist=.id",
          "=.limit=1",
        ])) as Array<{ ".id": string }>;
        if (firstRule && firstRule.length > 0) {
          placeBeforeArgs = ["=place-before=" + firstRule[0][".id"]];
        }
      } catch (_e) {
        /* ignore */
      }

      // Rule 1: Input (Router Access from Server)
      const inputRule = (await conn.write("/ip/firewall/filter/print", [
        "?comment=netmanager-input-bypass",
      ])) as Array<{ ".id": string }>;
      if (inputRule.length === 0) {
        await conn.write("/ip/firewall/filter/add", [
          "=chain=input",
          "=action=accept",
          "=src-address-list=netmanager_allow",
          ...placeBeforeArgs,
          "=comment=netmanager-input-bypass",
        ]);
        await this.delay(200);
        logs.push("Added Firewall Filter: Input Bypass (Top Priority)");
      }

      // Rule 2: Forward (User Access to Server/Isolir)
      const forwardRule = (await conn.write("/ip/firewall/filter/print", [
        "?comment=netmanager-forward-bypass",
      ])) as Array<{ ".id": string }>;
      if (forwardRule.length === 0) {
        await conn.write("/ip/firewall/filter/add", [
          "=chain=forward",
          "=action=accept",
          "=dst-address-list=netmanager_allow",
          ...placeBeforeArgs,
          "=comment=netmanager-forward-bypass",
        ]);
        await this.delay(200);
        logs.push("Added Firewall Filter: Forward Bypass (Top Priority)");
      }

      // Rule 3: Drop Expired TCP
      const dropTcpRule = (await conn.write("/ip/firewall/filter/print", [
        "?comment=netmanager-drop-expired-tcp",
      ])) as Array<{ ".id": string }>;
      if (dropTcpRule.length === 0) {
        await conn.write("/ip/firewall/filter/add", [
          "=chain=forward",
          "=action=reject",
          "=protocol=tcp",
          "=src-address=10.127.0.0/18",
          ...placeBeforeArgs,
          "=comment=netmanager-drop-expired-tcp",
        ]);
        await this.delay(200);
        logs.push("Added Firewall Filter: Drop Expired TCP");
      }

      // Rule 4: Drop Expired UDP (Except DNS)
      const dropUdpRule = (await conn.write("/ip/firewall/filter/print", [
        "?comment=netmanager-drop-expired-udp",
      ])) as Array<{ ".id": string }>;
      if (dropUdpRule.length === 0) {
        await conn.write("/ip/firewall/filter/add", [
          "=chain=forward",
          "=action=reject",
          "=protocol=udp",
          "=src-address=10.127.0.0/18",
          "=dst-port=!53,5353",
          ...placeBeforeArgs,
          "=comment=netmanager-drop-expired-udp",
        ]);
        await this.delay(200);
        logs.push("Added Firewall Filter: Drop Expired UDP");
      }

      // --- 4. IP Pool (Expired Users) ---
      const expiredPool = (await conn.write("/ip/pool/print", [
        "?name=expired-pool",
      ])) as Array<{ ".id": string }>;
      if (expiredPool.length === 0) {
        await conn.write("/ip/pool/add", [
          "=name=expired-pool",
          "=ranges=10.127.0.2-10.127.63.254",
          "=comment=added by netmanager - expired users",
        ]);
        await this.delay(200);
        logs.push("Added IP Pool: expired-pool (10.127.0.2-10.127.63.254)");
      }

      // --- 5. PPP Profile (Expired Users) ---
      const expiredProfile = (await conn.write("/ppp/profile/print", [
        "?name=expired users",
      ])) as Array<{ ".id": string }>;
      if (expiredProfile.length === 0) {
        await conn.write("/ppp/profile/add", [
          "=name=expired users",
          "=local-address=10.127.0.1",
          "=remote-address=expired-pool", // Assign remote address from pool
          "=dns-server=8.8.8.8,1.1.1.1",
          "=comment=added by netmanager",
        ]);
        await this.delay(200);
        logs.push("Added PPP Profile: expired users");
      } else {
        // Update existing profile to ensure remote-address is set
        await conn.write("/ppp/profile/set", [
          "=.id=" + expiredProfile[0][".id"],
          "=local-address=10.127.0.1",
          "=remote-address=expired-pool",
          "=dns-server=8.8.8.8,1.1.1.1",
        ]);
        await this.delay(200);
        logs.push("Updated PPP Profile: expired users");
      }

      // --- 5. Web Proxy (Isolir Redirection) ---
      // logger.info(`[Provisioning] Isolir URL provided: "${isolirUrl}"`);

      if (isolirUrl) {
        // logger.info('[Provisioning] Configuring Web Proxy...');
        try {
          const domain = isolirUrl.replace(/^https?:\/\//, "").split("/")[0];
          if (domain) {
            // 1. Enable Proxy on Port 8181
            await conn.write("/ip/proxy/set", ["=enabled=yes", "=port=8181"]);
            await this.delay(200);
            logs.push("Configured Web Proxy: Enabled on port 8181");

            // 2. Add Access Rule for Expired Users
            const proxyRule = (await conn.write("/ip/proxy/access/print", [
              "?comment=added by netmanager - 10.127.0.0/18",
            ])) as Array<{ ".id": string }>;

            if (proxyRule.length === 0) {
              await conn.write("/ip/proxy/access/add", [
                "=src-address=10.127.0.0/18",
                "=action=redirect",
                "=action-data=" + domain,
                "=comment=added by netmanager - 10.127.0.0/18",
              ]);
              await this.delay(200);
              logs.push(
                `Added Web Proxy Access Rule: Redirect 10.127.0.0/18 to ${domain}`,
              );
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          logger.error(`[Provisioning] Web Proxy Error: ${msg}`);
          logs.push(`Failed to configure Web Proxy: ${msg}`);
        }
      } else {
        // logger.info('[Provisioning] No Isolir URL provided, skipping Web Proxy.');
      }

      conn.close();
      return { success: true, logs };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logs.push(`Error: ${msg}`);
      // Ensure connection is closed
      try {
        conn.close();
      } catch (_e) {}
      return { success: false, logs };
    }
  }
  async deprovisionRadius(
    routerDetails: {
      ip: string;
      port: number;
      username: string;
      password: string;
    },
    radiusServerIp: string | null,
    isolirUrl: string | null | undefined = null,
  ): Promise<{ success: boolean; logs: string[] }> {
    const logs: string[] = [];
    const finalServerIp = radiusServerIp || (await this.detectPublicIp());

    // logger.info(`[Deprovisioning] Starting removal for Router: ${routerDetails.ip}`);

    const conn = new RouterOSAPI({
      host: routerDetails.ip,
      port: routerDetails.port,
      user: routerDetails.username,
      password: routerDetails.password,
      timeout: 10000,
    });

    try {
      await conn.connect();
      logs.push(`Connected to MikroTik at ${routerDetails.ip}`);

      // 1. Remove RADIUS Config
      const existingRadius = (await conn.write("/radius/print", [
        "?address=" + finalServerIp,
        "?comment=added by netmanager",
      ])) as Array<{ ".id": string }>;

      if (existingRadius && existingRadius.length > 0) {
        for (const r of existingRadius) {
          await conn.write("/radius/remove", ["=.id=" + r[".id"]]);
          await this.delay(200);
          logs.push(
            `Removed RADIUS config for ${finalServerIp} (ID: ${r[".id"]})`,
          );
        }
      }

      // 2. Remove Firewall Address Lists
      const ipsToRemove = [finalServerIp];
      if (isolirUrl) {
        try {
          const domain = isolirUrl.replace(/^https?:\/\//, "").split("/")[0];
          if (domain) ipsToRemove.push(domain);
        } catch (_e) {}
      }

      for (const addr of ipsToRemove) {
        const items = (await conn.write("/ip/firewall/address-list/print", [
          "?list=netmanager_allow",
          "?address=" + addr,
        ])) as Array<{ ".id": string }>;
        for (const item of items) {
          await conn.write("/ip/firewall/address-list/remove", [
            "=.id=" + item[".id"],
          ]);
          await this.delay(100);
          logs.push(`Removed Firewall Address List: ${addr}`);
        }
      }

      // 3. Remove Firewall Filter Rules
      const filterComments = [
        "netmanager-input-bypass",
        "netmanager-forward-bypass",
        "netmanager-drop-expired-tcp",
        "netmanager-drop-expired-udp",
      ];
      for (const comment of filterComments) {
        const rules = (await conn.write("/ip/firewall/filter/print", [
          "?comment=" + comment,
        ])) as Array<{ ".id": string }>;
        for (const rule of rules) {
          await conn.write("/ip/firewall/filter/remove", [
            "=.id=" + rule[".id"],
          ]);
          await this.delay(100);
          logs.push(`Removed Firewall Filter: ${comment}`);
        }
      }

      // 4. Remove PPP Profile
      const pppProfiles = (await conn.write("/ppp/profile/print", [
        "?name=expired users",
      ])) as Array<{ ".id": string }>;
      for (const p of pppProfiles) {
        await conn.write("/ppp/profile/remove", ["=.id=" + p[".id"]]);
        await this.delay(200);
        logs.push("Removed PPP Profile: expired users");
      }

      // 5. Remove Web Proxy Access Rule
      const proxyRules = (await conn.write("/ip/proxy/access/print", [
        "?comment=added by netmanager - 10.127.0.0/18",
      ])) as Array<{ ".id": string }>;
      for (const r of proxyRules) {
        await conn.write("/ip/proxy/access/remove", ["=.id=" + r[".id"]]);
        await this.delay(100);
        logs.push("Removed Web Proxy Access Rule");
      }

      // 6. Reset Global Settings (Revert Enablement)
      try {
        // Disable RADIUS Incoming
        await conn.write("/radius/incoming/set", ["=accept=no"]);
        logs.push("Disabled RADIUS Incoming (CoA)");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logs.push(`Failed to disable Radius Incoming: ${msg}`);
      }

      if (isolirUrl) {
        try {
          // Disable Web Proxy (only if we likely enabled it via Isolir)
          await conn.write("/ip/proxy/set", ["=enabled=no"]);
          logs.push("Disabled Web Proxy");
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          logs.push(`Failed to disable Web Proxy: ${msg}`);
        }
      }

      conn.close();
      return { success: true, logs };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logs.push(`Error: ${msg}`);
      try {
        conn.close();
      } catch (_e) {}
      return { success: false, logs };
    }
  }

  /**
   * Creates a limited API user for routine connections.
   * The master user credentials are preserved for provisioning/deletion.
   *
   * @param routerDetails Connection details (using master credentials)
   * @returns Generated username and password for the API user
   */
  async createApiUser(routerDetails: {
    ip: string;
    port: number;
    username: string;
    password: string;
  }): Promise<{
    success: boolean;
    logs: string[];
    username?: string;
    password?: string;
  }> {
    const logs: string[] = [];
    const GROUP_NAME = "netmanager.api";
    const GROUP_POLICY =
      "read,write,policy,test,sensitive,api,!local,!telnet,!ssh,!ftp,!reboot,!winbox,!password,!web,!sniff,!romon,!rest-api";

    // Generate random username and password
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const generatedUsername = `netmanager_${randomSuffix}`;
    const generatedPassword = this.generateSecurePassword(16);

    const conn = new RouterOSAPI({
      host: routerDetails.ip,
      port: routerDetails.port,
      user: routerDetails.username,
      password: routerDetails.password,
      timeout: 10000,
    });

    try {
      // logger.info(`[API User] Connecting to ${routerDetails.ip}...`);
      await conn.connect();
      logs.push(`Connected to MikroTik at ${routerDetails.ip}`);

      // --- 1. Check/Create Group ---
      const existingGroups = (await conn.write("/user/group/print", [
        "?name=" + GROUP_NAME,
      ])) as Array<{ ".id": string }>;

      if (existingGroups && existingGroups.length > 0) {
        // Update existing group policy
        await conn.write("/user/group/set", [
          "=.id=" + existingGroups[0][".id"],
          "=policy=" + GROUP_POLICY,
          "=comment=NetManager API Group - DO NOT DELETE",
        ]);
        logs.push(`Updated existing group: ${GROUP_NAME}`);
      } else {
        // Create new group
        await conn.write("/user/group/add", [
          "=name=" + GROUP_NAME,
          "=policy=" + GROUP_POLICY,
          "=comment=NetManager API Group - DO NOT DELETE",
        ]);
        logs.push(`Created group: ${GROUP_NAME}`);
      }

      // --- 2. Remove old NetManager users (cleanup) ---
      const oldUsers = (await conn.write("/user/print", [
        "?comment=NetManager API User - DO NOT DELETE",
      ])) as Array<{ ".id": string; name: string }>;

      for (const user of oldUsers) {
        try {
          await conn.write("/user/remove", ["=.id=" + user[".id"]]);
          logs.push(`Removed old API user: ${user.name}`);
        } catch (_e) {
          // Ignore errors when removing
        }
      }

      // --- 3. Create new API user ---
      await conn.write("/user/add", [
        "=name=" + generatedUsername,
        "=password=" + generatedPassword,
        "=group=" + GROUP_NAME,
        "=comment=NetManager API User - DO NOT DELETE",
      ]);
      logs.push(`Created API user: ${generatedUsername}`);

      conn.close();
      // logger.info(`[API User] Successfully created API user: ${generatedUsername}`);

      return {
        success: true,
        logs,
        username: generatedUsername,
        password: generatedPassword,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logs.push(`Error: ${msg}`);
      logger.error(`[API User] Error creating API user:`, msg);
      try {
        conn.close();
      } catch (_e) {}
      return { success: false, logs };
    }
  }

  /**
   * Generates a secure random password
   */
  private generateSecurePassword(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
