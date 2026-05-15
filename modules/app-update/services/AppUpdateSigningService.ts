import { createSign, createVerify } from "crypto";

import { logger } from "@/lib/logger";

import { AppUpdateValidationError } from "../errors";

/**
 * Code signing untuk Expo Updates manifest.
 *
 * Setup ENV (server):
 *   APP_UPDATE_SIGNING_KEY_ID  - identifier keypair (mis. "v1")
 *   APP_UPDATE_SIGNING_PRIVATE_KEY  - RSA PEM private key (multi-line)
 *
 * Setup mobile (app.json):
 *   updates.codeSigningCertificate -> public key dari pasangan tsb
 *
 * Algoritma: RSA-SHA256, signature di-encode base64.
 */

const SIGNING_ALGORITHM = "RSA-SHA256";

interface SigningKeyConfig {
  keyId: string;
  privateKey: string;
}

let cachedConfig: SigningKeyConfig | null | undefined;

function getSigningConfig(): SigningKeyConfig | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }
  const keyId = process.env.APP_UPDATE_SIGNING_KEY_ID?.trim();
  const privateKey = process.env.APP_UPDATE_SIGNING_PRIVATE_KEY?.trim();
  if (!keyId || !privateKey) {
    cachedConfig = null;
    return null;
  }
  cachedConfig = { keyId, privateKey };
  return cachedConfig;
}

export function isSigningEnabled(): boolean {
  return getSigningConfig() !== null;
}

/** Sign manifest body string dan kembalikan base64 signature + key id. */
export function signManifestBody(body: string): {
  signature: string;
  keyId: string;
} | null {
  const config = getSigningConfig();
  if (!config) return null;

  try {
    const signer = createSign(SIGNING_ALGORITHM);
    signer.update(body);
    signer.end();
    const signature = signer.sign(config.privateKey).toString("base64");
    return { signature, keyId: config.keyId };
  } catch (error) {
    logger.error("[AppUpdateSigning] Failed to sign manifest body", error);
    throw new AppUpdateValidationError("Gagal menandatangani manifest update");
  }
}

/** Verify signature lokal (untuk testing). Mobile akan verify pakai public key bundled. */
export function verifySignature(
  body: string,
  signatureBase64: string,
  publicKey: string,
): boolean {
  const verifier = createVerify(SIGNING_ALGORITHM);
  verifier.update(body);
  verifier.end();
  return verifier.verify(publicKey, Buffer.from(signatureBase64, "base64"));
}
