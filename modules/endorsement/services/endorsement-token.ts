/**
 * Token short link untuk penanda tangan. Implementasinya dipakai bersama
 * dengan link belanja restock di `lib/security/link-token`.
 */
export {
  generateLinkToken as generateSignerToken,
  hashLinkToken as hashSignerToken,
  isValidLinkTokenFormat as isValidTokenFormat,
} from "@/lib/security/link-token";
