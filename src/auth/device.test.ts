import { describe, expect, it, vi } from "vitest";
import { NotFoundError, WarmblyConnectionError } from "../core/errors";
import type { FetchLike } from "../core/types";
import { Permissions } from "../permissions";
import { DeviceAuth, DeviceAuthError } from "./device";

type Reply = { body?: unknown; status?: number; throws?: unknown };

/** Builds a DeviceAuth whose fetch answers the given replies in order (the last one repeats). */
function deviceWith(replies: Reply[]): {
  device: DeviceAuth;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  let index = 0;
  const fetchMock = vi.fn(async () => {
    const reply = replies[Math.min(index, replies.length - 1)] as Reply;
    index += 1;
    if (reply.throws !== undefined) throw reply.throws;
    return new Response(reply.body === undefined ? "" : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  const device = new DeviceAuth({ fetch: fetchMock as unknown as FetchLike });
  return { device, fetchMock };
}

function call(fetchMock: ReturnType<typeof vi.fn>, n: number): { url: string; init: RequestInit } {
  const c = fetchMock.mock.calls[n];
  return { url: String(c?.[0]), init: (c?.[1] ?? {}) as RequestInit };
}

const started = {
  device_code: "dev_1",
  user_code: "ABCD-1234",
  verification_uri: "https://app.warmbly.com/cli",
  verification_uri_complete: "https://app.warmbly.com/cli?code=ABCD-1234",
  expires_in: 600,
  interval: 5,
};

describe("DeviceAuth.start", () => {
  it("POSTs /auth/cli/code with the scopes as a bitmask and no bearer token", async () => {
    const { device, fetchMock } = deviceWith([{ body: started, status: 201 }]);
    const out = await device.start({
      client_name: "my-tool",
      hostname: "laptop",
      scopes: ["read_campaigns", "READ_CONTACTS"],
    });
    const { url, init } = call(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toBe("https://api.warmbly.com/v1/auth/cli/code");
    expect(JSON.parse(String(init.body))).toEqual({
      client_name: "my-tool",
      hostname: "laptop",
      scopes: Permissions.from("read_campaigns", "read_contacts").value,
    });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(out.user_code).toBe("ABCD-1234");
  });

  it("accepts a numeric mask or a Permissions set for scopes", async () => {
    const { device, fetchMock } = deviceWith([{ body: started, status: 201 }]);
    await device.start({ client_name: "x", scopes: 6 });
    expect(JSON.parse(String(call(fetchMock, 0).init.body)).scopes).toBe(6);
    await device.start({ client_name: "x", scopes: Permissions.readOnly() });
    expect(JSON.parse(String(call(fetchMock, 1).init.body)).scopes).toBe(
      Permissions.readOnly().value,
    );
  });

  it("honours a custom baseUrl", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(started), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );
    const device = new DeviceAuth({
      baseUrl: "https://warmbly.acme.internal/v1/",
      fetch: fetchMock as unknown as FetchLike,
    });
    await device.start({ client_name: "x", scopes: 1 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://warmbly.acme.internal/v1/auth/cli/code",
    );
  });
});

describe("DeviceAuth.poll", () => {
  it("POSTs the device_code to /auth/cli/poll", async () => {
    const { device, fetchMock } = deviceWith([{ body: { status: "pending" } }]);
    const out = await device.poll("dev_1");
    const { url, init } = call(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/auth\/cli\/poll$/);
    expect(JSON.parse(String(init.body))).toEqual({ device_code: "dev_1" });
    expect(out.status).toBe("pending");
  });

  it("does not retry a failed poll", async () => {
    const { device, fetchMock } = deviceWith([{ throws: new TypeError("network down") }]);
    await expect(device.poll("dev_1")).rejects.toBeInstanceOf(WarmblyConnectionError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("DeviceAuth.waitForApproval", () => {
  it("polls at the interval until approved and returns the key exactly once", async () => {
    vi.useFakeTimers();
    try {
      const { device, fetchMock } = deviceWith([
        { body: { status: "pending" } },
        { body: { status: "pending" } },
        { body: { status: "approved", token: "wmbly_new", organization_name: "Acme" } },
      ]);
      const onPoll = vi.fn();
      const waiting = device.waitForApproval(started, { onPoll });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(5_000);
      const out = await waiting;
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(out.token).toBe("wmbly_new");
      expect(out.organization_name).toBe("Acme");
      expect(onPoll).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws a denied DeviceAuthError when the member denies", async () => {
    const { device } = deviceWith([{ body: { status: "denied" } }]);
    const err = await device.waitForApproval(started).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeviceAuthError);
    expect((err as DeviceAuthError).failure).toBe("denied");
  });

  it("throws a claimed DeviceAuthError when the key was already handed out", async () => {
    const { device } = deviceWith([{ body: { status: "claimed" } }]);
    const err = await device.waitForApproval(started).catch((e: unknown) => e);
    expect((err as DeviceAuthError).failure).toBe("claimed");
  });

  it("maps a 404 on the code to an expired DeviceAuthError", async () => {
    const { device } = deviceWith([
      { body: { error: "Not Found", code: "not_found", message: "unknown code" }, status: 404 },
    ]);
    const err = await device.waitForApproval(started).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeviceAuthError);
    expect((err as DeviceAuthError).failure).toBe("expired");
    expect((err as DeviceAuthError).cause).toBeInstanceOf(NotFoundError);
  });

  it("keeps polling through a transient network failure", async () => {
    vi.useFakeTimers();
    try {
      const { device, fetchMock } = deviceWith([
        { throws: new TypeError("network down") },
        { body: { status: "approved", token: "wmbly_new" } },
      ]);
      const waiting = device.waitForApproval({ ...started, interval: 1 });
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1_000);
      const out = await waiting;
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(out.token).toBe("wmbly_new");
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up with an expired DeviceAuthError once expires_in has elapsed", async () => {
    const { device, fetchMock } = deviceWith([{ body: { status: "pending" } }]);
    const err = await device
      .waitForApproval({ ...started, interval: 1, expires_in: 0 })
      .catch((e: unknown) => e);
    expect((err as DeviceAuthError).failure).toBe("expired");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts a poll that is still in flight instead of waiting for it", async () => {
    // A real fetch rejects when its signal aborts. Without the signal being forwarded the
    // wait would sit here until the request settled or the 60s HTTP timeout fired.
    let sawSignal: AbortSignal | undefined;
    const fetchMock = vi.fn(
      (_url: unknown, init: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          sawSignal = init.signal;
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
    );
    const device = new DeviceAuth({ fetch: fetchMock as unknown as FetchLike });
    const controller = new AbortController();
    const waiting = device.waitForApproval(started, { signal: controller.signal });
    // The client resolves a token before dispatching, so the fetch is several ticks away.
    for (let i = 0; i < 50 && sawSignal === undefined; i += 1) await Promise.resolve();
    expect(sawSignal).toBeDefined();
    controller.abort();
    const err = await waiting.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeviceAuthError);
    expect((err as DeviceAuthError).failure).toBe("aborted");
  });

  it("stops when the signal aborts", async () => {
    vi.useFakeTimers();
    try {
      const { device, fetchMock } = deviceWith([{ body: { status: "pending" } }]);
      const controller = new AbortController();
      const waiting = device.waitForApproval(started, { signal: controller.signal });
      await vi.advanceTimersByTimeAsync(0);
      controller.abort();
      const err = await waiting.catch((e: unknown) => e);
      expect((err as DeviceAuthError).failure).toBe("aborted");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
