import { afterEach, describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  verifyWebhookSignature,
} from "./verify";

// Recomputes the documented signature so the test stays independent of the implementation.
async function sign(secret: string, timestamp: number, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SECRET = "whsec_test_secret_value";

describe("verifyWebhookSignature", () => {
  it("accepts a valid, fresh signature", async () => {
    const body = '{"event_type":"campaign.reply_received"}';
    const t = Math.floor(Date.now() / 1000);
    const v1 = await sign(SECRET, t, body);
    const ok = await verifyWebhookSignature({
      payload: body,
      header: `t=${t},v1=${v1}`,
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it("accepts a Uint8Array payload identical to the string form", async () => {
    const body = "raw-bytes-payload";
    const t = Math.floor(Date.now() / 1000);
    const v1 = await sign(SECRET, t, body);
    const ok = await verifyWebhookSignature({
      payload: new TextEncoder().encode(body),
      header: `t=${t},v1=${v1}`,
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const t = Math.floor(Date.now() / 1000);
    const v1 = await sign(SECRET, t, "original");
    const ok = await verifyWebhookSignature({
      payload: "tampered",
      header: `t=${t},v1=${v1}`,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejects the wrong secret", async () => {
    const body = "payload";
    const t = Math.floor(Date.now() / 1000);
    const v1 = await sign(SECRET, t, body);
    const ok = await verifyWebhookSignature({
      payload: body,
      header: `t=${t},v1=${v1}`,
      secret: "whsec_other",
    });
    expect(ok).toBe(false);
  });

  it("rejects a timestamp outside the tolerance window", async () => {
    const body = "payload";
    const t = Math.floor(Date.now() / 1000) - (DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 60);
    const v1 = await sign(SECRET, t, body);
    const ok = await verifyWebhookSignature({
      payload: body,
      header: `t=${t},v1=${v1}`,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("honors a custom tolerance", async () => {
    const body = "payload";
    const t = Math.floor(Date.now() / 1000) - 120;
    const v1 = await sign(SECRET, t, body);
    expect(
      await verifyWebhookSignature({
        payload: body,
        header: `t=${t},v1=${v1}`,
        secret: SECRET,
        toleranceSeconds: 60,
      }),
    ).toBe(false);
    expect(
      await verifyWebhookSignature({
        payload: body,
        header: `t=${t},v1=${v1}`,
        secret: SECRET,
        toleranceSeconds: 300,
      }),
    ).toBe(true);
  });

  it("ignores unknown schemes and requires v1", async () => {
    const body = "payload";
    const t = Math.floor(Date.now() / 1000);
    const ok = await verifyWebhookSignature({
      payload: body,
      header: `t=${t},v2=deadbeef`,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("returns false on a malformed or empty header", async () => {
    expect(await verifyWebhookSignature({ payload: "x", header: "garbage", secret: SECRET })).toBe(
      false,
    );
    expect(await verifyWebhookSignature({ payload: "x", header: "", secret: SECRET })).toBe(false);
  });

  it("returns false when the secret is missing", async () => {
    const body = "payload";
    const t = Math.floor(Date.now() / 1000);
    const v1 = await sign(SECRET, t, body);
    expect(
      await verifyWebhookSignature({ payload: body, header: `t=${t},v1=${v1}`, secret: "" }),
    ).toBe(false);
  });

  it("rejects a future-dated timestamp beyond tolerance", async () => {
    const body = "payload";
    const t = Math.floor(Date.now() / 1000) + (DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 60);
    const v1 = await sign(SECRET, t, body);
    const ok = await verifyWebhookSignature({
      payload: body,
      header: `t=${t},v1=${v1}`,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejects a non-integer timestamp so no t value is parsed", async () => {
    const body = "payload";
    const ok = await verifyWebhookSignature({
      payload: body,
      header: "t=not-a-number,v1=deadbeef",
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejects a fractional timestamp", async () => {
    const body = "payload";
    const ok = await verifyWebhookSignature({
      payload: body,
      header: "t=1700000000.5,v1=deadbeef",
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("skips header parts that have no equals sign", async () => {
    const body = "payload";
    const t = Math.floor(Date.now() / 1000);
    const v1 = await sign(SECRET, t, body);
    const ok = await verifyWebhookSignature({
      payload: body,
      header: `junk,t=${t},v1=${v1}`,
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it("honors v1 even when an unknown scheme is also present", async () => {
    const body = '{"event_type":"campaign.email_sent","contact":"lead@warmbly.com"}';
    const t = Math.floor(Date.now() / 1000);
    const v1 = await sign(SECRET, t, body);
    const ok = await verifyWebhookSignature({
      payload: body,
      header: `t=${t},v2=ignored,v1=${v1}`,
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it("returns false when only a timestamp is present without v1", async () => {
    const t = Math.floor(Date.now() / 1000);
    const ok = await verifyWebhookSignature({
      payload: "x",
      header: `t=${t}`,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("parses extra whitespace in the header", async () => {
    const body = "payload";
    const t = Math.floor(Date.now() / 1000);
    const v1 = await sign(SECRET, t, body);
    const ok = await verifyWebhookSignature({
      payload: body,
      header: ` t=${t} , v1=${v1} `,
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });
});

describe("constantTimeEqual", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different content of equal length", () => {
    expect(constantTimeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("detects a single trailing character mismatch", () => {
    expect(constantTimeEqual("deadbeef", "deadbeeg")).toBe(false);
  });
});

describe("getSubtle (missing Web Crypto)", () => {
  const original = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: original,
    });
  });

  it("throws a clear error when globalThis.crypto.subtle is unavailable", async () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: { subtle: undefined },
    });
    const t = Math.floor(Date.now() / 1000);
    await expect(
      verifyWebhookSignature({
        payload: "payload",
        header: `t=${t},v1=deadbeef`,
        secret: SECRET,
      }),
    ).rejects.toThrow(/Web Crypto/);
  });

  it("throws when globalThis.crypto itself is absent", async () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const t = Math.floor(Date.now() / 1000);
    await expect(
      verifyWebhookSignature({
        payload: "payload",
        header: `t=${t},v1=deadbeef`,
        secret: SECRET,
      }),
    ).rejects.toThrow(/Web Crypto/);
  });
});
