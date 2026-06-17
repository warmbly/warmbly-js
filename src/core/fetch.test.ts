import { afterEach, describe, expect, it, vi } from "vitest";
import { WarmblyError } from "./errors";
import {
  buildQuery,
  encodeForm,
  fullJitterBackoff,
  generateIdempotencyKey,
  getRuntimeLabel,
  joinUrl,
  resolveFetch,
  sleep,
} from "./fetch";
import type { FetchLike } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("resolveFetch", () => {
  it("returns the injected fetch implementation as-is", () => {
    const injected = (async () => new Response("")) as unknown as FetchLike;
    expect(resolveFetch(injected)).toBe(injected);
  });

  it("falls back to globalThis.fetch when none is injected", () => {
    const globalFetch = vi.fn(async () => new Response(""));
    vi.stubGlobal("fetch", globalFetch);
    const resolved = resolveFetch();
    // Bound version is not the same reference, but calls through to the global.
    expect(typeof resolved).toBe("function");
    void resolved("https://api.warmbly.com/ping");
    expect(globalFetch).toHaveBeenCalledTimes(1);
  });

  it("throws a WarmblyError when no fetch is available", () => {
    const original = globalThis.fetch;
    // @ts-expect-error temporarily remove the global to exercise the error branch
    delete globalThis.fetch;
    try {
      expect(() => resolveFetch()).toThrow(WarmblyError);
      expect(() => resolveFetch()).toThrow(/No global `fetch` was found/);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("joinUrl", () => {
  it("trims trailing slashes on the base and leading slashes on the path", () => {
    expect(joinUrl("https://api.warmbly.com///", "///contacts")).toBe(
      "https://api.warmbly.com/contacts",
    );
  });

  it("joins a clean base and path with a single slash", () => {
    expect(joinUrl("https://api.warmbly.com", "contacts")).toBe("https://api.warmbly.com/contacts");
  });

  it("passes through an absolute http URL unchanged", () => {
    expect(joinUrl("https://api.warmbly.com", "http://other.warmbly.com/x")).toBe(
      "http://other.warmbly.com/x",
    );
  });

  it("passes through an absolute https URL unchanged regardless of case", () => {
    expect(joinUrl("https://api.warmbly.com", "HTTPS://Other.Warmbly.Com/y")).toBe(
      "HTTPS://Other.Warmbly.Com/y",
    );
  });

  it("handles an empty path", () => {
    expect(joinUrl("https://api.warmbly.com/", "")).toBe("https://api.warmbly.com/");
  });
});

describe("buildQuery", () => {
  it("returns an empty string when query is undefined", () => {
    expect(buildQuery()).toBe("");
  });

  it("returns an empty string when all values are nullish", () => {
    expect(buildQuery({ a: undefined, b: null })).toBe("");
  });

  it("skips nullish scalar values but keeps present ones", () => {
    expect(buildQuery({ a: 1, b: undefined, c: null, d: "x" })).toBe("?a=1&d=x");
  });

  it("repeats array values with the same key and skips nullish items", () => {
    expect(buildQuery({ tag: ["one", null, "two", undefined] })).toBe("?tag=one&tag=two");
  });

  it("encodes both keys and values", () => {
    expect(buildQuery({ "a b": "c d", email: "ada@warmbly.com" })).toBe(
      "?a%20b=c%20d&email=ada%40warmbly.com",
    );
  });

  it("returns an empty string when an array of only nullish items yields no parts", () => {
    expect(buildQuery({ tag: [null, undefined] })).toBe("");
  });
});

describe("encodeForm", () => {
  it("skips nullish values and encodes the rest", () => {
    expect(encodeForm({ a: "1", b: undefined, c: null, email: "ada@warmbly.com" })).toBe(
      "a=1&email=ada%40warmbly.com",
    );
  });

  it("returns an empty string when every value is nullish", () => {
    expect(encodeForm({ a: undefined, b: null })).toBe("");
  });

  it("coerces non-string values to strings", () => {
    expect(encodeForm({ count: 42, flag: true })).toBe("count=42&flag=true");
  });
});

describe("sleep", () => {
  it("resolves after the timer elapses with fake timers", async () => {
    vi.useFakeTimers();
    let done = false;
    const promise = sleep(1000).then(() => {
      done = true;
    });
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    expect(done).toBe(true);
  });

  it("resolves with real timers for a zero delay", async () => {
    await expect(sleep(0)).resolves.toBeUndefined();
  });
});

describe("fullJitterBackoff", () => {
  it("returns a value within [0, ceiling) for a small attempt", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    // attempt 0 -> ceiling = min(8000, 500) = 500
    expect(fullJitterBackoff(0)).toBe(250);
  });

  it("caps the ceiling at capMs for large attempts", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    // attempt 10 -> base * 2^10 = 512000, capped at 8000
    const value = fullJitterBackoff(10);
    expect(value).toBeLessThan(8000);
    expect(value).toBeGreaterThanOrEqual(0);
  });

  it("honors custom base and cap values", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(fullJitterBackoff(3, 100, 1000)).toBe(0);
  });

  it("never returns below zero", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(fullJitterBackoff(2)).toBe(0);
  });
});

describe("getRuntimeLabel", () => {
  it("returns node when running under node", () => {
    // The default vitest/node runtime has process.versions.node.
    expect(getRuntimeLabel()).toMatch(/^node\//);
  });

  it("returns a bun label when Bun is present", () => {
    vi.stubGlobal("Bun", { version: "1.0.0" });
    expect(getRuntimeLabel()).toBe("bun/1.0.0");
  });

  it("returns a deno label when Deno is present", () => {
    vi.stubGlobal("Bun", undefined);
    vi.stubGlobal("Deno", { version: { deno: "1.40.0" } });
    expect(getRuntimeLabel()).toBe("deno/1.40.0");
  });

  it("returns edge when EdgeRuntime is defined and no node runtime", () => {
    vi.stubGlobal("Bun", undefined);
    vi.stubGlobal("Deno", undefined);
    vi.stubGlobal("process", undefined);
    vi.stubGlobal("EdgeRuntime", "edge-runtime");
    expect(getRuntimeLabel()).toBe("edge");
  });

  it("returns browser when document is defined and no other runtime", () => {
    vi.stubGlobal("Bun", undefined);
    vi.stubGlobal("Deno", undefined);
    vi.stubGlobal("process", undefined);
    vi.stubGlobal("EdgeRuntime", undefined);
    vi.stubGlobal("document", {});
    expect(getRuntimeLabel()).toBe("browser");
  });

  it("returns unknown when nothing matches", () => {
    vi.stubGlobal("Bun", undefined);
    vi.stubGlobal("Deno", undefined);
    vi.stubGlobal("process", undefined);
    vi.stubGlobal("EdgeRuntime", undefined);
    vi.stubGlobal("document", undefined);
    expect(getRuntimeLabel()).toBe("unknown");
  });
});

describe("generateIdempotencyKey", () => {
  it("uses crypto.randomUUID when available", () => {
    const randomUUID = vi.fn(() => "11111111-2222-3333-4444-555555555555");
    vi.stubGlobal("crypto", { randomUUID });
    expect(generateIdempotencyKey()).toBe("11111111-2222-3333-4444-555555555555");
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("falls back to an idem_ prefixed key when crypto is absent", () => {
    vi.stubGlobal("crypto", undefined);
    const key = generateIdempotencyKey();
    expect(key).toMatch(/^idem_[0-9a-z]+$/);
  });

  it("falls back when crypto exists but randomUUID is not a function", () => {
    vi.stubGlobal("crypto", { randomUUID: undefined });
    const key = generateIdempotencyKey();
    expect(key.startsWith("idem_")).toBe(true);
  });
});
