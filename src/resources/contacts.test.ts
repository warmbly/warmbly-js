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
          data: [{ id: "c1", email: "a@x.com" }],
          pagination: { total: 2, next_cursor: "cur2", has_more: true },
        },
      },
      {
        body: {
          data: [{ id: "c2", email: "b@x.com" }],
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

  it("wraps add() payload in a contacts array", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: { created: 1 } }]);
    await new Contacts(http).add([{ email: "a@x.com" }]);
    const { url, init } = callAt(fetchMock, 0);
    expect(url).toContain("/contacts");
    expect(JSON.parse(String(init.body))).toEqual({ contacts: [{ email: "a@x.com" }] });
  });

  it("deletes a note via the nested path", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: undefined, status: 204 }]);
    await new Contacts(http).deleteNote("c1", "n1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/contacts/c1/notes/n1");
  });
});
