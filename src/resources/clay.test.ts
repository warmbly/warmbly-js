import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Clay } from "./clay";

function clientWith(body: unknown): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
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

const settings = {
  connection_id: "conn_1",
  label: "Clay",
  status: "connected",
  health: "healthy",
  inbound_url_minted: true,
  defaults: {
    campaign_id: "camp_1",
    category_ids: [],
    segment_ids: ["seg_1"],
    dedup: "update",
    subscribed: true,
  },
  outbound: {
    webhook_url_set: true,
    webhook_host: "api.clay.com",
    auth_token_set: false,
    events: ["campaign.reply_received"],
  },
  stats: {
    received: 120,
    created: 90,
    updated: 20,
    skipped: 8,
    failed: 2,
    last_received_at: "2026-10-01T09:30:00Z",
    last_error: "bad email",
  },
  available_events: ["campaign.reply_received", "meeting.booked"],
};

describe("Clay", () => {
  it("settings() GETs /integrations/clay/:id", async () => {
    const { http, fetchMock } = clientWith(settings);
    const out = await new Clay(http).settings("conn_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/integrations\/clay\/conn_1$/);
    expect(out.inbound_url_minted).toBe(true);
    expect(out.outbound.webhook_host).toBe("api.clay.com");
    expect(out.stats.received).toBe(120);
    expect(out.defaults.segment_ids).toEqual(["seg_1"]);
  });

  it("updateSettings() PATCHes only the fields given", async () => {
    const { http, fetchMock } = clientWith(settings);
    const out = await new Clay(http).updateSettings("conn_1", {
      webhook_url: "https://api.clay.com/v3/sources/webhook/abc",
      events: ["campaign.reply_received"],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/integrations\/clay\/conn_1$/);
    expect(JSON.parse(String(init.body))).toEqual({
      webhook_url: "https://api.clay.com/v3/sources/webhook/abc",
      events: ["campaign.reply_received"],
    });
    expect(out.outbound.events).toEqual(["campaign.reply_received"]);
  });

  it("updateSettings() sends defaults whole and empty strings to clear", async () => {
    const { http, fetchMock } = clientWith(settings);
    await new Clay(http).updateSettings("conn_1", {
      defaults: { category_ids: [], segment_ids: [], dedup: "skip", subscribed: false },
      auth_token: "",
    });
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({
      defaults: { category_ids: [], segment_ids: [], dedup: "skip", subscribed: false },
      auth_token: "",
    });
  });
});
