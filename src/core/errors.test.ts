import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  GatewayError,
  InternalServerError,
  NotFoundError,
  OAuthError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
  WarmblyAPIError,
  WarmblyConnectionError,
  WarmblyError,
} from "./errors";

describe("WarmblyError", () => {
  it("sets the name and is an instance of Error", () => {
    const err = new WarmblyError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(WarmblyError);
    expect(err.name).toBe("WarmblyError");
    expect(err.message).toBe("boom");
  });

  it("attaches a cause when provided", () => {
    const cause = new Error("root");
    const err = new WarmblyError("wrap", { cause });
    expect((err as { cause?: unknown }).cause).toBe(cause);
  });

  it("omits cause when not provided", () => {
    const err = new WarmblyError("no cause");
    expect((err as { cause?: unknown }).cause).toBeUndefined();
  });

  it("treats an explicit undefined cause as absent", () => {
    const err = new WarmblyError("explicit undefined", { cause: undefined });
    expect("cause" in err).toBe(false);
  });
});

describe("WarmblyAPIError constructor", () => {
  it("stores all option fields", () => {
    const headers = new Headers({ "x-test": "1" });
    const err = new WarmblyAPIError("nope", {
      status: 400,
      code: "bad",
      requestId: "req_1",
      body: { ok: false },
      headers,
    });
    expect(err).toBeInstanceOf(WarmblyError);
    expect(err).toBeInstanceOf(WarmblyAPIError);
    expect(err.name).toBe("WarmblyAPIError");
    expect(err.status).toBe(400);
    expect(err.code).toBe("bad");
    expect(err.requestId).toBe("req_1");
    expect(err.body).toEqual({ ok: false });
    expect(err.headers).toBe(headers);
  });

  it("leaves optional fields undefined when omitted", () => {
    const err = new WarmblyAPIError("nope", { status: 500 });
    expect(err.code).toBeUndefined();
    expect(err.requestId).toBeUndefined();
    expect(err.body).toBeUndefined();
    expect(err.headers).toBeUndefined();
  });
});

describe("WarmblyAPIError.from status mapping", () => {
  const cases: Array<[number, new (...args: never[]) => WarmblyAPIError, string]> = [
    [400, BadRequestError, "BadRequestError"],
    [401, AuthenticationError, "AuthenticationError"],
    [403, PermissionDeniedError, "PermissionDeniedError"],
    [404, NotFoundError, "NotFoundError"],
    [409, ConflictError, "ConflictError"],
    [422, UnprocessableEntityError, "UnprocessableEntityError"],
    [500, InternalServerError, "InternalServerError"],
    [503, InternalServerError, "InternalServerError"],
  ];

  for (const [status, ctor, name] of cases) {
    it(`maps ${status} to ${name}`, () => {
      const err = WarmblyAPIError.from(status, { message: "x" });
      expect(err).toBeInstanceOf(ctor);
      expect(err).toBeInstanceOf(WarmblyAPIError);
      expect(err).toBeInstanceOf(WarmblyError);
      expect(err.name).toBe(name);
      expect(err.status).toBe(status);
    });
  }

  it("maps 429 to RateLimitError", () => {
    const err = WarmblyAPIError.from(429, { message: "slow down" });
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.name).toBe("RateLimitError");
    expect(err.status).toBe(429);
  });

  it("returns a base WarmblyAPIError for an unmapped status (418)", () => {
    const err = WarmblyAPIError.from(418, { message: "teapot" });
    expect(err).toBeInstanceOf(WarmblyAPIError);
    expect(err).not.toBeInstanceOf(BadRequestError);
    expect(err).not.toBeInstanceOf(InternalServerError);
    expect(err.name).toBe("WarmblyAPIError");
    expect(err.status).toBe(418);
    expect(err.message).toBe("teapot");
  });
});

describe("WarmblyAPIError.from message fallback chain", () => {
  it("prefers parsed.message", () => {
    const err = WarmblyAPIError.from(400, { message: "primary", error: "secondary" });
    expect(err.message).toBe("primary");
  });

  it("falls back to parsed.error when message is absent", () => {
    const err = WarmblyAPIError.from(400, { error: "Bad Request" });
    expect(err.message).toBe("Bad Request");
  });

  it("uses the default message when neither message nor error is present", () => {
    const err = WarmblyAPIError.from(404, {});
    expect(err.message).toBe("Warmbly API error (HTTP 404)");
  });

  it("uses the default message when the body is not an object", () => {
    const err = WarmblyAPIError.from(500, "totally not json");
    expect(err.message).toBe("Warmbly API error (HTTP 500)");
    expect(err.body).toBe("totally not json");
  });

  it("uses the default message when the body is null", () => {
    const err = WarmblyAPIError.from(500, null);
    expect(err.message).toBe("Warmbly API error (HTTP 500)");
  });
});

describe("WarmblyAPIError.from requestId and code", () => {
  it("uses the requestId argument when supplied", () => {
    const err = WarmblyAPIError.from(400, { request_id: "from_body" }, undefined, "from_arg");
    expect(err.requestId).toBe("from_arg");
  });

  it("falls back to body.request_id when the argument is absent", () => {
    const err = WarmblyAPIError.from(400, { request_id: "from_body" });
    expect(err.requestId).toBe("from_body");
  });

  it("leaves requestId undefined when neither source has it", () => {
    const err = WarmblyAPIError.from(400, {});
    expect(err.requestId).toBeUndefined();
  });

  it("passes through the code from the body", () => {
    const err = WarmblyAPIError.from(429, { code: "rate_limit_exceeded" });
    expect(err.code).toBe("rate_limit_exceeded");
  });

  it("passes through the headers", () => {
    const headers = new Headers({ "x-trace": "abc" });
    const err = WarmblyAPIError.from(404, {}, headers);
    expect(err.headers).toBe(headers);
  });
});

describe("RateLimitError retryAfter sources", () => {
  it("reads retryAfter from a numeric Retry-After header", () => {
    const headers = new Headers({ "retry-after": "30" });
    const err = WarmblyAPIError.from(429, {}, headers) as RateLimitError;
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfter).toBe(30);
  });

  it("converts body.retry_after_ms from milliseconds to ceil seconds", () => {
    const err = WarmblyAPIError.from(429, { retry_after_ms: 2500 }) as RateLimitError;
    expect(err.retryAfter).toBe(3);
  });

  it("falls back to legacy body.retry_after seconds", () => {
    const err = WarmblyAPIError.from(429, { retry_after: 12 }) as RateLimitError;
    expect(err.retryAfter).toBe(12);
  });

  it("prefers the header over the body", () => {
    const headers = new Headers({ "retry-after": "5" });
    const err = WarmblyAPIError.from(
      429,
      { retry_after_ms: 99000, retry_after: 88 },
      headers,
    ) as RateLimitError;
    expect(err.retryAfter).toBe(5);
  });

  it("leaves retryAfter undefined when no source is present", () => {
    const err = WarmblyAPIError.from(429, {}) as RateLimitError;
    expect(err.retryAfter).toBeUndefined();
  });

  it("reads retryAfter from an HTTP-date Retry-After header", () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const headers = new Headers({ "retry-after": future });
    const err = WarmblyAPIError.from(429, {}, headers) as RateLimitError;
    expect(err.retryAfter).toBeGreaterThanOrEqual(58);
    expect(err.retryAfter).toBeLessThanOrEqual(60);
  });

  it("clamps a past HTTP-date Retry-After header to zero", () => {
    const past = new Date(Date.now() - 60_000).toUTCString();
    const headers = new Headers({ "retry-after": past });
    const err = WarmblyAPIError.from(429, {}, headers) as RateLimitError;
    expect(err.retryAfter).toBe(0);
  });

  it("ignores an unparseable Retry-After header and uses the body", () => {
    const headers = new Headers({ "retry-after": "not-a-date" });
    const err = WarmblyAPIError.from(429, { retry_after: 7 }, headers) as RateLimitError;
    expect(err.retryAfter).toBe(7);
  });

  it("supports constructing RateLimitError directly with retryAfter", () => {
    const err = new RateLimitError("slow", { status: 429, retryAfter: 4 });
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.name).toBe("RateLimitError");
    expect(err.retryAfter).toBe(4);
  });
});

describe("API error subclasses", () => {
  const subclasses: Array<[new (m: string, o: { status: number }) => WarmblyAPIError, string]> = [
    [BadRequestError, "BadRequestError"],
    [AuthenticationError, "AuthenticationError"],
    [PermissionDeniedError, "PermissionDeniedError"],
    [NotFoundError, "NotFoundError"],
    [ConflictError, "ConflictError"],
    [UnprocessableEntityError, "UnprocessableEntityError"],
    [InternalServerError, "InternalServerError"],
  ];

  for (const [ctor, name] of subclasses) {
    it(`${name} carries the right name and prototype chain`, () => {
      const err = new ctor("msg", { status: 400 });
      expect(err).toBeInstanceOf(ctor);
      expect(err).toBeInstanceOf(WarmblyAPIError);
      expect(err).toBeInstanceOf(WarmblyError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe(name);
    });
  }
});

describe("WarmblyConnectionError", () => {
  it("sets the name and inheritance chain", () => {
    const err = new WarmblyConnectionError("offline");
    expect(err).toBeInstanceOf(WarmblyError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("WarmblyConnectionError");
    expect(err.message).toBe("offline");
  });

  it("carries a cause", () => {
    const cause = new Error("ECONNRESET");
    const err = new WarmblyConnectionError("offline", { cause });
    expect((err as { cause?: unknown }).cause).toBe(cause);
  });
});

describe("OAuthError", () => {
  it("composes the message with a description", () => {
    const err = new OAuthError("invalid_grant", { description: "token expired" });
    expect(err).toBeInstanceOf(WarmblyError);
    expect(err.name).toBe("OAuthError");
    expect(err.message).toBe("invalid_grant: token expired");
    expect(err.error).toBe("invalid_grant");
    expect(err.errorDescription).toBe("token expired");
  });

  it("uses the bare error code when no description is given", () => {
    const err = new OAuthError("invalid_request");
    expect(err.message).toBe("invalid_request");
    expect(err.error).toBe("invalid_request");
    expect(err.errorDescription).toBeUndefined();
    expect(err.status).toBeUndefined();
  });

  it("records the status and cause", () => {
    const cause = new Error("network");
    const err = new OAuthError("server_error", { status: 500, cause });
    expect(err.status).toBe(500);
    expect((err as { cause?: unknown }).cause).toBe(cause);
  });
});

describe("GatewayError", () => {
  it("sets code, reason, and inheritance", () => {
    const err = new GatewayError("rejected", { code: 4004, reason: "auth failed" });
    expect(err).toBeInstanceOf(WarmblyError);
    expect(err.name).toBe("GatewayError");
    expect(err.message).toBe("rejected");
    expect(err.code).toBe(4004);
    expect(err.reason).toBe("auth failed");
  });

  it("leaves code and reason undefined when omitted", () => {
    const err = new GatewayError("rejected");
    expect(err.code).toBeUndefined();
    expect(err.reason).toBeUndefined();
  });

  it("carries a cause", () => {
    const cause = new Error("ws closed");
    const err = new GatewayError("rejected", { cause });
    expect((err as { cause?: unknown }).cause).toBe(cause);
  });
});
