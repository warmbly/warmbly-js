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

  it("importPreview() POSTs to /contacts/import/preview", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { valid: 10, invalid: 0 } }]);
    const result = await new Contacts(http).importPreview({ upload_id: "u_1" });
    expect(result).toEqual({ valid: 10, invalid: 0 });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/import/preview");
    expect(JSON.parse(String(init.body))).toEqual({ upload_id: "u_1" });
  });

  it("importCommit() POSTs to /contacts/import/commit", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { imported: 10 } }]);
    const result = await new Contacts(http).importCommit({ upload_id: "u_1" });
    expect(result).toEqual({ imported: 10 });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/contacts/import/commit");
    expect(JSON.parse(String(init.body))).toEqual({ upload_id: "u_1" });
  });

  it("lookup() GETs /contacts/lookup with a query string", async () => {
    const { http, fetchMock } = clientWithSequence([
      { body: { id: "c_1", email: "team@warmbly.com" } },
    ]);
    const result = await new Contacts(http).lookup({ email: "team@warmbly.com" });
    expect(result).toEqual({ id: "c_1", email: "team@warmbly.com" });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("GET");
    expect(url).toContain("/contacts/lookup");
    expect(url).toContain("email=team%40warmbly.com");
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
});
