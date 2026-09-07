import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { BadRequestError } from "../core/errors";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { WEBHOOK_EVENTS, WEBHOOK_FIREHOSE_EVENTS, Webhooks } from "./webhooks";

function clientWith(
  body: unknown,
  init: { status?: number } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const status = init.status ?? 200;
  const payload = status === 204 || body === undefined ? null : JSON.stringify(body);
  const fetchMock = vi.fn(
    async () =>
      new Response(payload, {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  const http = new HttpClient(
    resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
  );
  return { http, fetchMock };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

describe("Webhooks", () => {
  it("lists endpoints from the { endpoints } envelope", async () => {
    const { http, fetchMock } = clientWith({
      endpoints: [{ id: "ep1", url: "https://hooks.warmbly.com/in" }],
    });
    const { endpoints } = await new Webhooks(http).list();
    expect(endpoints[0]?.id).toBe("ep1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/webhooks");
  });

  it("forwards request options on list", async () => {
    const { http, fetchMock } = clientWith({ endpoints: [] });
    await new Webhooks(http).list({ headers: { "x-trace": "abc" } });
    const headers = new Headers(lastCall(fetchMock).init.headers);
    expect(headers.get("x-trace")).toBe("abc");
  });

  it("creates an endpoint and returns the one-time secret", async () => {
    const { http, fetchMock } = clientWith({
      id: "ep1",
      url: "https://hooks.warmbly.com/in",
      secret: "whsec_abc",
    });
    const ep = await new Webhooks(http).create({
      url: "https://hooks.warmbly.com/in",
      event_types: ["campaign.reply_received"],
      enabled: true,
    });
    expect(ep.secret).toBe("whsec_abc");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/webhooks");
    expect(JSON.parse(String(init.body))).toEqual({
      url: "https://hooks.warmbly.com/in",
      event_types: ["campaign.reply_received"],
      enabled: true,
    });
  });

  it("returns the event-type catalog", async () => {
    const { http, fetchMock } = clientWith({
      event_types: [{ type: "campaign.reply_received", category: "campaign" }],
    });
    const { event_types } = await new Webhooks(http).eventTypes();
    expect(event_types[0]?.type).toBe("campaign.reply_received");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/webhooks/event-types");
  });

  it("paginates org-wide deliveries with query params", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "d1", status: "delivered" }],
      pagination: { next_cursor: null, has_more: false, total: null },
    });
    const page = await new Webhooks(http).deliveries({ status: "delivered" });
    expect(page.data[0]?.id).toBe("d1");
    expect(lastCall(fetchMock).url).toContain("/webhooks/deliveries?status=delivered");
  });

  it("paginates deliveries with no params", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { next_cursor: null, has_more: false, total: null },
    });
    const page = await new Webhooks(http).deliveries();
    expect(page.data).toEqual([]);
    expect(lastCall(fetchMock).url).toContain("/webhooks/deliveries");
  });

  it("redelivers and returns the queued acknowledgement", async () => {
    const { http, fetchMock } = clientWith({ status: "queued" });
    const result = await new Webhooks(http).redeliver("dlv_1");
    expect(result.status).toBe("queued");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/webhooks/deliveries/dlv_1/redeliver");
  });

  it("lists throttle drops with query params", async () => {
    const { http, fetchMock } = clientWith({ drops: [{ event_type: "campaign.sent" }] });
    const drops = await new Webhooks(http).throttleDrops({ limit: 10 });
    expect(drops.drops).toEqual([{ event_type: "campaign.sent" }]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/webhooks/throttle-drops?limit=10");
  });

  it("lists throttle drops without params", async () => {
    const { http, fetchMock } = clientWith({ drops: [] });
    await new Webhooks(http).throttleDrops();
    expect(lastCall(fetchMock).url).toContain("/webhooks/throttle-drops");
  });

  it("updates an endpoint with PATCH and full body", async () => {
    const { http, fetchMock } = clientWith({
      id: "ep1",
      url: "https://hooks.warmbly.com/in",
      enabled: false,
    });
    const ep = await new Webhooks(http).update("ep1", {
      url: "https://hooks.warmbly.com/in",
      enabled: false,
    });
    expect(ep.enabled).toBe(false);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/webhooks/ep1");
    expect(JSON.parse(String(init.body))).toEqual({
      url: "https://hooks.warmbly.com/in",
      enabled: false,
    });
  });

  it("deletes an endpoint", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await new Webhooks(http).delete("ep1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/webhooks/ep1");
  });

  it("rotates the signing secret", async () => {
    const { http, fetchMock } = clientWith({ secret: "whsec_new" });
    const { secret } = await new Webhooks(http).rotateSecret("ep1");
    expect(secret).toBe("whsec_new");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/webhooks/ep1/rotate-secret");
  });

  it("verifies an endpoint", async () => {
    const { http, fetchMock } = clientWith({ status: "verification_sent" });
    const result = await new Webhooks(http).verify("ep1");
    expect(result.status).toBe("verification_sent");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/webhooks/ep1/verify");
  });

  it("paginates endpoint-scoped deliveries with query params", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "d2", status: "failed" }],
      pagination: { next_cursor: null, has_more: false, total: null },
    });
    const page = await new Webhooks(http).endpointDeliveries("ep1", { status: "failed" });
    expect(page.data[0]?.id).toBe("d2");
    expect(lastCall(fetchMock).url).toContain("/webhooks/ep1/deliveries?status=failed");
  });

  it("paginates endpoint-scoped deliveries with no params", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { next_cursor: null, has_more: false, total: null },
    });
    const page = await new Webhooks(http).endpointDeliveries("ep1");
    expect(page.data).toEqual([]);
    expect(lastCall(fetchMock).url).toContain("/webhooks/ep1/deliveries");
  });

  it("maps a bad limit to BadRequestError", async () => {
    const { http } = clientWith(
      { code: "bad_request", message: "limit out of range" },
      { status: 400 },
    );
    await expect(new Webhooks(http).deliveries({ limit: 9999 })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });
});

describe("WEBHOOK_EVENTS catalog", () => {
  it("has no duplicates", () => {
    expect(new Set(WEBHOOK_EVENTS).size).toBe(WEBHOOK_EVENTS.length);
  });

  it("covers the documented families", () => {
    const names: readonly string[] = WEBHOOK_EVENTS;
    expect(names).toContain("campaign.reply_received");
    expect(names).toContain("inbox.reply_received");
    expect(names).toContain("warmup.blocked");
    expect(names).toContain("deliverability.bounce");
    expect(names).toContain("meeting.booked");
    expect(names).toContain("crm.deal_created");
    expect(names).toContain("lead_sync_source.updated");
    expect(names).toContain("contact.created");
    expect(names).toContain("form.submitted");
    expect(names).toContain("custom.event");
    expect(names).toContain("webhook.test");
  });

  it("lists the firehose events as a subset of the catalog", () => {
    const names: readonly string[] = WEBHOOK_EVENTS;
    for (const event of WEBHOOK_FIREHOSE_EVENTS) {
      expect(names).toContain(event);
    }
    // These are opt-in only, so they are exactly the high-volume per-message events.
    expect(WEBHOOK_FIREHOSE_EVENTS).toContain("campaign.email_opened");
    expect(WEBHOOK_FIREHOSE_EVENTS).not.toContain("campaign.reply_received");
  });
});
