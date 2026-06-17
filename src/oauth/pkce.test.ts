import { afterEach, describe, expect, it, vi } from "vitest";
import { WarmblyError } from "../core/errors";
import { createCodeChallenge, generateCodeVerifier, randomState } from "./pkce";

const realCrypto = globalThis.crypto;
const realBtoa = (globalThis as { btoa?: unknown }).btoa;

afterEach(() => {
  vi.restoreAllMocks();
  // Restore any globals we replaced so tests stay isolated.
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    writable: true,
    value: realCrypto,
  });
  (globalThis as { btoa?: unknown }).btoa = realBtoa;
});

describe("generateCodeVerifier", () => {
  it("produces a base64url verifier of the requested length", () => {
    const verifier = generateCodeVerifier(64);
    expect(verifier).toHaveLength(64);
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("uses a default length of 64 when no argument is passed", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(64);
  });

  it("accepts the minimum length boundary of 43", () => {
    const verifier = generateCodeVerifier(43);
    expect(verifier).toHaveLength(43);
  });

  it("accepts the maximum length boundary of 128", () => {
    const verifier = generateCodeVerifier(128);
    expect(verifier).toHaveLength(128);
  });

  it("produces distinct, high-entropy values", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toEqual(b);
  });

  it("rejects a length below the RFC 7636 range", () => {
    expect(() => generateCodeVerifier(42)).toThrow(WarmblyError);
    expect(() => generateCodeVerifier(42)).toThrow(/between 43 and 128/);
  });

  it("rejects a length above the RFC 7636 range", () => {
    expect(() => generateCodeVerifier(129)).toThrow(WarmblyError);
    expect(() => generateCodeVerifier(129)).toThrow(/between 43 and 128/);
  });

  it("throws when Web Crypto is unavailable", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(() => generateCodeVerifier()).toThrow(WarmblyError);
    expect(() => generateCodeVerifier()).toThrow(/Web Crypto is unavailable/);
  });

  it("throws when getRandomValues is not a function", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: { getRandomValues: 42 },
    });
    expect(() => generateCodeVerifier()).toThrow(/Web Crypto is unavailable/);
  });
});

describe("createCodeChallenge", () => {
  it("derives a known S256 challenge for a known verifier (RFC 7636 appendix B)", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await createCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("is deterministic for the same input", async () => {
    const verifier = "user-at-warmbly.com-fixed-verifier-value-abcdef0123456789";
    const first = await createCodeChallenge(verifier);
    const second = await createCodeChallenge(verifier);
    expect(first).toBe(second);
  });

  it("returns an unpadded base64url string", async () => {
    const challenge = await createCodeChallenge(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toContain("=");
  });

  it("throws when Web Crypto is unavailable", async () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    await expect(createCodeChallenge("anything")).rejects.toThrow(/Web Crypto is unavailable/);
  });

  it("throws when SubtleCrypto is missing", async () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: { getRandomValues: () => undefined },
    });
    await expect(createCodeChallenge("anything")).rejects.toThrow(WarmblyError);
    await expect(createCodeChallenge("anything")).rejects.toThrow(/SubtleCrypto is unavailable/);
  });

  it("throws when subtle.digest is not a function", async () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: { getRandomValues: () => undefined, subtle: { digest: 7 } },
    });
    await expect(createCodeChallenge("anything")).rejects.toThrow(/SubtleCrypto is unavailable/);
  });
});

describe("randomState", () => {
  it("produces distinct url-safe strings", () => {
    const a = randomState();
    const b = randomState();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("honors a custom byte length", () => {
    // 8 random bytes base64url-encode to roughly ceil(8/3*4) = 11 chars, unpadded.
    const state = randomState(8);
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(state.length).toBeGreaterThan(0);
    expect(state.length).toBeLessThanOrEqual(11);
  });

  it("throws when Web Crypto is unavailable", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(() => randomState()).toThrow(/Web Crypto is unavailable/);
  });
});

describe("base64UrlEncode runtime fallbacks", () => {
  it("uses the Node Buffer fallback when btoa is not a function", () => {
    // Force the non-btoa branch; Buffer is present under Node and should be used.
    (globalThis as { btoa?: unknown }).btoa = undefined;
    const verifier = generateCodeVerifier(43);
    expect(verifier).toHaveLength(43);
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("produces the same encoding via Buffer as the reference S256 vector", async () => {
    (globalThis as { btoa?: unknown }).btoa = undefined;
    const challenge = await createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("throws when neither btoa nor Buffer is available", () => {
    (globalThis as { btoa?: unknown }).btoa = undefined;
    const savedBuffer = (globalThis as { Buffer?: unknown }).Buffer;
    try {
      Object.defineProperty(globalThis, "Buffer", {
        configurable: true,
        writable: true,
        value: undefined,
      });
      expect(() => generateCodeVerifier(43)).toThrow(/No base64 encoder/);
    } finally {
      Object.defineProperty(globalThis, "Buffer", {
        configurable: true,
        writable: true,
        value: savedBuffer,
      });
    }
  });
});
