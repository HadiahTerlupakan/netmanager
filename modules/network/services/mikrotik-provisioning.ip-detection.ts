import { logger } from "@/lib/logger";
import { networkInterfaces } from "os";

let cachedPublicIp: string | null = null;
let cacheExpiry = 0;

const PUBLIC_IP_CACHE_TTL_MS = 5 * 60 * 1000;
const PUBLIC_IP_TIMEOUT_MS = 5000;
const PUBLIC_IP_SERVICES = [
  "https://api.ipify.org",
  "https://ifconfig.me/ip",
  "https://icanhazip.com",
];
const LOOPBACK_IP = "127.0.0.1";
const IPV4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function getCachedPublicIp() {
  if (cachedPublicIp && Date.now() < cacheExpiry) {
    return cachedPublicIp;
  }

  return null;
}

function cacheDetectedPublicIp(detectedIp: string, url: string) {
  cachedPublicIp = detectedIp;
  cacheExpiry = Date.now() + PUBLIC_IP_CACHE_TTL_MS;
  logger.info(`[Provisioning] Public IP detected: ${detectedIp} (from ${url})`);
  return detectedIp;
}

/** Asal alamat dari `detectPublicIpWithSource`; `local` berarti tebakan dari interface server. */
export type PublicIpSource = "env" | "cache" | "external" | "local";

/** Alamat publik server beserta asalnya, agar pemanggil bisa menolak tebakan lokal. */
export async function detectPublicIpWithSource(): Promise<{
  ip: string;
  source: PublicIpSource;
}> {
  if (process.env.RADIUS_PUBLIC_IP) {
    return { ip: process.env.RADIUS_PUBLIC_IP, source: "env" };
  }

  const cachedIp = getCachedPublicIp();
  if (cachedIp) {
    return { ip: cachedIp, source: "cache" };
  }

  for (const url of PUBLIC_IP_SERVICES) {
    const detectedIp = await fetchPublicIp(url);
    if (detectedIp) {
      return { ip: cacheDetectedPublicIp(detectedIp, url), source: "external" };
    }
  }

  logger.warn(
    "[Provisioning] Cannot detect public IP, falling back to local IP",
  );
  return { ip: detectLocalIp(), source: "local" };
}

export async function detectPublicIp(): Promise<string> {
  return (await detectPublicIpWithSource()).ip;
}

async function fetchPublicIp(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PUBLIC_IP_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const ip = (await response.text()).trim();
    return IPV4_PATTERN.test(ip) ? ip : null;
  } catch {
    return null;
  }
}

function detectLocalIp(): string {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }

  return LOOPBACK_IP;
}
