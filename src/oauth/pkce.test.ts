import { describe, expect, it } from "vitest";
import { WarmblyError } from "../core/errors";
import { createCodeChallenge, generateCodeVerifier, randomState } from "./pkce";

describe("generateCodeVerifier", () => {
  it("produces a base64url verifier of the requested length", () => {
    const verifier = generateCodeVerifier(64);
    expect(verifier).toHaveLength(64);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("produces distinct, high-entropy values", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toEqual(b);
  });

  it("rejects lengths outside the RFC 7636 range", () => {
    expect(() => generateCodeVerifier(42)).toThrow(WarmblyError);
    expect(() => generateCodeVerifier(129)).toThrow(WarmblyError);
  });
});

describe("createCodeChallenge", () => {
  it("derives a known S256 challenge for a known verifier (RFC 7636 appendix B)", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await createCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("returns an unpadded base64url string", async () => {
    const challenge = await createCodeChallenge(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toContain("=");
  });
});

describe("randomState", () => {
  it("produces distinct url-safe strings", () => {
    const a = randomState();
    const b = randomState();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});
