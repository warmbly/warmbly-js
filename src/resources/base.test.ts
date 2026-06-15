import { describe, expect, it } from "vitest";
import type { HttpClient } from "../core/http";
import { APIResource } from "./base";

// Concrete subclass exposing the protected path helper for testing.
class TestResource extends APIResource {
  build(...segments: Array<string | number>): string {
    return this.path(...segments);
  }
}

describe("APIResource.path", () => {
  const resource = new TestResource(undefined as unknown as HttpClient);

  it("joins segments with slashes", () => {
    expect(resource.build("campaigns", "c1", "steps")).toBe("campaigns/c1/steps");
  });

  it("URL-encodes reserved characters in dynamic segments", () => {
    expect(resource.build("api-keys", "a b/c")).toBe("api-keys/a%20b%2Fc");
  });

  it("stringifies numeric segments", () => {
    expect(resource.build("items", 42)).toBe("items/42");
  });
});
