import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "./config";
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_APP_BASE_URL,
  DEFAULT_GATEWAY_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
} from "./constants";
import type { FetchLike } from "./types";

describe("resolveClientOptions", () => {
  it("applies defaults when no options are passed", () => {
    const resolved = resolveClientOptions();
    expect(resolved.baseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(resolved.appBaseUrl).toBe(DEFAULT_APP_BASE_URL);
    expect(resolved.gatewayUrl).toBe(DEFAULT_GATEWAY_URL);
    expect(resolved.timeout).toBe(DEFAULT_TIMEOUT_MS);
    expect(resolved.maxRetries).toBe(DEFAULT_MAX_RETRIES);
    expect(resolved.defaultHeaders).toEqual({});
    expect(resolved.organizationId).toBeUndefined();
    expect(typeof resolved.fetch).toBe("function");
    expect(typeof resolved.getToken).toBe("function");
  });

  it("applies defaults for an explicit empty object", () => {
    const resolved = resolveClientOptions({});
    expect(resolved.baseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(resolved.maxRetries).toBe(DEFAULT_MAX_RETRIES);
  });

  it("strips trailing slashes from default and custom URLs", () => {
    const resolved = resolveClientOptions({
      baseUrl: "https://api.example.test/v1///",
      appBaseUrl: "https://app.example.test/",
      gatewayUrl: "wss://gw.example.test//",
    });
    expect(resolved.baseUrl).toBe("https://api.example.test/v1");
    expect(resolved.appBaseUrl).toBe("https://app.example.test");
    expect(resolved.gatewayUrl).toBe("wss://gw.example.test");
  });

  it("leaves a URL without a trailing slash untouched", () => {
    const resolved = resolveClientOptions({ baseUrl: "https://api.example.test/v2" });
    expect(resolved.baseUrl).toBe("https://api.example.test/v2");
  });

  describe("token precedence", () => {
    it("uses getToken over accessToken and apiKey", async () => {
      const getToken = vi.fn(() => "wmat_dynamic");
      const resolved = resolveClientOptions({
        getToken,
        accessToken: "wmat_static",
        apiKey: "wmbly_static",
      });
      await expect(resolved.getToken()).resolves.toBe("wmat_dynamic");
      expect(getToken).toHaveBeenCalledTimes(1);
    });

    it("awaits an async getToken resolver", async () => {
      const getToken = vi.fn(async () => "wmat_async");
      const resolved = resolveClientOptions({ getToken });
      await expect(resolved.getToken()).resolves.toBe("wmat_async");
    });

    it("resolves getToken returning undefined", async () => {
      const getToken = vi.fn(() => undefined);
      const resolved = resolveClientOptions({ getToken });
      await expect(resolved.getToken()).resolves.toBeUndefined();
    });

    it("prefers apiKey over accessToken when no getToken", async () => {
      const resolved = resolveClientOptions({
        apiKey: "wmbly_key",
        accessToken: "wmat_token",
      });
      await expect(resolved.getToken()).resolves.toBe("wmbly_key");
    });

    it("falls back to accessToken when apiKey is absent", async () => {
      const resolved = resolveClientOptions({ accessToken: "wmat_token" });
      await expect(resolved.getToken()).resolves.toBe("wmat_token");
    });

    it("returns undefined when no credential is supplied", async () => {
      const resolved = resolveClientOptions({});
      await expect(resolved.getToken()).resolves.toBeUndefined();
    });
  });

  describe("custom overrides", () => {
    it("overrides timeout and maxRetries", () => {
      const resolved = resolveClientOptions({ timeout: 1234, maxRetries: 7 });
      expect(resolved.timeout).toBe(1234);
      expect(resolved.maxRetries).toBe(7);
    });

    it("honors timeout and maxRetries of zero", () => {
      const resolved = resolveClientOptions({ timeout: 0, maxRetries: 0 });
      expect(resolved.timeout).toBe(0);
      expect(resolved.maxRetries).toBe(0);
    });

    it("passes through defaultHeaders", () => {
      const headers = { "X-Custom": "1", "X-Trace": "abc" };
      const resolved = resolveClientOptions({ defaultHeaders: headers });
      expect(resolved.defaultHeaders).toEqual(headers);
    });

    it("passes through organizationId", () => {
      const resolved = resolveClientOptions({ organizationId: "org_123" });
      expect(resolved.organizationId).toBe("org_123");
    });
  });

  describe("fetch resolution", () => {
    it("uses a provided fetch implementation", () => {
      const fetchMock = vi.fn(async () => new Response("")) as unknown as FetchLike;
      const resolved = resolveClientOptions({ fetch: fetchMock });
      expect(resolved.fetch).toBe(fetchMock);
    });

    it("falls back to resolveFetch (the platform global) when none is provided", () => {
      const resolved = resolveClientOptions({});
      expect(typeof resolved.fetch).toBe("function");
    });
  });
});
