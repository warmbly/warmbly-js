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
