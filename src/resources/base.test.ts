import { describe, expect, it } from "vitest";
import type { HttpClient } from "../core/http";
import { APIResource } from "./base";

// Concrete subclass exposing the protected path helper for testing.
class TestResource extends APIResource {
  build(...segments: Array<string | number>): string {
    return this.path(...segments);
  }

  // Expose the stored http client so we can assert the constructor wired it.
  client(): HttpClient {
    return this.http;
  }
}

describe("APIResource", () => {
  const resource = new TestResource(undefined as unknown as HttpClient);

  it("stores the HttpClient passed to the constructor", () => {
    const sentinel = { tag: "http" } as unknown as HttpClient;
    const withClient = new TestResource(sentinel);
    expect(withClient.client()).toBe(sentinel);
  });

  describe("path", () => {
    it("joins multiple segments with slashes", () => {
      expect(resource.build("campaigns", "c1", "steps")).toBe("campaigns/c1/steps");
    });

    it("returns a single segment unchanged when no encoding is needed", () => {
      expect(resource.build("contacts")).toBe("contacts");
    });

    it("returns an empty string when called with no segments", () => {
      expect(resource.build()).toBe("");
    });

    it("keeps a leading slash when passed a leading empty string", () => {
      expect(resource.build("", "campaigns")).toBe("/campaigns");
    });

    it("URL-encodes spaces and slashes in dynamic segments", () => {
      expect(resource.build("api-keys", "a b/c")).toBe("api-keys/a%20b%2Fc");
    });

    it("URL-encodes other reserved characters", () => {
      expect(resource.build("contacts", "user@warmbly.com")).toBe("contacts/user%40warmbly.com");
      expect(resource.build("q", "a?b&c=d#e")).toBe("q/a%3Fb%26c%3Dd%23e");
    });

    it("URL-encodes unicode segments", () => {
      expect(resource.build("emails", "café")).toBe("emails/caf%C3%A9");
      expect(resource.build("emails", "naïve résumé")).toBe("emails/na%C3%AFve%20r%C3%A9sum%C3%A9");
    });

    it("stringifies numeric segments", () => {
      expect(resource.build("items", 42)).toBe("items/42");
    });

    it("stringifies and encodes mixed numeric and string segments", () => {
      expect(resource.build("campaigns", 7, "a/b")).toBe("campaigns/7/a%2Fb");
    });

    it("stringifies zero and negative numbers", () => {
      expect(resource.build("page", 0)).toBe("page/0");
      expect(resource.build("offset", -3)).toBe("offset/-3");
    });

    it("encodes a segment that is itself a reserved character", () => {
      expect(resource.build("a", "/", "b")).toBe("a/%2F/b");
    });
  });
});
