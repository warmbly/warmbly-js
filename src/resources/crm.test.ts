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
    resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
  );
  return { http, fetchMock };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
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

describe("Crm pipelines", () => {
  it("lists pipelines via GET", async () => {
    const { client, fetchMock } = crm([{ id: "pl_1" }]);
    const result = await client.listPipelines();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/pipelines");
    expect(result).toEqual([{ id: "pl_1" }]);
  });

  it("lists pipelines with query params", async () => {
    const { client, fetchMock } = crm([]);
    await client.listPipelines({ limit: 10 });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/crm/pipelines");
    expect(url).toContain("limit=10");
  });

  it("creates a pipeline via POST with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "pl_1", name: "Sales" });
    await client.createPipeline({ name: "Sales" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/pipelines");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Sales" });
  });

  it("gets a pipeline by id via GET", async () => {
    const { client, fetchMock } = crm({ id: "pl_1" });
    await client.getPipeline("pl_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/pipelines/pl_1");
  });

  it("updates a pipeline via PATCH with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "pl_1", name: "Renamed" });
    await client.updatePipeline("pl_1", { name: "Renamed" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/pipelines/pl_1");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Renamed" });
  });

  it("deletes a pipeline via DELETE", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.deletePipeline("pl_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/crm/pipelines/pl_1");
  });

  it("creates a stage under a pipeline via POST", async () => {
    const { client, fetchMock } = crm({ id: "st_1", name: "Qualified" });
    await client.createStage("pl_1", { name: "Qualified" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/pipelines/pl_1/stages");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Qualified" });
  });

  it("updates a stage via PATCH with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "st_1", position: 2 });
    await client.updateStage("pl_1", "st_1", { position: 2 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/pipelines/pl_1/stages/st_1");
    expect(JSON.parse(String(init.body))).toEqual({ position: 2 });
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
  it("lists deals via GET and decodes the data + pagination envelope", async () => {
    const { client, fetchMock } = crm({
      data: [
        {
          id: "dl_1",
          organization_id: "org_1",
          pipeline_id: "pl_1",
          stage_id: "st_1",
          name: "Acme rollout",
          value: 5000,
          currency: "USD",
          status: "open",
          created_at: "2026-09-01T10:00:00Z",
          updated_at: "2026-09-02T10:00:00Z",
        },
      ],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await client.listDeals();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/deals");
    expect(page.data[0]?.name).toBe("Acme rollout");
    expect(page.data[0]?.status).toBe("open");
  });

  it("lists deals with query params and follows the cursor", async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => {
      n += 1;
      const body =
        n === 1
          ? { data: [{ id: "dl_1" }], pagination: { next_cursor: "cur2", has_more: true } }
          : { data: [{ id: "dl_2" }], pagination: { next_cursor: null, has_more: false } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new Crm(
      new HttpClient(
        resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
      ),
    );
    const page = await client.listDeals({ pipeline_id: "pl_1", status: "open", limit: 1 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("pipeline_id=pl_1");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("status=open");
    const ids = (await page.toArray()).map((d) => d.id);
    expect(ids).toEqual(["dl_1", "dl_2"]);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=cur2");
  });

  it("creates a deal via POST with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "dl_1" });
    await client.createDeal({ pipeline_id: "pl_1", value: 1000 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals");
    expect(JSON.parse(String(init.body))).toEqual({ pipeline_id: "pl_1", value: 1000 });
  });

  it("searches deals via POST with filters in the body and paging in the query", async () => {
    const { client, fetchMock } = crm({
      data: [{ id: "dl_1", name: "Acme rollout" }],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await client.searchDeals({ query: "acme" }, { limit: 25, cursor: "c1" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals/search");
    expect(url).toContain("limit=25");
    expect(url).toContain("cursor=c1");
    expect(JSON.parse(String(init.body))).toEqual({ query: "acme" });
    expect(page.data[0]?.id).toBe("dl_1");
  });

  it("summarizes deals via POST", async () => {
    const { client, fetchMock } = crm({ total: 0 });
    await client.dealsSummary({ pipeline_id: "pl_1" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals/summary");
    expect(JSON.parse(String(init.body))).toEqual({ pipeline_id: "pl_1" });
  });

  it("summarizes deals via POST with no params", async () => {
    const { client, fetchMock } = crm({ total: 0 });
    await client.dealsSummary();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals/summary");
  });

  it("gets a deal by id via GET", async () => {
    const { client, fetchMock } = crm({ id: "dl_1" });
    await client.getDeal("dl_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/deals/dl_1");
  });

  it("updates a deal via PATCH with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "dl_1" });
    await client.updateDeal("dl_1", { stage_id: "st_2" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/deals/dl_1");
    expect(JSON.parse(String(init.body))).toEqual({ stage_id: "st_2" });
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
    await expect(client.createDeal({})).rejects.toBeInstanceOf(UnprocessableEntityError);
  });
});

describe("Crm task types", () => {
  it("lists task types via GET and unwraps the data envelope", async () => {
    const { client, fetchMock } = crm({
      data: [{ id: "tt_1", name: "Call", color: "#8b5cf6", position: 0 }],
    });
    const types = await client.listTaskTypes();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/task-types");
    expect(types[0]?.name).toBe("Call");
  });

  it("lists task types with query params", async () => {
    const { client, fetchMock } = crm({ data: [] });
    await client.listTaskTypes({ limit: 5 });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("limit=5");
  });

  it("creates a task type via POST with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "tt_1", name: "Call" });
    await client.createTaskType({ name: "Call" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/task-types");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Call" });
  });

  it("updates a task type via PATCH with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "tt_1", name: "Phone call" });
    await client.updateTaskType("tt_1", { name: "Phone call" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/task-types/tt_1");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Phone call" });
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
  it("lists tasks via GET and decodes the data + pagination envelope", async () => {
    const { client, fetchMock } = crm({
      data: [
        {
          id: "tk_1",
          organization_id: "org_1",
          contact_id: "c_1",
          created_by: "u_1",
          title: "Call back",
          due_date: "2026-10-05T09:00:00Z",
          priority: "high",
          type: "Call",
          status: "pending",
          created_at: "2026-10-01T10:00:00Z",
          updated_at: "2026-10-01T10:00:00Z",
        },
      ],
      pagination: { total: 1, next_cursor: null, has_more: false },
    });
    const page = await client.listTasks({ status: "pending", contact_id: "c_1", limit: 10 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/tasks");
    expect(url).toContain("status=pending");
    expect(url).toContain("contact_id=c_1");
    expect(url).toContain("limit=10");
    expect(page.data[0]?.title).toBe("Call back");
    expect(page.data[0]?.priority).toBe("high");
  });

  it("creates a task via POST with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "tk_1", title: "Call back", status: "pending" });
    const task = await client.createTask({ title: "Call back", type: "Call", contact_id: "c_1" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks");
    expect(JSON.parse(String(init.body))).toEqual({
      title: "Call back",
      type: "Call",
      contact_id: "c_1",
    });
    expect(task.status).toBe("pending");
  });

  it("searches tasks via POST with filters in the body and paging in the query", async () => {
    const { client, fetchMock } = crm({
      data: [{ id: "tk_1", title: "Call back" }],
      pagination: { total: 1, next_cursor: "o50", has_more: true },
    });
    const page = await client.searchTasks({ statuses: ["pending"], overdue: true }, { limit: 50 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks/search");
    expect(url).toContain("limit=50");
    expect(JSON.parse(String(init.body))).toEqual({ statuses: ["pending"], overdue: true });
    expect(page.hasNextPage()).toBe(true);
  });

  it("bulkUpdateTasks PATCHes /crm/tasks with the selection and fields, and decodes the count", async () => {
    const { client, fetchMock } = crm({ affected: 2 });
    const out = await client.bulkUpdateTasks({
      all: true,
      filters: { overdue: true },
      exclude: ["tk_9"],
      status: "completed",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/crm\/tasks$/);
    expect(JSON.parse(String(init.body))).toEqual({
      all: true,
      filters: { overdue: true },
      exclude: ["tk_9"],
      status: "completed",
    });
    expect(out.affected).toBe(2);
  });

  it("bulkDeleteTasks DELETEs /crm/tasks with a bare id array", async () => {
    const { client, fetchMock } = crm({ affected: 2 });
    const out = await client.bulkDeleteTasks(["tk_1", "tk_2"]);
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toMatch(/\/crm\/tasks$/);
    expect(JSON.parse(String(init.body))).toEqual(["tk_1", "tk_2"]);
    expect(out.affected).toBe(2);
  });

  it("bulkDeleteTasks DELETEs /crm/tasks with a selection object", async () => {
    const { client, fetchMock } = crm({ affected: 40 });
    await client.bulkDeleteTasks({ all: true, filters: { statuses: ["cancelled"] } });
    const { init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(String(init.body))).toEqual({
      all: true,
      filters: { statuses: ["cancelled"] },
    });
  });

  it("summarizes tasks via POST with params", async () => {
    const { client, fetchMock } = crm({ total: 0 });
    await client.tasksSummary({ assigned_to: ["u_1"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks/summary");
    expect(JSON.parse(String(init.body))).toEqual({ assigned_to: ["u_1"] });
  });

  it("summarizes tasks via POST with no params", async () => {
    const { client, fetchMock } = crm({ total: 0 });
    await client.tasksSummary();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks/summary");
  });

  it("gets a task by id via GET", async () => {
    const { client, fetchMock } = crm({ id: "tk_1" });
    await client.getTask("tk_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/tasks/tk_1");
  });

  it("updates a task via PATCH with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "tk_1", status: "completed" });
    await client.updateTask("tk_1", { status: "completed" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/tasks/tk_1");
    expect(JSON.parse(String(init.body))).toEqual({ status: "completed" });
  });

  it("deletes a task via DELETE", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.deleteTask("tk_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/crm/tasks/tk_1");
  });
});

describe("Crm sync with a connected CRM", () => {
  const view = {
    provider: "hubspot",
    linked: true,
    external_id: "901",
    url: "https://app.hubspot.com/contacts/1/record/0-1/901",
    owner: {
      external_id: "77",
      email: "bo@acme.com",
      first_name: "Bo",
      last_name: "Ray",
      user_id: "user_1",
      user_pinned: false,
      archived: false,
    },
    lifecycle_stage: { value: "lead", label: "Lead" },
    lead_status: { value: "IN_PROGRESS", label: "In progress" },
    company: { external_id: "55", name: "Acme", domain: "acme.com" },
    opted_out: false,
    properties: [{ name: "jobtitle", label: "Job title", value: "CTO" }],
    synced_at: "2026-10-08T09:00:00Z",
  };

  function body(fetchMock: ReturnType<typeof vi.fn>): unknown {
    const raw = lastCall(fetchMock).init.body;
    return typeof raw === "string" ? JSON.parse(raw) : undefined;
  }

  it("getSettings GETs /crm/settings and decodes the mode and account", async () => {
    const { client, fetchMock } = crm({
      organization_id: "org_1",
      provider: "pipedrive",
      connection_id: "conn_1",
      config: {
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
        positive_reply: { lead_status: "", lifecycle_stage: "", create_deal: false },
        exit_rules: { deal_created: true, lifecycle_stages: [], opted_out: true },
        guards: {
          skip_lifecycle_stages: [],
          skip_open_deals: true,
          skip_other_owners: false,
          skip_opted_out: true,
        },
        deal_pipelines: [],
        display_properties: [],
        field_map: { first_name: "first_name" },
        field_direction: { first_name: "both" },
        for: "pipedrive",
      },
      updated_at: "2026-10-08T09:00:00Z",
      account: {
        external_id: "123",
        name: "Acme",
        app_url: "https://acme.pipedrive.com",
        status: "active",
        health: "healthy",
        missing_scopes: ["deals:full"],
      },
    });
    const out = await client.getSettings();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(new URL(url).pathname).toBe("/v1/crm/settings");
    expect(out.provider).toBe("pipedrive");
    expect(out.config.field_direction.first_name).toBe("both");
    expect(out.account?.missing_scopes).toEqual(["deals:full"]);
  });

  it("updateSettings PUTs the body", async () => {
    const { client, fetchMock } = crm({
      organization_id: "org_1",
      provider: "hubspot",
      config: {},
      updated_at: "t",
    });
    const out = await client.updateSettings({
      provider: "hubspot",
      connection_id: "conn_1",
      complete_setup: true,
    });
    expect(lastCall(fetchMock).init.method).toBe("PUT");
    expect(lastCall(fetchMock).url).toContain("/crm/settings");
    expect(body(fetchMock)).toEqual({
      provider: "hubspot",
      connection_id: "conn_1",
      complete_setup: true,
    });
    expect(out.provider).toBe("hubspot");
  });

  it("metadata GETs /crm/metadata", async () => {
    const { client, fetchMock } = crm({
      lifecycle_stages: [{ value: "lead", label: "Lead" }],
      lead_statuses: [],
      task_types: [{ value: "CALL", label: "Call" }],
      properties: [
        { name: "jobtitle", label: "Job title", type: "string", group_name: "x", read_only: false },
      ],
      pipelines: [{ value: "default", label: "Sales" }],
    });
    const out = await client.metadata();
    expect(lastCall(fetchMock).init.method).toBe("GET");
    expect(lastCall(fetchMock).url).toContain("/crm/metadata");
    expect(out.properties[0]?.name).toBe("jobtitle");
  });

  it("listOwners unwraps data", async () => {
    const { client, fetchMock } = crm({ data: [view.owner] });
    const owners = await client.listOwners();
    expect(lastCall(fetchMock).url).toContain("/crm/owners");
    expect(owners[0]?.external_id).toBe("77");
  });

  it("mapOwner PUTs user_id (null clears) and resolves void on 204", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await expect(client.mapOwner("77", null)).resolves.toBeUndefined();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(new URL(url).pathname).toBe("/v1/crm/owners/77");
    expect(body(fetchMock)).toEqual({ user_id: null });
  });

  it("syncHealth GETs /crm/sync", async () => {
    const { client, fetchMock } = crm({
      pending: 3,
      failed: 1,
      done_24h: 120,
      last_synced_at: "2026-10-08T09:00:00Z",
      cursors: [{ object_type: "deal", cursor_at: "2026-10-08T08:59:00Z" }],
      failures: [
        {
          id: "job_1",
          organization_id: "org_1",
          provider: "hubspot",
          kind: "push_deal",
          subject: "Acme rollout",
          status: "failed",
          attempts: 5,
          next_attempt_at: "t",
          last_error: "HubSpot refused",
          created_at: "t",
          updated_at: "t",
        },
      ],
      counts: { contacts: 900, deals: 40, tasks: 12, pipelines: 2, owners: 5 },
    });
    const out = await client.syncHealth();
    expect(lastCall(fetchMock).init.method).toBe("GET");
    expect(new URL(lastCall(fetchMock).url).pathname).toBe("/v1/crm/sync");
    expect(out.failures[0]?.kind).toBe("push_deal");
    expect(out.counts.contacts).toBe(900);
  });

  it("syncNow POSTs /crm/sync and resolves void on 202", async () => {
    const { client, fetchMock } = crm(undefined, { status: 202 });
    await expect(client.syncNow()).resolves.toBeUndefined();
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(new URL(lastCall(fetchMock).url).pathname).toBe("/v1/crm/sync");
  });

  it("retrySyncFailures and discardSyncFailures POST ids, or an empty body for all", async () => {
    const { client, fetchMock } = crm({ affected: 2 });
    expect(await client.retrySyncFailures(["job_1", "job_2"])).toEqual({ affected: 2 });
    expect(lastCall(fetchMock).url).toContain("/crm/sync/retry");
    expect(body(fetchMock)).toEqual({ ids: ["job_1", "job_2"] });
    await client.discardSyncFailures();
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(lastCall(fetchMock).url).toContain("/crm/sync/discard");
    expect(body(fetchMock)).toEqual({});
  });

  it("backfillPreview GETs and startBackfill POSTs with an idempotency key", async () => {
    const { client, fetchMock } = crm({ deals: 4, tasks: 9, notes: 30 });
    const preview = await client.backfillPreview();
    expect(lastCall(fetchMock).init.method).toBe("GET");
    expect(lastCall(fetchMock).url).toContain("/crm/backfill");
    expect(preview.notes).toBe(30);

    const accepted = crm(undefined, { status: 202 });
    await expect(
      accepted.client.startBackfill({ deals: true, notes: true }, { idempotencyKey: "bf-1" }),
    ).resolves.toBeUndefined();
    const call = lastCall(accepted.fetchMock);
    expect(call.init.method).toBe("POST");
    expect(call.url).toContain("/crm/backfill");
    expect((call.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("bf-1");
    expect(body(accepted.fetchMock)).toEqual({ deals: true, notes: true });
  });

  it("getContactRecord, refreshContactRecord and linkContactRecord hit the contact routes", async () => {
    const { client, fetchMock } = crm(view);
    const got = await client.getContactRecord("c_1");
    expect(lastCall(fetchMock).init.method).toBe("GET");
    expect(new URL(lastCall(fetchMock).url).pathname).toBe("/v1/crm/contacts/c_1");
    expect(got.lifecycle_stage?.label).toBe("Lead");
    expect(got.properties[0]?.value).toBe("CTO");

    await client.refreshContactRecord("c_1");
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(new URL(lastCall(fetchMock).url).pathname).toBe("/v1/crm/contacts/c_1/refresh");

    const linked = await client.linkContactRecord("c_1", { idempotencyKey: "link-1" });
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(new URL(lastCall(fetchMock).url).pathname).toBe("/v1/crm/contacts/c_1/link");
    expect((lastCall(fetchMock).init.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "link-1",
    );
    expect(linked.linked).toBe(true);
  });

  it("updateContactRecord PATCHes the sales fields", async () => {
    const { client, fetchMock } = crm({ ...view, lifecycle_stage: { value: "sql", label: "SQL" } });
    const out = await client.updateContactRecord("c_1", { lifecycle_stage: "sql" });
    expect(lastCall(fetchMock).init.method).toBe("PATCH");
    expect(new URL(lastCall(fetchMock).url).pathname).toBe("/v1/crm/contacts/c_1");
    expect(body(fetchMock)).toEqual({ lifecycle_stage: "sql" });
    expect(out.lifecycle_stage?.value).toBe("sql");
  });

  it("listLists returns a Page and passes q and limit", async () => {
    const { client, fetchMock } = crm({
      data: [{ external_id: "42", name: "Webinar", size: 120, dynamic: false }],
      pagination: { next_cursor: null, has_more: false },
    });
    const page = await client.listLists({ q: "web", limit: 10 });
    const url = new URL(lastCall(fetchMock).url);
    expect(lastCall(fetchMock).init.method).toBe("GET");
    expect(url.pathname).toBe("/v1/crm/lists");
    expect(url.searchParams.get("q")).toBe("web");
    expect(url.searchParams.get("limit")).toBe("10");
    expect((await page.toArray())[0]?.size).toBe(120);
  });

  it("previewListImport and importList POST the list id", async () => {
    const preview = {
      list_name: "Webinar",
      total: 120,
      included: 100,
      skipped: [{ reason: "opted_out", label: "Opted out", count: 20 }],
      sample: [{ email: "ana@example.com", first_name: "Ana", last_name: "D", company: "Acme" }],
      truncated: false,
    };
    const { client, fetchMock } = crm(preview);
    const out = await client.previewListImport({ list_id: "42", apply_guards: true });
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(lastCall(fetchMock).url).toContain("/crm/lists/preview");
    expect(body(fetchMock)).toEqual({ list_id: "42", apply_guards: true });
    expect(out.skipped[0]?.count).toBe(20);

    const created = crm({ import_id: "imp_1", preview }, { status: 201 });
    const result = await created.client.importList(
      { list_id: "42" },
      { idempotencyKey: "crm-list-42" },
    );
    const call = lastCall(created.fetchMock);
    expect(call.init.method).toBe("POST");
    expect(call.url).toContain("/crm/lists/import");
    expect((call.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("crm-list-42");
    expect(result.import_id).toBe("imp_1");
  });

  it("decodes provider refs on deals and stage metadata", async () => {
    const { client } = crm({
      id: "dl_1",
      name: "Acme rollout",
      stage: { id: "st_1", name: "Won", closed: true, won: true, probability: 1 },
      external: {
        provider: "hubspot",
        external_id: "9001",
        url: "https://app.hubspot.com/deal/9001",
        synced_at: "2026-10-08T09:00:00Z",
        owner_name: "Bo Ray",
      },
    });
    const deal = await client.getDeal("dl_1");
    expect(deal.external?.provider).toBe("hubspot");
    expect(deal.stage?.won).toBe(true);
  });
});
