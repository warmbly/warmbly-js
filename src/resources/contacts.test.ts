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

    // Second page carries the cursor in the body, not the query string.
    expect(JSON.parse(String(callAt(fetchMock, 1).init.body))).toEqual({
      query: "x.com",
      cursor: "cur2",
    });
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
    expect(JSON.parse(String(first.init.body))).toEqual({ limit: 25, query: "ceo" });
    expect(JSON.parse(String(callAt(fetchMock, 1).init.body))).toEqual({
      limit: 25,
      query: "ceo",
      cursor: "cur9",
    });
  });

  it("wraps add() payload in a contacts array", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { created: 1 } }]);
    const result = await new Contacts(http).add([{ email: "team@warmbly.com" }]);
    expect(result).toEqual({ created: 1 });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts");
    expect(JSON.parse(String(init.body))).toEqual({ contacts: [{ email: "team@warmbly.com" }] });
  });

  it("bulkUpdate() PATCHes /contacts with the params body", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { updated: 3 } }]);
    const result = await new Contacts(http).bulkUpdate({ filter: {}, set: { company: "Warmbly" } });
    expect(result).toEqual({ updated: 3 });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/contacts");
    expect(JSON.parse(String(init.body))).toEqual({ filter: {}, set: { company: "Warmbly" } });
  });

  it("bulkDelete() DELETEs /contacts with a request body", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { deleted: 2 } }]);
    const result = await new Contacts(http).bulkDelete({ ids: ["c_1", "c_2"] });
    expect(result).toEqual({ deleted: 2 });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/contacts");
    expect(JSON.parse(String(init.body))).toEqual({ ids: ["c_1", "c_2"] });
  });

  it("export() POSTs to /contacts/export", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { job_id: "j_1" } }]);
    const result = await new Contacts(http).export({ format: "csv" });
    expect(result).toEqual({ job_id: "j_1" });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/export");
    expect(JSON.parse(String(init.body))).toEqual({ format: "csv" });
  });

  it("export() works without params", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { job_id: "j_2" } }]);
    const result = await new Contacts(http).export();
    expect(result).toEqual({ job_id: "j_2" });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/export");
    // No body when params are undefined.
    expect(init.body).toBeUndefined();
  });

  it("importPreview() uploads the file as multipart under `file`", async () => {
    const preview = {
      filename: "leads.csv",
      format: "csv",
      total_rows: 2,
      columns: ["Email", "Name"],
      has_header: true,
      sample_rows: [["a@x.io", "A"]],
      suggested_mapping: [{ index: 0, target: "email" }],
      inferred_columns: [1],
      mapping_source: "saved",
    };
    const { http, fetchMock } = clientWithSequence([{ body: preview }]);
    const file = new Blob(["Email,Name\na@x.io,A"], { type: "text/csv" });
    const result = await new Contacts(http).importPreview(file, { filename: "leads.csv" });
    expect(result.mapping_source).toBe("saved");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/import/preview");
    expect(init.body).toBeInstanceOf(FormData);
    const sent = (init.body as FormData).get("file") as File;
    expect(sent.name).toBe("leads.csv");
  });

  it("importCommit() sends the file plus a JSON `options` field", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          total: 10,
          imported: 8,
          updated: 1,
          skipped: 1,
          failed: 0,
          started_at: "2026-11-08T10:00:00Z",
          ended_at: "2026-11-08T10:00:01Z",
          segments_pinned: true,
        },
      },
    ]);
    const options = {
      mapping: [{ index: 0, target: "email" }],
      has_header: true,
      dedup: "update",
      segment_ids: ["seg_1"],
    };
    const result = await new Contacts(http).importCommit(new Blob(["x"]), options);
    expect(result.imported).toBe(8);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/import/commit");
    const form = init.body as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(JSON.parse(String(form.get("options")))).toEqual(options);
  });

  const importRow = {
    id: "imp_1",
    organization_id: "org_1",
    filename: "leads.csv",
    format: "csv",
    status: "draft",
    has_header: true,
    columns: ["Email"],
    total: 100,
    processed: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    notes: [],
    created_at: "2026-11-08T10:00:00Z",
    updated_at: "2026-11-08T10:00:00Z",
    preview: {
      filename: "leads.csv",
      format: "csv",
      total_rows: 100,
      columns: ["Email"],
      has_header: true,
      sample_rows: [["a@x.io"]],
      suggested_mapping: [{ index: 0, target: "email" }],
    },
  };

  it("createImport() uploads multipart to /contacts/imports", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: importRow, status: 201 }]);
    const imp = await new Contacts(http).createImport(new Blob(["Email\na@x.io"]), {
      filename: "leads.csv",
    });
    expect(imp.status).toBe("draft");
    expect(imp.preview?.total_rows).toBe(100);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/imports");
    expect((init.body as FormData).get("file")).toBeInstanceOf(Blob);
  });

  it("listImports() pages with cursor and limit", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          data: [importRow],
          pagination: { total: null, next_cursor: "cur_2", has_more: true },
        },
      },
      {
        body: {
          data: [
            { ...importRow, id: "imp_2", status: "completed", finished_at: "2026-11-08T11:00:00Z" },
          ],
          pagination: { total: null, next_cursor: null, has_more: false },
        },
      },
    ]);
    const ids: string[] = [];
    for await (const imp of await new Contacts(http).listImports({ limit: 1 })) ids.push(imp.id);
    expect(ids).toEqual(["imp_1", "imp_2"]);
    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("GET");
    expect(first.url).toContain("/contacts/imports");
    expect(first.url).toContain("limit=1");
    expect(callAt(fetchMock, 1).url).toContain("cursor=cur_2");
  });

  it("getImport() GETs one import by id", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          ...importRow,
          status: "failed",
          error: "boom",
          failures: [{ line: 3, email: "bad", reason: "invalid address" }],
          quality: { malformed: 1, disposable: 0, role: 0, bad_share_pct: 1, flagged: false },
        },
      },
    ]);
    const imp = await new Contacts(http).getImport("imp_1");
    expect(imp.failures?.[0]?.line).toBe(3);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/imports/imp_1");
  });

  it("saveImportDraft() PATCHes the options", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: importRow }]);
    const options = { mapping: [{ index: 0, target: "email" }], has_header: true, dedup: "skip" };
    await new Contacts(http).saveImportDraft("imp_1", options);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/contacts/imports/imp_1");
    expect(JSON.parse(String(init.body))).toEqual(options);
  });

  it("analyzeImport() POSTs mapping and has_header and decodes the analysis", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          rows: 100,
          new: 80,
          existing: 10,
          duplicates_in_file: 5,
          invalid: 4,
          conflicts: 1,
          invalid_samples: [{ line: 7, reason: "no address" }],
          problem: "over the contact limit",
        },
      },
    ]);
    const a = await new Contacts(http).analyzeImport("imp_1", {
      mapping: [{ index: 0, target: "email" }],
      has_header: true,
    });
    expect(a.new).toBe(80);
    expect(a.problem).toBe("over the contact limit");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/imports/imp_1/analyze");
    expect(JSON.parse(String(init.body))).toEqual({
      mapping: [{ index: 0, target: "email" }],
      has_header: true,
    });
  });

  it("startImport() and cancelImport() POST to their paths", async () => {
    const { http, fetchMock } = clientWithSequence([
      { body: { ...importRow, status: "queued" } },
      { body: { ...importRow, status: "cancelled" } },
    ]);
    const options = { mapping: [{ index: 0, target: "email" }], has_header: true };
    const started = await new Contacts(http).startImport("imp_1", options);
    expect(started.status).toBe("queued");
    const a = callAt(fetchMock, 0);
    expect(a.init.method).toBe("POST");
    expect(a.url).toContain("/contacts/imports/imp_1/start");
    expect(JSON.parse(String(a.init.body))).toEqual(options);
    const cancelled = await new Contacts(http).cancelImport("imp_1");
    expect(cancelled.status).toBe("cancelled");
    const b = callAt(fetchMock, 1);
    expect(b.init.method).toBe("POST");
    expect(b.url).toContain("/contacts/imports/imp_1/cancel");
    expect(b.init.body).toBeUndefined();
  });

  it("importFailuresCsv() returns the CSV as text", async () => {
    const csv = "line,email,reason\n3,bad,invalid address\n";
    const fetchMock = vi.fn(
      async () =>
        new Response(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8" } }),
    );
    const http = new HttpClient(
      resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
    );
    const out = await new Contacts(http).importFailuresCsv("imp_1");
    expect(out).toBe(csv);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/imports/imp_1/failed.csv");
  });

  it("lookup() GETs /contacts/lookup and decodes {contact, match}", async () => {
    const { http, fetchMock } = clientWithSequence([
      { body: { contact: { id: "c_1", email: "team@warmbly.com" }, match: "thread" } },
    ]);
    const result = await new Contacts(http).lookup({
      email: "team@warmbly.com",
      thread_id: "th_1",
      account_id: "acc_1",
    });
    expect(result.contact?.id).toBe("c_1");
    expect(result.match).toBe("thread");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/lookup");
    expect(url).toContain("email=team%40warmbly.com");
    expect(url).toContain("thread_id=th_1");
    expect(url).toContain("account_id=acc_1");
  });

  it("lookup() decodes an unknown sender as contact null", async () => {
    const { http } = clientWithSequence([{ body: { contact: null } }]);
    const result = await new Contacts(http).lookup({ email: "nobody@x.io" });
    expect(result.contact).toBeNull();
    expect(result.match).toBeUndefined();
  });

  it("bulkDelete() sends a bare id array or a selection object", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: undefined, status: 204 }]);
    await new Contacts(http).bulkDelete(["c_1", "c_2"]);
    const a = callAt(fetchMock, 0);
    expect(a.init.method).toBe("DELETE");
    expect(JSON.parse(String(a.init.body))).toEqual(["c_1", "c_2"]);
    await new Contacts(http).bulkDelete({
      all: true,
      filters: { query: "acme" },
      exclude: ["c_9"],
    });
    expect(JSON.parse(String(callAt(fetchMock, 1).init.body))).toEqual({
      all: true,
      filters: { query: "acme" },
      exclude: ["c_9"],
    });
  });

  it("bulkUpdate() PATCHes a selection plus edits", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { updated: 2 } }]);
    await new Contacts(http).bulkUpdate({
      contacts: ["c_1"],
      add_campaigns: ["camp_1"],
      skip_active_in_other_campaigns: true,
    });
    const { init } = callAt(fetchMock, 0);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      contacts: ["c_1"],
      add_campaigns: ["camp_1"],
      skip_active_in_other_campaigns: true,
    });
  });

  it("requestVerification() accepts a select-all selection and decodes verifier fields", async () => {
    const { http, fetchMock } = clientWithSequence([
      {
        body: {
          affected: 500,
          action: "verify",
          queued: true,
          verifier: "builtin",
          verifier_error: "key expired",
        },
      },
    ]);
    const res = await new Contacts(http).requestVerification({
      action: "verify",
      all: true,
      filters: { verification_status: "unknown" },
    });
    expect(res.verifier_error).toBe("key expired");
    expect(JSON.parse(String(callAt(fetchMock, 0).init.body))).toEqual({
      action: "verify",
      all: true,
      filters: { verification_status: "unknown" },
    });
  });

  const panel = {
    connections: [
      {
        id: "conn_1",
        label: "Prod",
        environment: "production",
        instance_url: "https://x.my.salesforce.com",
      },
    ],
    records: [
      {
        link_id: "link_1",
        connection_id: "conn_1",
        connection_label: "Prod",
        object: "Lead",
        id: "00Q1",
        url: "https://x.my.salesforce.com/00Q1",
        name: "Ada Lovelace",
        status: "Working",
        is_converted: false,
        opted_out: false,
        opportunities: [],
        tasks: [
          {
            id: "t1",
            subject: "Email: Hi",
            status: "Completed",
            url: "https://x/t1",
            from_warmbly: true,
          },
        ],
        linked_by: "email_match",
        sync: { pending: 0, failed: 1, synced: 3, last_error: "rate limited" },
        stale: false,
      },
    ],
    can_sync: true,
  };

  it("salesforce() GETs the contact panel", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: panel }]);
    const res = await new Contacts(http).salesforce("c_1");
    expect(res.records[0]?.link_id).toBe("link_1");
    expect(res.records[0]?.sync.failed).toBe(1);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c_1/salesforce");
  });

  it("syncSalesforce() POSTs connection_id and create_as, or no body", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: panel }]);
    await new Contacts(http).syncSalesforce("c_1", {
      connection_id: "conn_1",
      create_as: "contact",
    });
    const a = callAt(fetchMock, 0);
    expect(a.init.method).toBe("POST");
    expect(a.url).toContain("/contacts/c_1/salesforce/sync");
    expect(JSON.parse(String(a.init.body))).toEqual({
      connection_id: "conn_1",
      create_as: "contact",
    });
    await new Contacts(http).syncSalesforce("c_1");
    expect(callAt(fetchMock, 1).init.body).toBeUndefined();
  });

  it("unlinkSalesforce() DELETEs the link and tolerates 204", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: undefined, status: 204 }]);
    await new Contacts(http).unlinkSalesforce("c_1", "link_1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/contacts/c_1/salesforce/links/link_1");
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

  it("deals() GETs the nested deals path", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { data: [] } }]);
    const result = await new Contacts(http).deals("c_1");
    expect(result).toEqual({ data: [] });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/c_1/deals");
  });

  it("listNotes() GETs the nested notes path", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: [{ id: "n_1", content: "Hi" }] }]);
    const result = await new Contacts(http).listNotes("c_1");
    expect(result).toEqual([{ id: "n_1", content: "Hi" }]);
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
    const { http, fetchMock } = clientWith({ affected: 12, action: "verify", queued: true });
    const out = await new Contacts(http).requestVerification({
      action: "verify",
      campaign_id: "camp1",
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/contacts\/verification$/);
    expect(JSON.parse(String(init.body))).toEqual({ action: "verify", campaign_id: "camp1" });
    expect(out.affected).toBe(12);
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
