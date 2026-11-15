import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Agency } from "./agency";

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
    resolveClientOptions({ apiKey: "wmagency_test", fetch: fetchMock as unknown as FetchLike }),
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

function pathOf(url: string): string {
  return new URL(url).pathname;
}

function queryOf(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

function bodyOf(init: RequestInit): unknown {
  return init.body === undefined ? undefined : JSON.parse(String(init.body));
}

function headerOf(init: RequestInit, name: string): string | undefined {
  const headers = (init.headers ?? {}) as Record<string, string>;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
}

const AG = "a1b2c3d4-0000-4000-8000-000000000001";
const ORG = "0c0c0c0c-0000-4000-8000-000000000002";

const plan = {
  id: "00000000-0000-0000-0000-0000000000a1",
  name: "Agency",
  max_contacts: 0,
  daily_emails: 0,
  ai_generation: true,
  account_limit: 0,
  price: 299,
  price_yearly: 2990,
  discounted_price: 0,
  duration: "month",
  savings: 0,
  public: true,
  dedicated_workers: 0,
  monthly_allowance_usd: 0,
  monthly_credits: 0,
  referral_reward_percent: 100,
  monthly_send_pool: 250000,
  agency_ai_allowance_usd: 50,
  updated_at: "2026-10-01T00:00:00Z",
  created_at: "2026-10-01T00:00:00Z",
};

const agency = {
  id: AG,
  name: "Northwind Growth",
  owner_user_id: "usr_1",
  plan_id: plan.id,
  status: "active",
  current_period_start: "2026-11-01T00:00:00Z",
  current_period_end: "2026-12-01T00:00:00Z",
  cancel_at_period_end: false,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  plan,
  role: "owner",
  client_count: 3,
  has_billing: true,
  billing_interval: "month",
};

const client = {
  organization_id: ORG,
  agency_id: AG,
  monthly_send_limit: 20000,
  monthly_ai_limit_usd: 15,
  added_at: "2026-10-02T00:00:00Z",
  added_by: "usr_1",
  name: "Acme",
  slug: "acme",
  owner_user_id: "usr_1",
};

const usage = {
  unlimited: false,
  period_start: "2026-11-01T00:00:00Z",
  period_end: "2026-12-01T00:00:00Z",
  days_left: 16,
  pool_size: 250000,
  topups: 50000,
  total: 300000,
  used: 120000,
  remaining: 180000,
  projected: 240000,
  clients: [{ organization_id: ORG, name: "Acme", used: 12000, monthly_send_limit: 20000 }],
  topup_sends: 50000,
  topup_price_cents: 8500,
};

const migration = {
  id: "mig_1",
  agency_id: AG,
  created_by_user_id: "usr_1",
  provider: "instantly",
  label: "Instantly import",
  status: "ready",
  accounts: [{ name: "Northwind", email: "ops@northwind.test" }],
  inventory: [
    {
      workspace: { id: "wrk_1", name: "Client One" },
      inventory: {
        mailboxes: 4,
        campaigns: 2,
        leads: 900,
        blocklist: 12,
        campaign_summaries: [{ id: "cmp_1", name: "Q3", status: "active", steps: 3, leads: -1 }],
      },
    },
  ],
  targets: [],
  credentials_held: true,
  created_at: "2026-11-08T10:00:00Z",
  updated_at: "2026-11-08T10:01:00Z",
};

describe("Agency", () => {
  it("lists agencies with billing_enabled", async () => {
    const { http, fetchMock } = clientWith([{ body: { data: [agency], billing_enabled: true } }]);
    const res = await new Agency(http).list();
    expect(res.billing_enabled).toBe(true);
    expect(res.data[0]?.plan?.monthly_send_pool).toBe(250000);
    expect(res.data[0]?.role).toBe("owner");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe("/v1/agency");
  });

  it("lists agency plans", async () => {
    const { http, fetchMock } = clientWith([{ body: { data: [plan], billing_enabled: false } }]);
    const res = await new Agency(http).plans();
    expect(res.data[0]?.agency_ai_allowance_usd).toBe(50);
    expect(res.billing_enabled).toBe(false);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe("/v1/agency/plans");
  });

  it("gets one agency wrapped in `agency`", async () => {
    const { http, fetchMock } = clientWith([{ body: { agency, billing_enabled: true } }]);
    const res = await new Agency(http).get(AG);
    expect(res.agency.name).toBe("Northwind Growth");
    expect(res.agency.client_count).toBe(3);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}`);
  });

  it("lists staff and invitations", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          data: [
            {
              agency_id: AG,
              user_id: "usr_1",
              role: "owner",
              created_at: "2026-10-01T00:00:00Z",
              email: "owner@northwind.test",
              first_name: "Ada",
              last_name: "Byrne",
            },
          ],
          invitations: [
            {
              id: "inv_1",
              agency_id: AG,
              email: "new@northwind.test",
              role: "member",
              invited_by: "usr_1",
              expires_at: "2026-11-22T00:00:00Z",
              created_at: "2026-11-08T00:00:00Z",
            },
          ],
        },
      },
    ]);
    const res = await new Agency(http).members(AG);
    expect(res.data[0]?.email).toBe("owner@northwind.test");
    expect(res.invitations[0]?.role).toBe("member");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/members`);
  });

  it("reads the overview", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          generated_at: "2026-11-15T09:00:00Z",
          usage,
          totals: {
            clients: 3,
            sent_today: 4100,
            replies_waiting: 7,
            positive_replies_7d: 12,
            active_campaigns: 9,
            mailboxes: 40,
            mailbox_problems: 2,
          },
          attention: [
            {
              kind: "bounce_spike",
              severity: "high",
              organization_id: ORG,
              client_name: "Acme",
              count: 31,
              rate: 0.06,
            },
            { kind: "pool_low", severity: "medium", count: 1 },
          ],
          clients: [
            {
              organization_id: ORG,
              name: "Acme",
              access: "full",
              manage_mailboxes: true,
              pool_used: 12000,
              monthly_send_limit: 20000,
              inbox: { replies_waiting: 3 },
            },
          ],
        },
      },
    ]);
    const o = await new Agency(http).overview(AG);
    expect(o.usage?.remaining).toBe(180000);
    expect(o.attention[1]?.organization_id).toBeUndefined();
    expect(o.clients[0]?.inbox?.replies_waiting).toBe(3);
    expect(o.clients[0]?.campaigns).toBeUndefined();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/overview`);
  });

  it("lists mailboxes with a comma-joined client filter and follows the cursor", async () => {
    const mailbox = {
      id: "mb_1",
      organization_id: ORG,
      client: "Acme",
      email: "sam@acme.test",
      name: "Sam",
      provider: "google",
      status: "connected",
      erroring: false,
      warmup: true,
      warmup_state: "watch",
      campaign_limit: 50,
      created_at: "2026-11-01T00:00:00Z",
    };
    const { http, fetchMock } = clientWith([
      { body: { data: [mailbox], pagination: { next_cursor: "cur_2", has_more: true } } },
      {
        body: {
          data: [{ ...mailbox, id: "mb_2", warmup_state: undefined }],
          pagination: { next_cursor: null, has_more: false },
        },
      },
    ]);
    const ids: string[] = [];
    const page = await new Agency(http).mailboxes(AG, {
      client: [ORG, "org_b"],
      attention: true,
      q: "acme",
      limit: 1,
    });
    for await (const mb of page) ids.push(mb.id);
    expect(ids).toEqual(["mb_1", "mb_2"]);
    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("GET");
    expect(pathOf(first.url)).toBe(`/v1/agency/${AG}/mailboxes`);
    expect(queryOf(first.url)).toEqual({
      client: `${ORG},org_b`,
      attention: "true",
      q: "acme",
      limit: "1",
    });
    expect(queryOf(callAt(fetchMock, 1).url)).toEqual({
      client: `${ORG},org_b`,
      attention: "true",
      q: "acme",
      limit: "1",
      cursor: "cur_2",
    });
  });

  it("reads the brand", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          brand: {
            display_name: "Northwind",
            logo_url: "",
            accent_color: "#0055ff",
            website_url: "https://northwind.test",
            hide_powered_by: false,
            updated_at: "2026-11-01T00:00:00Z",
          },
          full_white_label: true,
          can_manage: true,
          portal_domain: {
            forms_domain: "portal.northwind.test",
            forms_domain_verified: true,
            forms_domain_verified_at: "2026-11-02T00:00:00Z",
            cname_target: "portal.warmbly.com",
            status: "verified",
            message: "Verified.",
          },
          portal_base_url: "https://portal.northwind.test",
          portal_sign_in: "portal",
          icon_url: "",
          sign_in_image_url: "",
          theme: { font: "serif" },
        },
      },
    ]);
    const b = await new Agency(http).brand(AG);
    expect(b.portal_domain.forms_domain_verified).toBe(true);
    expect(b.theme.font).toBe("serif");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/brand`);
  });

  it("reads usage", async () => {
    const { http, fetchMock } = clientWith([{ body: usage }]);
    const u = await new Agency(http).usage(AG);
    expect(u.topup_price_cents).toBe(8500);
    expect(u.clients[0]?.monthly_send_limit).toBe(20000);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/usage`);
  });

  it("reads the AI balance", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          unmetered: false,
          period_start: "2026-11-01T00:00:00Z",
          period_end: "2026-12-01T00:00:00Z",
          allowance_usd: 50,
          allowance_left_usd: 20.5,
          purchased_usd: 100,
          bought_this_period_usd: 100,
          spent_usd: 29.5,
          moved_usd: 25,
          balance_usd: 120.5,
          clients: [{ organization_id: ORG, name: "Acme", spent_usd: 9.5, moved_usd: 25 }],
          top_up: { min_usd: 5, max_usd: 5000, presets_usd: [25, 100, 500], default_usd: 100 },
        },
      },
    ]);
    const b = await new Agency(http).aiBalance(AG);
    expect(b.bought_this_period_usd).toBe(100);
    expect(b.top_up.presets_usd).toEqual([25, 100, 500]);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/ai-balance`);
  });
});

describe("AgencyClients", () => {
  it("lists clients unwrapped from `data`", async () => {
    const { http, fetchMock } = clientWith([{ body: { data: [client] } }]);
    const list = await new Agency(http).clients.list(AG);
    expect(list[0]?.monthly_ai_limit_usd).toBe(15);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/clients`);
  });

  it("creates a client", async () => {
    const { http, fetchMock } = clientWith([{ body: client, status: 201 }]);
    const c = await new Agency(http).clients.create(AG, {
      name: "Acme",
      timezone: "Europe/Dublin",
    });
    expect(c.organization_id).toBe(ORG);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/clients`);
    expect(bodyOf(init)).toEqual({ name: "Acme", timezone: "Europe/Dublin" });
    expect(headerOf(init, "idempotency-key")).toBeTruthy();
  });

  it("attaches a workspace by organization_id", async () => {
    const { http, fetchMock } = clientWith([{ body: client, status: 201 }]);
    const c = await new Agency(http).clients.attach(AG, ORG);
    expect(c.name).toBe("Acme");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/clients/attach`);
    expect(bodyOf(init)).toEqual({ organization_id: ORG });
  });

  it("updates caps and sends null to clear one", async () => {
    const { http, fetchMock } = clientWith([
      { body: { ...client, monthly_ai_limit_usd: undefined, monthly_send_limit: 5000 } },
    ]);
    const c = await new Agency(http).clients.update(AG, ORG, {
      monthly_send_limit: 5000,
      monthly_ai_limit_usd: null,
    });
    expect(c.monthly_send_limit).toBe(5000);
    expect(c.monthly_ai_limit_usd).toBeUndefined();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PATCH");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/clients/${ORG}`);
    expect(bodyOf(init)).toEqual({ monthly_send_limit: 5000, monthly_ai_limit_usd: null });
  });

  it("detaches a client and tolerates 204", async () => {
    const { http, fetchMock } = clientWith([{ status: 204 }]);
    await expect(new Agency(http).clients.detach(AG, ORG)).resolves.toBeUndefined();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/clients/${ORG}`);
  });

  it("moves AI balance with the caller's idempotency key", async () => {
    const { http, fetchMock } = clientWith([
      { body: { amount_usd: 25, agency_balance_usd: 95.5, workspace_balance_usd: 40 } },
    ]);
    const r = await new Agency(http).clients.transferAI(
      AG,
      ORG,
      { amount_usd: 25 },
      { idempotencyKey: "move-1" },
    );
    expect(r.agency_balance_usd).toBe(95.5);
    expect(r.workspace_balance_usd).toBe(40);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/clients/${ORG}/ai-balance`);
    expect(bodyOf(init)).toEqual({ amount_usd: 25 });
    expect(headerOf(init, "idempotency-key")).toBe("move-1");
  });
});

describe("AgencyInbox", () => {
  const thread = {
    organization_id: ORG,
    id: "msg_1",
    email_id: "mb_1",
    thread_id: "t_1",
    from_addr: ["lead@prospect.test"],
    to_addr: ["sam@acme.test"],
    subject: "Re: intro",
    snippet: "Sounds good",
    internal_date: "2026-11-14T12:00:00Z",
    seen: false,
    message_count: 3,
    has_unread: true,
  };

  it("lists conversations with filters", async () => {
    const { http, fetchMock } = clientWith([
      { body: { data: [thread], pagination: { next_cursor: null, has_more: false } } },
    ]);
    const page = await new Agency(http).inbox.list(AG, {
      client: [ORG],
      needs_reply: true,
      q: "intro",
      limit: 30,
    });
    expect(page.data[0]?.has_unread).toBe(true);
    expect(page.hasNextPage()).toBe(false);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/inbox`);
    expect(queryOf(url)).toEqual({ client: ORG, needs_reply: "true", q: "intro", limit: "30" });
  });

  it("reads a thread", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          data: [
            {
              id: "msg_1",
              email_id: "mb_1",
              thread_id: "t_1",
              from_addr: ["lead@prospect.test"],
              to_addr: ["sam@acme.test"],
              subject: "Re: intro",
              snippet: "Sounds good",
              internal_date: "2026-11-14T12:00:00Z",
              seen: true,
              message_count: 0,
              has_unread: false,
              labels: [],
            },
          ],
          pagination: { next_cursor: null, has_more: false },
        },
      },
    ]);
    const page = await new Agency(http).inbox.thread(AG, {
      organization_id: ORG,
      thread_id: "t_1",
    });
    expect(page.data[0]?.thread_id).toBe("t_1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/inbox/thread`);
    expect(queryOf(url)).toEqual({ organization_id: ORG, thread_id: "t_1" });
  });

  it("reads one message with its body", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          id: "msg_1",
          gmail_id: "",
          uid: 0,
          email_id: "mb_1",
          folder: "inbox",
          parent_id: "",
          thread_id: "t_1",
          flags: null,
          bcc: null,
          cc: null,
          date: "2026-11-14T12:00:00Z",
          from: ["lead@prospect.test"],
          in_reply_to: null,
          message_id: "<abc@prospect.test>",
          ReplyTo: null,
          to: ["sam@acme.test"],
          subject: "Re: intro",
          size: 2048,
          internal_date: "2026-11-14T12:00:00Z",
          mod_seq: 0,
          body_plain: "Sounds good",
          body_html: "<p>Sounds good</p>",
          body_truncated: false,
        },
      },
    ]);
    const msg = await new Agency(http).inbox.message(AG, "msg_1", { organization_id: ORG });
    expect(msg.body_html).toBe("<p>Sounds good</p>");
    expect(msg.ReplyTo).toBeNull();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/inbox/messages/msg_1`);
    expect(queryOf(url)).toEqual({ organization_id: ORG });
  });
});

describe("AgencyMigrations", () => {
  it("lists providers unwrapped from `data`", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          data: [
            {
              id: "instantly",
              label: "Instantly",
              fields: [{ key: "api_key", label: "API key", secret: true }],
              key_help: "Settings > Integrations > API",
              kinds: ["mailboxes", "campaigns", "leads", "blocklist"],
              workspaces: true,
              multi_key: false,
              mailbox_secrets: true,
            },
          ],
        },
      },
    ]);
    const list = await new Agency(http).migrations.providers(AG);
    expect(list[0]?.fields[0]?.secret).toBe(true);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/migrations/providers`);
  });

  it("lists migrations with limit", async () => {
    const { http, fetchMock } = clientWith([
      {
        body: {
          data: [migration],
          pagination: { total: null, next_cursor: null, has_more: false },
        },
      },
    ]);
    const page = await new Agency(http).migrations.list(AG, { limit: 10 });
    expect(page.data[0]?.inventory?.[0]?.inventory.campaign_summaries?.[0]?.leads).toBe(-1);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/migrations`);
    expect(queryOf(url)).toEqual({ limit: "10" });
  });

  it("creates a migration", async () => {
    const { http, fetchMock } = clientWith([
      { body: { ...migration, status: "scanning", inventory: [] }, status: 201 },
    ]);
    const m = await new Agency(http).migrations.create(AG, {
      provider: "instantly",
      label: "Instantly import",
      credentials: [{ api_key: "inst_x" }],
    });
    expect(m.status).toBe("scanning");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/migrations`);
    expect(bodyOf(init)).toEqual({
      provider: "instantly",
      label: "Instantly import",
      credentials: [{ api_key: "inst_x" }],
    });
  });

  it("gets a migration", async () => {
    const { http, fetchMock } = clientWith([{ body: migration }]);
    const m = await new Agency(http).migrations.get(AG, "mig_1");
    expect(m.credentials_held).toBe(true);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/migrations/mig_1`);
  });

  it("starts a migration with targets", async () => {
    const running = {
      ...migration,
      status: "running",
      options: {
        kinds: ["blocklist", "leads"],
        in_flight: "skip",
        skip_finished: true,
        warmup: false,
      },
      targets: [
        {
          id: "tgt_1",
          migration_id: "mig_1",
          workspace: { id: "wrk_1", name: "Client One" },
          organization_id: ORG,
          organization_name: "Acme",
          status: "running",
          phase: "blocklist",
          counts: {
            blocklist_imported: 12,
            mailboxes_queued: 0,
            mailboxes_manual: 0,
            campaigns_created: 0,
            campaigns_skipped: 0,
            steps_created: 0,
            leads_read: 0,
            contacts_imported: 0,
            contacts_updated: 0,
            leads_enrolled: 0,
            leads_not_enrolled: 0,
            leads_suppressed: 0,
            leads_failed: 0,
          },
          followup: {},
          updated_at: "2026-11-08T10:05:00Z",
        },
      ],
    };
    const { http, fetchMock } = clientWith([{ body: running }]);
    const body = {
      options: { kinds: ["blocklist", "leads"], in_flight: "skip", skip_finished: true },
      targets: [
        { workspace_id: "wrk_1", key: 0, organization_id: ORG },
        { workspace_id: "wrk_2", key: 0, create_name: "Beta Co" },
        { workspace_id: "wrk_3", key: 0, skip: true },
      ],
    };
    const m = await new Agency(http).migrations.start(AG, "mig_1", body);
    expect(m.targets?.[0]?.counts.blocklist_imported).toBe(12);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/migrations/mig_1/start`);
    expect(bodyOf(init)).toEqual(body);
  });

  it("cancels a migration", async () => {
    const { http, fetchMock } = clientWith([
      { body: { ...migration, status: "canceled", credentials_held: false } },
    ]);
    const m = await new Agency(http).migrations.cancel(AG, "mig_1");
    expect(m.status).toBe("canceled");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/migrations/mig_1/cancel`);
    expect(init.body).toBeUndefined();
  });

  it("links senders", async () => {
    const { http, fetchMock } = clientWith([{ body: { ...migration, status: "completed" } }]);
    const m = await new Agency(http).migrations.linkSenders(AG, "mig_1");
    expect(m.status).toBe("completed");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/migrations/mig_1/link-senders`);
  });

  it("dismisses a migration and tolerates 204", async () => {
    const { http, fetchMock } = clientWith([{ status: 204 }]);
    await expect(new Agency(http).migrations.delete(AG, "mig_1")).resolves.toBeUndefined();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(pathOf(url)).toBe(`/v1/agency/${AG}/migrations/mig_1`);
  });
});
