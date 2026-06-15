import { WarmblyError } from "../core/errors";

/** Resolves the Web Crypto object, present in Node 18+, Bun, Deno, browsers, and the edge. */
function getCrypto() {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new WarmblyError(
      "Web Crypto is unavailable. PKCE requires `globalThis.crypto` (Node 18+, Bun, Deno, browsers, or edge).",
    );
  }
  return c;
}

/** Encodes bytes as an unpadded base64url string, cross-runtime (no Buffer dependency). */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  let base64: string;
  if (typeof btoa === "function") {
    base64 = btoa(binary);
  } else {
    // Node fallback when `btoa` is not global; Buffer is present in Node only.
    const nodeBuffer = (
      globalThis as {
        Buffer?: { from(s: string, e: string): { toString(e: string): string } };
      }
    ).Buffer;
    if (!nodeBuffer) {
      throw new WarmblyError("No base64 encoder (btoa or Buffer) is available in this runtime.");
    }
    base64 = nodeBuffer.from(binary, "binary").toString("base64");
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generates a high-entropy PKCE code verifier: a 43 to 128 character base64url string.
 *
 * @example
 * const verifier = generateCodeVerifier();
 * const challenge = await createCodeChallenge(verifier);
 */
export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new WarmblyError("PKCE code verifier length must be between 43 and 128 characters.");
  }
  const crypto = getCrypto();
  // base64url over random bytes yields a uniform, unreserved-charset verifier with no modulo bias.
  const randomBytes = new Uint8Array(Math.ceil((length * 3) / 4));
  crypto.getRandomValues(randomBytes);
  return base64UrlEncode(randomBytes).slice(0, length);
}

/**
 * Derives the S256 code challenge for a verifier: `base64url(sha256(verifier))`.
 *
 * @example
 * const verifier = generateCodeVerifier();
 * const challenge = await createCodeChallenge(verifier);
 * // Send `challenge` as `code_challenge` with `code_challenge_method=S256`.
 */
export async function createCodeChallenge(verifier: string): Promise<string> {
  const crypto = getCrypto();
  if (!crypto.subtle || typeof crypto.subtle.digest !== "function") {
    throw new WarmblyError(
      "Web Crypto SubtleCrypto is unavailable; cannot derive an S256 challenge.",
    );
  }
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Generates a random, URL-safe CSRF `state` value.
 *
 * @example
 * const state = randomState();
 * // Persist `state`, then verify it on the OAuth callback.
 */
export function randomState(length = 32): string {
  const crypto = getCrypto();
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return base64UrlEncode(randomBytes);
}
