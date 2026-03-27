/**
 * IP address utility helpers
 */

/**
 * Convert IPv4 string to 32-bit integer
 */
export function ipToLong(ip: string): number {
  return ip.split('.').reduce((long, octet) => (long << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Convert 32-bit integer to IPv4 string
 */
export function longToIp(long: number): string {
  return [
    (long >>> 24) & 0xff,
    (long >>> 16) & 0xff,
    (long >>> 8) & 0xff,
    long & 0xff
  ].join('.');
}

/**
 * Parse IP range string (e.g., "192.168.1.1-192.168.1.10") into an array of IP strings
 */
export function parseIpRange(range: string): string[] {
  if (!range || !range.includes('-')) return [];

  const [startStr, endStr] = range.split('-').map(s => s.trim());
  if (!startStr || !endStr) return [];

  try {
    const start = ipToLong(startStr);
    const end = ipToLong(endStr);

    if (start > end) return [];

    const ips: string[] = [];
    // Limit to reasonable size to prevent memory issues (e.g., max 2048 IPs per pool)
    const count = Math.min(end - start + 1, 2048);
    
    for (let i = 0; i < count; i++) {
      ips.push(longToIp(start + i));
    }

    return ips;
  } catch (error) {
    console.error('Error parsing IP range:', error);
    return [];
  }
}
