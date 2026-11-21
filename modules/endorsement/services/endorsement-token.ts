/**
 * Token short link untuk penanda tangan; implementasi di
 * `lib/security/link-token`.
 */
export {
  generateLinkToken as generateSignerToken,
  hashLinkToken as hashSignerToken,
  isValidLinkTokenFormat as isValidTokenFormat,
} from "@/lib/security/link-token";
