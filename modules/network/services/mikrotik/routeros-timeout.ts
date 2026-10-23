/**
 * node-routeros-v2 reads its `timeout` option in seconds (it calls
 * `socket.setTimeout(timeout * 1000)`), while every caller here thinks in
 * milliseconds; passing 10000 straight through meant about 2.8 hours. 0 is
 * avoided because the library treats it as unset and falls back to 10 s.
 */
export function toRouterOsTimeoutSeconds(timeoutMs: number): number {
  return Math.max(1, Math.ceil(timeoutMs / 1000));
}
