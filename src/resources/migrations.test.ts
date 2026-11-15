import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Migrations } from "./migrations";

function clientWith(responses: Array<{ body?: unknown; status?: number }>): {
  http: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  let i = 0;
  const fetchMock = vi.fn(async () => {
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const status = next?.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(next?.body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  const http = new HttpClient(
    resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
  );
  return { http, fetchMock };
}

function callAt(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

function bodyOf(init: RequestInit): unknown {
  return init.body === undefined || init.body === null ? undefined : JSON.parse(String(init.body));
}

const provider = {
  id: "smartlead",
  label: "Smartlead",
  fields: [{ key: "api_key", label: "API key", secret: true, placeholder: "sl_..." }],
  key_help: "Settings, then API key.",
  key_url: "https://app.smartlead.ai/app/settings/profile",
  kinds: ["mailboxes", "campaigns", "leads", "blocklist"],
  workspaces: true,
  multi_key: false,
  mailbox_secrets: true,
  notes: ["LinkedIn steps are not imported."],
};

const scanning = {
  id: "mig_1",
  organization_id: "org_1",
  created_by_user_id: "usr_1",
  provider: "smartlead",
  label: "Old Smartlead",
  status: "scanning",
  accounts: [{ name: "Acme", email: "ops@acme.com", plan: "pro" }],
  inventory: [],
  targets: [],
  credentials_held: true,
  created_at: "2026-11-08T10:00:00Z",
  updated_at: "2026-11-08T10:00:00Z",
};

const running = {
  ...scanning,
  status: "running",
  inventory: [
    {
      workspace: { id: "", name: "Acme account" },
      inventory: {
        mailboxes: 3,
        campaigns: 2,
        leads: 400,
        blocklist: 12,
        campaign_summaries: [{ id: "c1", name: "Q4", status: "active", steps: 3, leads: 200 }],
      },
    },
  ],
  options: {
    kinds: ["campaigns", "leads"],
    in_flight: "restart",
    skip_finished: true,
    warmup: false,
  },
  targets: [
    {
      id: "tgt_1",
      migration_id: "mig_1",
      workspace: { id: "", name: "Acme account" },
      organization_id: "org_1",
      organization_name: "Acme",
      status: "running",
      phase: "leads",
      counts: {
        blocklist_imported: 0,
        mailboxes_queued: 0,
        mailboxes_manual: 0,
        campaigns_created: 2,
        campaigns_skipped: 0,
        steps_created: 6,
        leads_read: 150,
        contacts_imported: 140,
        contacts_updated: 10,
        leads_enrolled: 120,
        leads_not_enrolled: 25,
        leads_suppressed: 3,
        leads_failed: 2,
      },
      followup: {
        reconnect: [{ email: "a@acme.com", kind: "google" }],
        campaigns: [
          {
            source_id: "c1",
            campaign_id: "cmp_1",
            name: "Q4",
            missing_senders: ["a@acme.com"],
          },
        ],
      },
      category_id: "cat_1",
      started_at: "2026-11-08T10:05:00Z",
      updated_at: "2026-11-08T10:06:00Z",
    },
  ],
  started_at: "2026-11-08T10:05:00Z",
};

describe("Migrations", () => {
  it("lists providers and unwraps the data envelope", async () => {
    const { http, fetchMock } = clientWith([{ body: { data: [provider] } }]);
    const providers = await new Migrations(http).providers();
    expect(providers).toHaveLength(1);
    expect(providers[0]?.fields[0]?.key).toBe("api_key");
    expect(providers[0]?.mailbox_secrets).toBe(true);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(new URL(url).pathname).toBe("/v1/migrations/providers");
  });

  it("lists migrations with limit and follows the cursor when iterating", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          data: [running],
          pagination: { total: null, next_cursor: "cur_2", has_more: true },
        },
      },
      {
        body: {
          data: [{ ...scanning, id: "mig_2" }],
          pagination: { total: null, next_cursor: null, has_more: false },
        },
      },
    ]);
    const ids: string[] = [];
    for await (const m of await new Migrations(http).list({ limit: 1 })) ids.push(m.id);
    expect(ids).toEqual(["mig_1", "mig_2"]);
    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("GET");
    expect(new URL(first.url).pathname).toBe("/v1/migrations");
    expect(new URL(first.url).searchParams.get("limit")).toBe("1");
    expect(new URL(callAt(fetchMock, 1).url).searchParams.get("cursor")).toBe("cur_2");
  });

  it("creates a migration with provider, label and credentials", async () => {
    const { http, fetchMock } = clientWith([{ body: scanning, status: 201 }]);
    const m = await new Migrations(http).create({
      provider: "smartlead",
      label: "Old Smartlead",
      credentials: [{ api_key: "sl_x" }],
    });
    expect(m.status).toBe("scanning");
    expect(m.accounts[0]?.email).toBe("ops@acme.com");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(new URL(url).pathname).toBe("/v1/migrations");
    expect(bodyOf(init)).toEqual({
      provider: "smartlead",
      label: "Old Smartlead",
      credentials: [{ api_key: "sl_x" }],
    });
  });

  it("gets a migration and decodes inventory and targets", async () => {
    const { http, fetchMock } = clientWith([{ body: running }]);
    const m = await new Migrations(http).get("mig_1");
    expect(m.inventory[0]?.inventory.campaign_summaries?.[0]?.status).toBe("active");
    expect(m.targets[0]?.counts.leads_enrolled).toBe(120);
    expect(m.targets[0]?.followup.campaigns?.[0]?.missing_senders).toEqual(["a@acme.com"]);
    expect(m.options?.in_flight).toBe("restart");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(new URL(url).pathname).toBe("/v1/migrations/mig_1");
  });

  it("starts a migration with options and targets", async () => {
    const { http, fetchMock } = clientWith([{ body: running }]);
    const m = await new Migrations(http).start("mig_1", {
      options: { kinds: ["campaigns", "leads"], in_flight: "restart", skip_finished: true },
      targets: [{ workspace_id: "ws_2", key: 0, skip: true }],
    });
    expect(m.status).toBe("running");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(new URL(url).pathname).toBe("/v1/migrations/mig_1/start");
    expect(bodyOf(init)).toEqual({
      options: { kinds: ["campaigns", "leads"], in_flight: "restart", skip_finished: true },
      targets: [{ workspace_id: "ws_2", key: 0, skip: true }],
    });
  });

  it("cancels a migration with no body", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          ...running,
          status: "canceled",
          credentials_held: false,
          finished_at: "2026-11-08T10:10:00Z",
        },
      },
    ]);
    const m = await new Migrations(http).cancel("mig_1");
    expect(m.status).toBe("canceled");
    expect(m.credentials_held).toBe(false);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(new URL(url).pathname).toBe("/v1/migrations/mig_1/cancel");
    expect(bodyOf(init)).toBeUndefined();
  });

  it("links senders with no body", async () => {
    const { http, fetchMock } = clientWith([{ body: { ...running, status: "completed" } }]);
    const m = await new Migrations(http).linkSenders("mig_1");
    expect(m.status).toBe("completed");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(new URL(url).pathname).toBe("/v1/migrations/mig_1/link-senders");
    expect(bodyOf(init)).toBeUndefined();
  });

  it("dismisses a migration and tolerates 204", async () => {
    const { http, fetchMock } = clientWith([{ status: 204 }]);
    await expect(new Migrations(http).delete("mig_1")).resolves.toBeUndefined();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(new URL(url).pathname).toBe("/v1/migrations/mig_1");
  });
});
