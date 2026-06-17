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
  it("lists deals via GET", async () => {
    const { client, fetchMock } = crm([{ id: "dl_1" }]);
    await client.listDeals();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/deals");
  });

  it("lists deals with query params", async () => {
    const { client, fetchMock } = crm([]);
    await client.listDeals({ pipeline_id: "pl_1" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("pipeline_id=pl_1");
  });

  it("creates a deal via POST with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "dl_1" });
    await client.createDeal({ pipeline_id: "pl_1", value: 1000 });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals");
    expect(JSON.parse(String(init.body))).toEqual({ pipeline_id: "pl_1", value: 1000 });
  });

  it("searches deals via POST", async () => {
    const { client, fetchMock } = crm({ data: [] });
    await client.searchDeals({ query: "acme" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/deals/search");
    expect(JSON.parse(String(init.body))).toEqual({ query: "acme" });
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
  it("lists task types via GET", async () => {
    const { client, fetchMock } = crm([{ id: "tt_1" }]);
    await client.listTaskTypes();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/task-types");
  });

  it("lists task types with query params", async () => {
    const { client, fetchMock } = crm([]);
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
  it("lists tasks via GET", async () => {
    const { client, fetchMock } = crm([{ id: "tk_1" }]);
    await client.listTasks();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/crm/tasks");
  });

  it("lists tasks with query params", async () => {
    const { client, fetchMock } = crm([]);
    await client.listTasks({ completed: false });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("completed=false");
  });

  it("creates a task via POST with a JSON body", async () => {
    const { client, fetchMock } = crm({ id: "tk_1" });
    await client.createTask({ task_type_id: "tt_1", contact_id: "c_1" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks");
    expect(JSON.parse(String(init.body))).toEqual({ task_type_id: "tt_1", contact_id: "c_1" });
  });

  it("searches tasks via POST", async () => {
    const { client, fetchMock } = crm({ data: [] });
    await client.searchTasks({ completed: false });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks/search");
    expect(JSON.parse(String(init.body))).toEqual({ completed: false });
  });

  it("summarizes tasks via POST with params", async () => {
    const { client, fetchMock } = crm({ total: 0 });
    await client.tasksSummary({ owner: "rep@warmbly.com" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/crm/tasks/summary");
    expect(JSON.parse(String(init.body))).toEqual({ owner: "rep@warmbly.com" });
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
    const { client, fetchMock } = crm({ id: "tk_1", completed: true });
    await client.updateTask("tk_1", { completed: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/crm/tasks/tk_1");
    expect(JSON.parse(String(init.body))).toEqual({ completed: true });
  });

  it("deletes a task via DELETE", async () => {
    const { client, fetchMock } = crm(undefined, { status: 204 });
    await client.deleteTask("tk_1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/crm/tasks/tk_1");
  });
});
