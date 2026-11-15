import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { UnprocessableEntityError } from "../core/errors";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Crm } from "./crm";

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
    resolveClientOptions({
      apiKey: "wmbly_test",
      fetch: fetchMock as unknown as FetchLike,
    }),
  );
  return { http, fetchMock };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): {
  url: string;
  init: RequestInit;
} {
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

function crm(
  body: unknown,
  init: { status?: number } = {},
): {
  client: Crm;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  const { http, fetchMock } = clientWith(body, init);
  return { client: new Crm(http), fetchMock };
}

const T = "2026-01-02T03:04:05Z";

const stage = {
  id: "st_1",
  pipeline_id: "pl_1",
  name: "Qualified",
  color: "#f59e0b",
  position: 1,
  deal_count: 2,
  created_at: T,
  updated_at: T,
  closed: false,
  probability: 0.4,
  future_field: "kept",
};

const pipeline = {
  id: "pl_1",
  organization_id: "org_1",
  name: "Sales",
  position: 0,
  stages: [stage],
  created_at: T,
  updated_at: T,
  external: { provider: "hubspot", external_id: "9", synced_at: T },
};

const deal = {
  id: "dl_1",
  organization_id: "org_1",
  pipeline_id: "pl_1",
  stage_id: "st_1",
  name: "Acme",
  value: 1000,
  currency: "USD",
  status: "open",
  created_at: T,
  updated_at: T,
  campaign_name: "Spring",
};

const task = {
  id: "tk_1",
  organization_id: "org_1",
  created_by: "u_1",
  title: "Follow up",
  priority: "high",
  type: "Call",
  status: "pending",
  due_date: T,
  created_at: T,
  updated_at: T,
};

const pagination = { total: 1, next_cursor: "cur2", has_more: true };

function body(init: RequestInit): unknown {
  return JSON.parse(String(init.body));
}

describe("Crm pipelines", () => {
  it("lists pipelines via GET, decoding a bare array", async () => {
    const { client, fetchMock } = crm([pipeline]);
    const result = await client.listPipelines();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/pipelines");
    expect(result[0]?.stages?.[0]?.color).toBe("#f59e0b");
    expect(result[0]?.external?.provider).toBe("hubspot");
  });

  it("creates a pipeline via POST with stages", async () => {
    const { client, fetchMock } = crm(pipeline);
    await client.createPipeline({
      name: "Sales",
      stages: [{ name: "New", color: "#0ea5e9" }],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/pipelines");
    expect(body(init)).toEqual({
      name: "Sales",
      stages: [{ name: "New", color: "#0ea5e9" }],
    });
  });

  it("gets a pipeline by id via GET", async () => {
    const { client, fetchMock } = crm(pipeline);
    const p = await client.getPipeline("pl_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/pipelines/pl_1");
    expect(p.name).toBe("Sales");
  });

  it("updates a pipeline via PATCH", async () => {
    const { client, fetchMock } = crm({ ...pipeline, name: "Renamed" });
    const p = await client.updatePipeline("pl_1", { name: "Renamed" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/pipelines/pl_1");
    expect(body(init)).toEqual({ name: "Renamed" });
    expect(p.name).toBe("Renamed");
  });

  it("deletes a pipeline via DELETE", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.deletePipeline("pl_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/crm/pipelines/pl_1");
  });

  it("creates a stage under a pipeline via POST", async () => {
    const { client, fetchMock } = crm(stage);
    const s = await client.createStage("pl_1", {
      name: "Qualified",
      color: "#f59e0b",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/pipelines/pl_1/stages");
    expect(body(init)).toEqual({ name: "Qualified", color: "#f59e0b" });
    expect(s.future_field).toBe("kept");
  });

  it("updates a stage via PATCH", async () => {
    const { client, fetchMock } = crm({ ...stage, color: "#10b981" });
    await client.updateStage("pl_1", "st_1", { color: "#10b981" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/pipelines/pl_1/stages/st_1");
    expect(body(init)).toEqual({ color: "#10b981" });
  });

  it("deletes a stage via DELETE", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.deleteStage("pl_1", "st_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/crm/pipelines/pl_1/stages/st_1");
  });
});

describe("Crm deals", () => {
  it("lists deals as a cursor page with the server filters", async () => {
    const { client, fetchMock } = crm({ data: [deal], pagination });
    const page = await client.listDeals({
      pipeline_id: "pl_1",
      stage_id: "st_1",
      status: "open",
      limit: 10,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/deals");
    expect(url).toContain("pipeline_id=pl_1");
    expect(url).toContain("stage_id=st_1");
    expect(url).toContain("status=open");
    expect(url).toContain("limit=10");
    expect(page.data[0]?.name).toBe("Acme");
    expect(page.hasNextPage()).toBe(true);
  });

  it("lists deals with no params", async () => {
    const { client, fetchMock } = crm({
      data: [],
      pagination: { next_cursor: null, has_more: false },
    });
    const page = await client.listDeals();
    expect(lastCall(fetchMock).init.method).toBe("GET");
    expect(page.data).toEqual([]);
  });

  it("creates a deal via POST", async () => {
    const { client, fetchMock } = crm(deal);
    await client.createDeal({
      pipeline_id: "pl_1",
      stage_id: "st_1",
      name: "Acme",
      value: 1000,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals");
    expect(body(init)).toEqual({
      pipeline_id: "pl_1",
      stage_id: "st_1",
      name: "Acme",
      value: 1000,
    });
  });

  it("searches deals via POST with the filter body and paging query", async () => {
    const { client, fetchMock } = crm({ data: [deal], pagination });
    const res = await client.searchDeals(
      { query: "acme", statuses: ["open"], min_value: 10 },
      { limit: 25, cursor: "c1" },
    );
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals/search");
    expect(url).toContain("limit=25");
    expect(url).toContain("cursor=c1");
    expect(body(init)).toEqual({
      query: "acme",
      statuses: ["open"],
      min_value: 10,
    });
    expect(res.pagination.next_cursor).toBe("cur2");
  });

  it("searches deals with an empty body by default", async () => {
    const { client, fetchMock } = crm({ data: [], pagination });
    await client.searchDeals();
    expect(body(lastCall(fetchMock).init)).toEqual({});
  });

  it("summarizes deals via POST and decodes the aggregates", async () => {
    const { client, fetchMock } = crm({
      total: 3,
      open_count: 2,
      open_value: 150.5,
      won_count: 1,
      won_value: 10,
      lost_count: 0,
      lost_value: 0,
      currency: "USD",
      stages: [{ stage_id: "st_1", count: 2, value: 150.5 }],
      mixed_currency: false,
    });
    const s = await client.dealsSummary({ pipeline_ids: ["pl_1"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals/summary");
    expect(body(init)).toEqual({ pipeline_ids: ["pl_1"] });
    expect(s.stages[0]?.count).toBe(2);
  });

  it("gets a deal by id via GET", async () => {
    const { client, fetchMock } = crm(deal);
    await client.getDeal("dl_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/deals/dl_1");
  });

  it("updates a deal via PATCH", async () => {
    const { client, fetchMock } = crm({ ...deal, status: "won" });
    const d = await client.updateDeal("dl_1", {
      stage_id: "st_2",
      status: "won",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/deals/dl_1");
    expect(body(init)).toEqual({ stage_id: "st_2", status: "won" });
    expect(d.status).toBe("won");
  });

  it("deletes a deal via DELETE", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.deleteDeal("dl_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/crm/deals/dl_1");
  });

  it("surfaces a 422 on invalid deal creation", async () => {
    const { client } = crm({ code: "unprocessable", message: "bad" }, { status: 422 });
    await expect(
      client.createDeal({ pipeline_id: "", stage_id: "", name: "" }),
    ).rejects.toBeInstanceOf(UnprocessableEntityError);
  });
});

describe("Crm task types", () => {
  const tt = {
    id: "tt_1",
    organization_id: "org_1",
    name: "Call",
    color: "#8b5cf6",
    position: 0,
    created_at: T,
    updated_at: T,
  };

  it("lists task types, unwrapping the data envelope", async () => {
    const { client, fetchMock } = crm({ data: [tt] });
    const types = await client.listTaskTypes();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/task-types");
    expect(types).toEqual([tt]);
  });

  it("creates a task type via POST", async () => {
    const { client, fetchMock } = crm(tt);
    await client.createTaskType({ name: "Call", color: "#8b5cf6" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/task-types");
    expect(body(init)).toEqual({ name: "Call", color: "#8b5cf6" });
  });

  it("updates a task type via PATCH", async () => {
    const { client, fetchMock } = crm({ ...tt, name: "Phone call" });
    await client.updateTaskType("tt_1", { name: "Phone call", position: 2 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/task-types/tt_1");
    expect(body(init)).toEqual({ name: "Phone call", position: 2 });
  });

  it("deletes a task type via DELETE", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.deleteTaskType("tt_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/crm/task-types/tt_1");
  });
});

describe("Crm tasks", () => {
  it("lists tasks as a cursor page with the server filters", async () => {
    const { client, fetchMock } = crm({ data: [task], pagination });
    const page = await client.listTasks({
      contact_id: "c_1",
      deal_id: "dl_1",
      assigned_to: "u_1",
      status: "pending",
      limit: 5,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/tasks");
    for (const q of [
      "contact_id=c_1",
      "deal_id=dl_1",
      "assigned_to=u_1",
      "status=pending",
      "limit=5",
    ]) {
      expect(url).toContain(q);
    }
    expect(page.data[0]?.type).toBe("Call");
  });

  it("creates a task via POST", async () => {
    const { client, fetchMock } = crm(task);
    await client.createTask({
      title: "Follow up",
      contact_id: "c_1",
      type: "Call",
      priority: "high",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks");
    expect(body(init)).toEqual({
      title: "Follow up",
      contact_id: "c_1",
      type: "Call",
      priority: "high",
    });
  });

  it("searches tasks via POST with the filter body and paging query", async () => {
    const { client, fetchMock } = crm({ data: [task], pagination });
    await client.searchTasks(
      { statuses: ["pending"], overdue: true, team_ids: ["tm_1"] },
      { limit: 10 },
    );
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks/search");
    expect(url).toContain("limit=10");
    expect(body(init)).toEqual({
      statuses: ["pending"],
      overdue: true,
      team_ids: ["tm_1"],
    });
  });

  it("summarizes tasks via POST and decodes counts", async () => {
    const { client, fetchMock } = crm({
      total: 9,
      pending_count: 4,
      in_progress_count: 1,
      completed_count: 3,
      cancelled_count: 1,
      overdue_count: 2,
      high_priority_count: 5,
    });
    const s = await client.tasksSummary({ assigned_to: ["u_1"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks/summary");
    expect(body(init)).toEqual({ assigned_to: ["u_1"] });
    expect(s.overdue_count).toBe(2);
  });

  it("summarizes tasks with an empty body by default", async () => {
    const { client, fetchMock } = crm({ total: 0 });
    await client.tasksSummary();
    expect(body(lastCall(fetchMock).init)).toEqual({});
  });

  it("bulk updates tasks via PATCH /crm/tasks", async () => {
    const { client, fetchMock } = crm({ affected: 2 });
    const r = await client.bulkUpdateTasks({
      tasks: ["tk_1", "tk_2"],
      status: "completed",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(new URL(url).pathname.endsWith("/crm/tasks")).toBe(true);
    expect(body(init)).toEqual({
      tasks: ["tk_1", "tk_2"],
      status: "completed",
    });
    expect(r.affected).toBe(2);
  });

  it("bulk updates a filtered selection", async () => {
    const { client, fetchMock } = crm({ affected: 40 });
    await client.bulkUpdateTasks({
      all: true,
      filters: { overdue: true },
      exclude: ["tk_9"],
      priority: "low",
    });
    expect(body(lastCall(fetchMock).init)).toEqual({
      all: true,
      filters: { overdue: true },
      exclude: ["tk_9"],
      priority: "low",
    });
  });

  it("bulk deletes tasks via DELETE with a bare id array", async () => {
    const { client, fetchMock } = crm({ affected: 2 });
    const r = await client.bulkDeleteTasks(["tk_1", "tk_2"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(new URL(url).pathname.endsWith("/crm/tasks")).toBe(true);
    expect(body(init)).toEqual(["tk_1", "tk_2"]);
    expect(r.affected).toBe(2);
  });

  it("bulk deletes tasks via DELETE with a selection object", async () => {
    const { client, fetchMock } = crm({ affected: 7 });
    await client.bulkDeleteTasks({
      all: true,
      filters: { statuses: ["cancelled"] },
    });
    expect(body(lastCall(fetchMock).init)).toEqual({
      all: true,
      filters: { statuses: ["cancelled"] },
    });
  });

  it("gets a task by id via GET", async () => {
    const { client, fetchMock } = crm(task);
    await client.getTask("tk_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/tasks/tk_1");
  });

  it("updates a task via PATCH", async () => {
    const { client, fetchMock } = crm({
      ...task,
      status: "completed",
      completed_at: T,
    });
    const t = await client.updateTask("tk_1", { status: "completed" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/tasks/tk_1");
    expect(body(init)).toEqual({ status: "completed" });
    expect(t.completed_at).toBe(T);
  });

  it("deletes a task via DELETE", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.deleteTask("tk_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/crm/tasks/tk_1");
  });
});

describe("Crm connected CRM", () => {
  const config = {
    activity: {
      sent: true,
      replies: true,
      bounces: true,
      unsubscribes: true,
      opens: false,
      clicks: false,
      meetings: true,
    },
    create_contacts: true,
    create_companies: true,
    write_properties: true,
    positive_reply: {
      lead_status: "IN_PROGRESS",
      lifecycle_stage: "",
      create_deal: false,
    },
    exit_rules: {
      deal_created: true,
      lifecycle_stages: ["customer"],
      opted_out: true,
    },
    guards: {
      skip_lifecycle_stages: [],
      skip_open_deals: true,
      skip_other_owners: false,
      skip_opted_out: true,
    },
    deal_pipelines: [],
    display_properties: [],
    field_map: { first_name: "firstname" },
    field_direction: { first_name: "both" },
    for: "hubspot",
  };
  const settings = {
    organization_id: "org_1",
    provider: "hubspot",
    connection_id: "conn_1",
    config,
    updated_at: T,
    account: {
      external_id: "1",
      name: "Acme",
      app_url: "https://app.hubspot.com/x",
      status: "active",
      health: "ok",
    },
  };
  const view = {
    provider: "hubspot",
    linked: true,
    external_id: "501",
    owner: {
      external_id: "7",
      email: "a@b.co",
      first_name: "A",
      last_name: "B",
      user_pinned: false,
      archived: false,
    },
    lifecycle_stage: { value: "lead", label: "Lead" },
    opted_out: false,
    properties: [{ name: "jobtitle", label: "Job title", value: "CEO" }],
    synced_at: T,
  };

  it("gets settings via GET", async () => {
    const { client, fetchMock } = crm(settings);
    const s = await client.getSettings();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/settings");
    expect(s.account?.name).toBe("Acme");
    expect(s.config.field_map.first_name).toBe("firstname");
  });

  it("updates settings via PUT", async () => {
    const { client, fetchMock } = crm(settings);
    await client.updateSettings({ provider: "hubspot", complete_setup: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/crm/settings");
    expect(body(init)).toEqual({ provider: "hubspot", complete_setup: true });
  });

  it("gets metadata via GET", async () => {
    const { client, fetchMock } = crm({
      lifecycle_stages: [{ value: "lead", label: "Lead" }],
      lead_statuses: [],
      task_types: [],
      properties: [
        {
          name: "jobtitle",
          label: "Job title",
          type: "string",
          group_name: "contactinformation",
          read_only: false,
        },
      ],
      pipelines: [{ value: "p1", label: "Sales" }],
    });
    const m = await client.getMetadata();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/metadata");
    expect(m.properties[0]?.group_name).toBe("contactinformation");
  });

  it("lists owners, unwrapping the data envelope", async () => {
    const owner = {
      external_id: "7",
      email: "a@b.co",
      first_name: "A",
      last_name: "B",
      user_id: "u_1",
      user_pinned: true,
      archived: false,
    };
    const { client, fetchMock } = crm({ data: [owner] });
    const owners = await client.listOwners();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/owners");
    expect(owners).toEqual([owner]);
  });

  it("maps an owner via PUT and accepts 204", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.mapOwner("7", "u_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toContain("/crm/owners/7");
    expect(body(init)).toEqual({ user_id: "u_1" });
  });

  it("clears an owner match with a null user id", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.mapOwner("7", null);
    expect(body(lastCall(fetchMock).init)).toEqual({ user_id: null });
  });

  it("gets sync health via GET", async () => {
    const { client, fetchMock } = crm({
      pending: 1,
      failed: 1,
      done_24h: 40,
      last_synced_at: T,
      cursors: [{ object_type: "deal", cursor_at: T, last_run_at: T }],
      failures: [
        {
          id: "job_1",
          organization_id: "org_1",
          provider: "hubspot",
          kind: "push_deal",
          subject: "dl_1",
          status: "failed",
          attempts: 5,
          next_attempt_at: T,
          last_error: "boom",
          created_at: T,
          updated_at: T,
        },
      ],
      counts: { contacts: 10, deals: 2, tasks: 3, pipelines: 1, owners: 4 },
    });
    const h = await client.getSyncHealth();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/sync");
    expect(h.failures[0]?.last_error).toBe("boom");
    expect(h.counts.owners).toBe(4);
  });

  it("starts a sync via POST and accepts 202 with no body", async () => {
    const { client, fetchMock } = crm(undefined, { status: 202 });
    await expect(client.syncNow()).resolves.toBeUndefined();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(new URL(url).pathname.endsWith("/crm/sync")).toBe(true);
  });

  it("retries sync failures via POST", async () => {
    const { client, fetchMock } = crm({ affected: 2 });
    const r = await client.retrySyncFailures({ ids: ["job_1", "job_2"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/sync/retry");
    expect(body(init)).toEqual({ ids: ["job_1", "job_2"] });
    expect(r.affected).toBe(2);
  });

  it("retries every failure with an empty body", async () => {
    const { client, fetchMock } = crm({ affected: 5 });
    await client.retrySyncFailures();
    expect(body(lastCall(fetchMock).init)).toEqual({});
  });

  it("discards sync failures via POST", async () => {
    const { client, fetchMock } = crm({ affected: 1 });
    const r = await client.discardSyncFailures({ ids: ["job_1"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/sync/discard");
    expect(body(init)).toEqual({ ids: ["job_1"] });
    expect(r.affected).toBe(1);
  });

  it("gets the backfill preview via GET", async () => {
    const { client, fetchMock } = crm({ deals: 5, tasks: 6, notes: 7 });
    const p = await client.getBackfill();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/backfill");
    expect(p.notes).toBe(7);
  });

  it("starts a backfill via POST and accepts 202", async () => {
    const { client, fetchMock } = crm(undefined, { status: 202 });
    await client.startBackfill({ deals: true, tasks: false, notes: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/backfill");
    expect(body(init)).toEqual({ deals: true, tasks: false, notes: true });
  });

  it("gets a contact's provider view via GET", async () => {
    const { client, fetchMock } = crm(view);
    const v = await client.getContact("c_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/contacts/c_1");
    expect(v.lifecycle_stage?.label).toBe("Lead");
    expect(v.properties[0]?.value).toBe("CEO");
  });

  it("updates a contact's provider record via PATCH", async () => {
    const { client, fetchMock } = crm(view);
    await client.updateContact("c_1", {
      owner_external_id: "7",
      lead_status: "NEW",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/contacts/c_1");
    expect(body(init)).toEqual({ owner_external_id: "7", lead_status: "NEW" });
  });

  it("links a contact via POST", async () => {
    const { client, fetchMock } = crm(view);
    const v = await client.linkContact("c_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/contacts/c_1/link");
    expect(v.linked).toBe(true);
  });

  it("refreshes a contact via POST", async () => {
    const { client, fetchMock } = crm(view);
    await client.refreshContact("c_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/contacts/c_1/refresh");
  });

  it("lists provider lists as a cursor page", async () => {
    const { client, fetchMock } = crm({
      data: [
        {
          external_id: "42",
          name: "Customers",
          size: 120,
          dynamic: true,
          updated_at: "2026-01-01",
        },
      ],
      pagination: { total: null, next_cursor: "n", has_more: true },
    });
    const page = await client.listLists({ q: "cust", limit: 25 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/lists");
    expect(url).toContain("q=cust");
    expect(url).toContain("limit=25");
    expect(page.data[0]?.dynamic).toBe(true);
  });

  const importPreview = {
    list_name: "Customers",
    total: 120,
    included: 100,
    skipped: [{ reason: "opted_out", label: "Opted out", count: 20 }],
    sample: [{ email: "a@b.co", first_name: "A", last_name: "B", company: "Acme" }],
    truncated: false,
  };

  it("previews a list import via POST", async () => {
    const { client, fetchMock } = crm(importPreview);
    const p = await client.previewListImport({
      list_id: "42",
      apply_guards: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/lists/preview");
    expect(body(init)).toEqual({ list_id: "42", apply_guards: true });
    expect(p.skipped[0]?.count).toBe(20);
  });

  it("imports a list via POST", async () => {
    const { client, fetchMock } = crm(
      { import_id: "imp_1", preview: importPreview },
      { status: 201 },
    );
    const r = await client.importList({ list_id: "42" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/lists/import");
    expect(body(init)).toEqual({ list_id: "42" });
    expect(r.import_id).toBe("imp_1");
    expect(r.preview.included).toBe(100);
  });
});
