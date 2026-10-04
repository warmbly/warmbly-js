import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Contacts } from "./contacts";

// Returns a queued sequence of canned responses, one per fetch call.
function clientWithSequence(responses: Array<{ body: unknown; status?: number }>): {
  http: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  let i = 0;
  const fetchMock = vi.fn(async () => {
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const status = next?.status ?? 200;
    // 204 must have a null body, so only attach a JSON body for other statuses.
    const payload = status === 204 ? null : JSON.stringify(next?.body);
    return new Response(payload, {
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

describe("Contacts", () => {
  it("searches via POST and follows the cursor when iterating", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          data: [{ id: "c1", email: "team@warmbly.com" }],
          pagination: { total: 2, next_cursor: "cur2", has_more: true },
        },
      },
      {
        body: {
          data: [{ id: "c2", email: "casey@warmbly.com" }],
          pagination: { total: 2, next_cursor: null, has_more: false },
        },
      },
    ]);
    const page = await new Contacts(http).search({ query: "x.com" });
    const all = await page.toArray();
    expect(all.map((c) => c.id)).toEqual(["c1", "c2"]);

    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("POST");
    expect(first.url).toContain("/contacts/search");
    expect(JSON.parse(String(first.init.body))).toEqual({ query: "x.com" });

    // The platform reads the cursor from the query string, never the body.
    expect(first.url).not.toContain("cursor=");
    const second = callAt(fetchMock, 1);
    expect(second.url).toContain("cursor=cur2");
    expect(JSON.parse(String(second.init.body))).toEqual({ query: "x.com" });
  });

  it("searches with no params, sending an empty body", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: { data: [], pagination: { total: 0, next_cursor: null, has_more: false } },
      },
    ]);
    const page = await new Contacts(http).search();
    expect(page.data).toEqual([]);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/search");
    expect(JSON.parse(String(init.body))).toEqual({});
  });

  it("list() is an alias that also searches via POST and paginates", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          data: [{ id: "c1", email: "team@warmbly.com" }],
          pagination: { total: 2, next_cursor: "cur9", has_more: true },
        },
      },
      {
        body: {
          data: [{ id: "c2", email: "morgan@warmbly.com" }],
          pagination: { total: 2, next_cursor: null, has_more: false },
        },
      },
    ]);
    const page = await new Contacts(http).list({ limit: 25, query: "ceo" });
    const ids: string[] = [];
    for await (const c of page) ids.push(c.id);
    expect(ids).toEqual(["c1", "c2"]);

    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("POST");
    expect(first.url).toContain("/contacts/search");
    // limit and cursor are query parameters; only the filters are the body.
    expect(first.url).toContain("limit=25");
    expect(JSON.parse(String(first.init.body))).toEqual({ query: "ceo" });
    const second = callAt(fetchMock, 1);
    expect(second.url).toContain("limit=25");
    expect(second.url).toContain("cursor=cur9");
    expect(JSON.parse(String(second.init.body))).toEqual({ query: "ceo" });
  });

  it("add() sends the bare array, which is what the platform decodes", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { created: 1 } }]);
    const result = await new Contacts(http).add([{ email: "team@warmbly.com" }]);
    expect(result).toEqual({ created: 1 });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts");
    expect(JSON.parse(String(init.body))).toEqual([{ email: "team@warmbly.com" }]);
  });

  it("bulkUpdate() PATCHes /contacts with the selection and the edits", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { updated: 3 } }]);
    const result = await new Contacts(http).bulkUpdate({
      all: true,
      filters: { subscribed: false },
      exclude: ["c_9"],
      add_categories: ["cat_1"],
    });
    expect(result).toEqual({ updated: 3 });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/contacts$/);
    expect(JSON.parse(String(init.body))).toEqual({
      all: true,
      filters: { subscribed: false },
      exclude: ["c_9"],
      add_categories: ["cat_1"],
    });
  });

  it("bulkDelete() DELETEs /contacts with a bare id array and treats the 204 as no body", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: undefined, status: 204 }]);
    await expect(new Contacts(http).bulkDelete(["c_1", "c_2"])).resolves.toBeUndefined();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(url).toMatch(/\/contacts$/);
    expect(JSON.parse(String(init.body))).toEqual(["c_1", "c_2"]);
  });

  it("bulkDelete() accepts the selection object", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: undefined, status: 204 }]);
    await new Contacts(http).bulkDelete({ all: true, filters: { verification_status: "invalid" } });
    expect(JSON.parse(String(callAt(fetchMock, 0).init.body))).toEqual({
      all: true,
      filters: { verification_status: "invalid" },
    });
  });

  it("export() POSTs the request and returns the CSV text", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("email,first_name\nteam@warmbly.com,Sam\n", {
          status: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="contacts.csv"',
          },
        }),
    );
    const http = new HttpClient(
      resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
    );
    const result = await new Contacts(http).export({ format: "csv", scope: "all" });
    expect(result).toBe("email,first_name\nteam@warmbly.com,Sam\n");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/export");
    expect(JSON.parse(String(init.body))).toEqual({ format: "csv", scope: "all" });
  });

  it("export() works without params", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: [{ email: "team@warmbly.com" }] }]);
    const result = await new Contacts(http).export();
    expect(result).toEqual([{ email: "team@warmbly.com" }]);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/export");
    // No body when params are undefined.
    expect(init.body).toBeUndefined();
  });

  it("importPreview() uploads the file as multipart and decodes the preview", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          filename: "leads.csv",
          format: "csv",
          total_rows: 2,
          columns: ["Email", "Name"],
          has_header: true,
          sample_rows: [["team@warmbly.com", "Sam"]],
          suggested_mapping: [
            { index: 0, target: "email" },
            { index: 1, target: "first_name" },
          ],
          inferred_columns: [1],
          mapping_source: "saved",
        },
      },
    ]);
    const file = new Blob(["Email,Name\nteam@warmbly.com,Sam\n"], { type: "text/csv" });
    const result = await new Contacts(http).importPreview(file, { filename: "leads.csv" });
    expect(result.total_rows).toBe(2);
    expect(result.suggested_mapping[1]?.target).toBe("first_name");
    expect(result.mapping_source).toBe("saved");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/import/preview");
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get("file") as File).name).toBe("leads.csv");
  });

  it("importCommit() uploads the file with the options as a JSON form field", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          total: 10,
          imported: 8,
          updated: 1,
          skipped: 0,
          failed: 1,
          started_at: "2026-10-04T09:00:00Z",
          ended_at: "2026-10-04T09:00:01Z",
          errors: [{ line: 4, email: "nope", reason: "invalid email" }],
          segments_pinned: true,
          quality: {
            malformed: 1,
            disposable: 0,
            role: 2,
            bad_share_pct: 10,
            flagged: false,
          },
        },
      },
    ]);
    const options = {
      mapping: [{ index: 0, target: "email" }],
      has_header: true,
      dedup: "update" as const,
      segment_ids: ["seg_1"],
    };
    const result = await new Contacts(http).importCommit(new Blob(["a"]), options, {
      filename: "leads.csv",
    });
    expect(result.imported).toBe(8);
    expect(result.errors?.[0]?.line).toBe(4);
    expect(result.quality?.role).toBe(2);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/import/commit");
    const form = init.body as FormData;
    expect(JSON.parse(String(form.get("options")))).toEqual(options);
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("lookup() GETs /contacts/lookup and decodes a match", async () => {
    const { http, fetchMock } = clientWithSequence([
      { body: { contact: { id: "c_1", email: "team@warmbly.com" }, match: "thread" } },
    ]);
    const result = await new Contacts(http).lookup({
      email: "Sam <team@warmbly.com>",
      thread_id: "th_1",
      account_id: "mb_1",
    });
    expect(result.contact?.id).toBe("c_1");
    expect(result.match).toBe("thread");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/lookup");
    expect(url).toContain("email=Sam%20%3Cteam%40warmbly.com%3E");
    expect(url).toContain("thread_id=th_1");
    expect(url).toContain("account_id=mb_1");
  });

  it("lookup() decodes a null contact for an unknown sender", async () => {
    const { http } = clientWithSequence([{ body: { contact: null } }]);
    const result = await new Contacts(http).lookup({ email: "nobody@warmbly.com" });
    expect(result.contact).toBeNull();
    expect(result.match).toBeUndefined();
  });

  it("get() GETs the contact by encoded id", async () => {
    const { http, fetchMock } = clientWithSequence([
      { body: { id: "c 1", email: "team@warmbly.com" } },
    ]);
    const result = await new Contacts(http).get("c 1");
    expect(result).toEqual({ id: "c 1", email: "team@warmbly.com" });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    // The space in the id must be URL-encoded by the path helper.
    expect(url).toContain("/contacts/c%201");
  });

  it("update() PATCHes a single contact", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { id: "c_1", company: "Warmbly" } }]);
    const result = await new Contacts(http).update("c_1", { company: "Warmbly" });
    expect(result).toEqual({ id: "c_1", company: "Warmbly" });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/contacts/c_1");
    expect(JSON.parse(String(init.body))).toEqual({ company: "Warmbly" });
  });

  it("delete() DELETEs a single contact", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: undefined, status: 204 }]);
    await new Contacts(http).delete("c_1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/contacts/c_1");
  });

  it("emails() GETs the nested emails path with a query", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { data: [] } }]);
    const result = await new Contacts(http).emails("c_1", { limit: 5 });
    expect(result).toEqual({ data: [] });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c_1/emails");
    expect(url).toContain("limit=5");
  });

  it("emails() works without a query", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { data: [] } }]);
    await new Contacts(http).emails("c_1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c_1/emails");
  });

  it("timeline() GETs the nested timeline path", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { data: [] } }]);
    const result = await new Contacts(http).timeline("c_1", { cursor: "t1" });
    expect(result).toEqual({ data: [] });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c_1/timeline");
    expect(url).toContain("cursor=t1");
  });

  it("activities() GETs the nested activities path", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { data: [] } }]);
    const result = await new Contacts(http).activities("c_1");
    expect(result).toEqual({ data: [] });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c_1/activities");
  });

  it("deals() GETs the nested deals path and returns the bare array", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: [{ id: "dl_1", name: "Acme" }] }]);
    const result = await new Contacts(http).deals("c_1");
    expect(result).toEqual([{ id: "dl_1", name: "Acme" }]);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c_1/deals");
  });

  it("listNotes() GETs the nested notes path and decodes the paginated envelope", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          data: [{ id: "n_1", content: "Hi" }],
          pagination: { total: 1, next_cursor: null, has_more: false },
        },
      },
    ]);
    const page = await new Contacts(http).listNotes("c_1", { limit: 20 });
    expect(page.data).toEqual([{ id: "n_1", content: "Hi" }]);
    expect(callAt(fetchMock, 0).url).toContain("limit=20");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c_1/notes");
  });

  it("createNote() POSTs with a content field, not body", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { id: "n_1", content: "Called" } }]);
    const result = await new Contacts(http).createNote("c_1", { content: "Called, no answer" });
    expect(result).toEqual({ id: "n_1", content: "Called" });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/c_1/notes");
    const parsed = JSON.parse(String(init.body));
    expect(parsed).toEqual({ content: "Called, no answer" });
    expect(parsed.content).toBe("Called, no answer");
    expect(parsed).not.toHaveProperty("body");
  });

  it("updateNote() PATCHes the nested note path with content", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { id: "n_1", content: "Updated" } }]);
    const result = await new Contacts(http).updateNote("c_1", "n_1", { content: "Updated" });
    expect(result).toEqual({ id: "n_1", content: "Updated" });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/contacts/c_1/notes/n_1");
    const parsed = JSON.parse(String(init.body));
    expect(parsed).toEqual({ content: "Updated" });
    expect(parsed).not.toHaveProperty("body");
  });

  it("deletes a note via the nested path", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: undefined, status: 204 }]);
    await new Contacts(http).deleteNote("c1", "n1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/contacts/c1/notes/n1");
  });
  it("customFields() unwraps the flat data array", async () => {
    const { http, fetchMock } = clientWithSequence([
      { body: { data: ["industry", "seat_count"] } },
    ]);
    const keys = await new Contacts(http).customFields();
    expect(keys).toEqual(["industry", "seat_count"]);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/custom-fields");
  });

  it("customFields() returns an empty array when the envelope has no data", async () => {
    const { http } = clientWithSequence([{ body: {} }]);
    await expect(new Contacts(http).customFields()).resolves.toEqual([]);
  });

  it("research() POSTs the per-contact run and returns its cited result", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          id: "run_1",
          contact_id: "c_1",
          status: "succeeded",
          credits_charged: 2,
          result: { signals: [{ fact: "Raised a Series A", url: "https://example.com" }] },
        },
      },
    ]);
    const run = await new Contacts(http).research("c_1", { objective: "funding signals" });
    expect(run.status).toBe("succeeded");
    expect(run.result?.signals?.[0]?.url).toBe("https://example.com");

    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/c_1/research");
    expect(JSON.parse(String(init.body))).toEqual({ objective: "funding signals" });
  });

  it("listResearch() unwraps the data envelope", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { data: [{ id: "run_1" }] } }]);
    const runs = await new Contacts(http).listResearch("c_1");
    expect(runs.map((r) => r.id)).toEqual(["run_1"]);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c_1/research");
  });

  it("researchBatch() POSTs the batch path and reports how many queued", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { queued: 2 } }]);
    const result = await new Contacts(http).researchBatch({ contact_ids: ["c_1", "c_2"] });
    expect(result.queued).toBe(2);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/research/batch");
    expect(JSON.parse(String(init.body))).toEqual({ contact_ids: ["c_1", "c_2"] });
  });
});

// Single-response helpers for the sections below, built on the sequence helper above.
function clientWith(
  body: unknown,
  init: { status?: number } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  return clientWithSequence([{ body, status: init.status }]);
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  return callAt(fetchMock, fetchMock.mock.calls.length - 1);
}

describe("Contacts: verification, campaign state, segments, search filters", () => {
  it("verification GETs /contacts/verification", async () => {
    const { http, fetchMock } = clientWith({ provider: "builtin", counts: { valid: 5 } });
    const out = await new Contacts(http).verification();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/contacts\/verification$/);
    expect(out.counts?.valid).toBe(5);
  });

  it("requestVerification POSTs the action to /contacts/verification", async () => {
    const { http, fetchMock } = clientWith({
      affected: 12,
      action: "verify",
      queued: true,
      verifier: "builtin",
      verifier_error: "provider balance exhausted",
    });
    const out = await new Contacts(http).requestVerification({
      action: "verify",
      campaign_id: "camp1",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/contacts\/verification$/);
    expect(JSON.parse(String(init.body))).toEqual({ action: "verify", campaign_id: "camp1" });
    expect(out.affected).toBe(12);
    expect(out.verifier_error).toBe("provider balance exhausted");
  });

  it("campaigns GETs /contacts/:id/campaigns and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ campaign_id: "camp1", lead_status: "active", next: { state: "waiting" } }],
    });
    const out = await new Contacts(http).campaigns("c1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c1/campaigns");
    expect(out[0]?.next?.state).toBe("waiting");
  });

  it("segments GETs /contacts/:id/segments and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "seg1", member: true, mode: "include" }],
    });
    const out = await new Contacts(http).segments("c1");
    expect(lastCall(fetchMock).url).toContain("/contacts/c1/segments");
    expect(out[0]?.member).toBe(true);
  });

  it("search sends the segment, lead status, and engagement filters in the body", async () => {
    const { http, fetchMock } = clientWith({
      data: [],
      pagination: { total: 0, next_cursor: null, has_more: false },
    });
    await new Contacts(http).search({
      campaign_ids: ["camp1"],
      lead_status: "replied",
      engagement: "opened",
      segment_ids: ["seg1"],
      verification_status: "valid",
    });
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({
      campaign_ids: ["camp1"],
      lead_status: "replied",
      engagement: "opened",
      segment_ids: ["seg1"],
      verification_status: "valid",
    });
  });

  it("timeline passes limit and cursor as query params", async () => {
    const { http, fetchMock } = clientWith({ data: [], has_more: false });
    await new Contacts(http).timeline("c1", { limit: 100, cursor: "abc" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/contacts/c1/timeline");
    expect(url).toContain("limit=100");
    expect(url).toContain("cursor=abc");
  });
});

describe("Contacts: background imports", () => {
  const draft = {
    id: "imp_1",
    organization_id: "org_1",
    created_by: "u_1",
    filename: "leads.csv",
    format: "csv",
    status: "draft",
    has_header: true,
    columns: ["Email", "Name"],
    total: 2,
    processed: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    notes: [],
    created_at: "2026-10-04T09:00:00Z",
    updated_at: "2026-10-04T09:00:00Z",
    preview: {
      filename: "leads.csv",
      format: "csv",
      total_rows: 2,
      columns: ["Email", "Name"],
      has_header: true,
      sample_rows: [["team@warmbly.com", "Sam"]],
      suggested_mapping: [{ index: 0, target: "email" }],
      column_stats: [{ filled: 2, distinct: 2, samples: ["team@warmbly.com"] }],
    },
  };
  const options = {
    mapping: [{ index: 0, target: "email" }],
    has_header: true,
    dedup: "skip" as const,
  };

  it("createImport POSTs the file as multipart and decodes the draft", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: draft, status: 201 }]);
    const out = await new Contacts(http).createImport(new Blob(["Email,Name\n"]), {
      filename: "leads.csv",
    });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/contacts\/imports$/);
    const form = init.body as FormData;
    expect((form.get("file") as File).name).toBe("leads.csv");
    expect(out.status).toBe("draft");
    expect(out.preview?.column_stats?.[0]?.filled).toBe(2);
  });

  it("listImports GETs /contacts/imports as a Page and follows the cursor", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          data: [draft],
          pagination: { total: null, next_cursor: "cur2", has_more: true },
        },
      },
      {
        body: {
          data: [{ ...draft, id: "imp_2", status: "completed" }],
          pagination: { total: null, next_cursor: null, has_more: false },
        },
      },
    ]);
    const page = await new Contacts(http).listImports({ limit: 1 });
    const ids = (await page.toArray()).map((i) => i.id);
    expect(ids).toEqual(["imp_1", "imp_2"]);
    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("GET");
    expect(first.url).toContain("/contacts/imports");
    expect(first.url).toContain("limit=1");
    expect(callAt(fetchMock, 1).url).toContain("cursor=cur2");
  });

  it("getImport GETs /contacts/imports/:id and decodes a finished import", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          ...draft,
          status: "completed",
          processed: 2,
          imported: 1,
          failed: 1,
          started_at: "2026-10-04T09:01:00Z",
          finished_at: "2026-10-04T09:02:00Z",
          segments_pinned: false,
          notes: ["Could not add to segment seg_1"],
          failures: [{ line: 3, email: "nope", values: ["nope", "X"], reason: "invalid email" }],
        },
      },
    ]);
    const out = await new Contacts(http).getImport("imp_1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/contacts\/imports\/imp_1$/);
    expect(out.segments_pinned).toBe(false);
    expect(out.failures?.[0]?.reason).toBe("invalid email");
  });

  it("getImport decodes an unknown status without throwing", async () => {
    const { http } = clientWithSequence([{ body: { ...draft, status: "paused_for_review" } }]);
    const out = await new Contacts(http).getImport("imp_1");
    expect(out.status).toBe("paused_for_review");
  });

  it("saveImportDraft PATCHes the options", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { ...draft, options } }]);
    const out = await new Contacts(http).saveImportDraft("imp_1", options);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/contacts\/imports\/imp_1$/);
    expect(JSON.parse(String(init.body))).toEqual(options);
    expect(out.options?.dedup).toBe("skip");
  });

  it("analyzeImport POSTs the mapping and decodes the buckets", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          rows: 10,
          new: 6,
          existing: 2,
          duplicates_in_file: 1,
          invalid: 1,
          conflicts: 0,
          invalid_samples: [{ line: 5, email: "x", reason: "invalid email" }],
          problem: "plan contact limit reached",
        },
      },
    ]);
    const out = await new Contacts(http).analyzeImport("imp_1", {
      mapping: options.mapping,
      has_header: true,
    });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/contacts\/imports\/imp_1\/analyze$/);
    expect(JSON.parse(String(init.body))).toEqual({ mapping: options.mapping, has_header: true });
    expect(out.new).toBe(6);
    expect(out.problem).toBe("plan contact limit reached");
  });

  it("startImport POSTs the final options", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { ...draft, status: "queued" } }]);
    const out = await new Contacts(http).startImport("imp_1", options);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/contacts\/imports\/imp_1\/start$/);
    expect(JSON.parse(String(init.body))).toEqual(options);
    expect(out.status).toBe("queued");
  });

  it("cancelImport POSTs a bodyless request", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { ...draft, status: "cancelled" } }]);
    const out = await new Contacts(http).cancelImport("imp_1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/contacts\/imports\/imp_1\/cancel$/);
    expect(init.body).toBeUndefined();
    expect(out.status).toBe("cancelled");
  });

  it("importFailures GETs failed.csv and returns the CSV text", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("line,email,reason\n3,nope,invalid email\n", {
          status: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="leads-failed.csv"',
          },
        }),
    );
    const http = new HttpClient(
      resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
    );
    const csv = await new Contacts(http).importFailures("imp_1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/contacts\/imports\/imp_1\/failed\.csv$/);
    expect(csv).toBe("line,email,reason\n3,nope,invalid email\n");
  });

  it("importFailures returns an empty string for an empty body", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    const http = new HttpClient(
      resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
    );
    await expect(new Contacts(http).importFailures("imp_1")).resolves.toBe("");
  });
});
