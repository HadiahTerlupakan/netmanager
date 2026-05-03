import { logger } from "@/lib/logger";
import { networkInterfaces } from "os";

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const PUBLIC_IP_SERVICES = [
  "https://api.ipify.org",
  "https://ifconfig.me/ip",
  "https://icanhazip.com",
];
const IP_DETECTION_TIMEOUT_MS = 5000;

/** Service untuk deteksi IP publik dan lokal dengan caching. */
export class IpDetectionService {
  private cachedPublicIp: string | null = null;
  private cacheExpiry: number = 0;

  /** Deteksi IP publik server dengan prioritas: env > cache > API > local. */
  async detectPublicIp(): Promise<string> {
    if (process.env.RADIUS_PUBLIC_IP) {
      return process.env.RADIUS_PUBLIC_IP;
    }

    if (this.isCacheValid()) {
      return this.cachedPublicIp!;
    }

    const detectedIp = await this.fetchPublicIpFromServices();
    if (detectedIp) {
      return detectedIp;
    }

    logger.warn(
      "[IpDetection] Cannot detect public IP, falling back to local IP",
    );
    return this.detectLocalIp();
  }

  /** Deteksi IP lokal dari network interfaces. */
  detectLocalIp(): string {
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

  private isCacheValid(): boolean {
    return this.cachedPublicIp !== null && Date.now() < this.cacheExpiry;
  }

  private async fetchPublicIpFromServices(): Promise<string | null> {
    for (const url of PUBLIC_IP_SERVICES) {
      const ip = await this.tryFetchFromService(url);
      if (ip) {
        this.updateCache(ip, url);
        return ip;
      }
    }
    return null;
  }

  private async tryFetchFromService(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        IP_DETECTION_TIMEOUT_MS,
      );
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const ip = (await res.text()).trim();
        if (this.isValidIpv4(ip)) {
          return ip;
        }
      }
    } catch {
      // Try next service
    }
    return null;
  }

  private isValidIpv4(ip: string): boolean {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
  }

  private updateCache(ip: string, source: string): void {
    this.cachedPublicIp = ip;
    this.cacheExpiry = Date.now() + CACHE_DURATION_MS;
    logger.info(`[IpDetection] Public IP detected: ${ip} (from ${source})`);
  }
}
