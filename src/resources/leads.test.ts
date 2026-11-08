import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Leads } from "./leads";

function clientWith(
  bodies: unknown | unknown[],
  init: { status?: number } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const queue = Array.isArray(bodies) ? [...bodies] : [bodies];
  const fetchMock = vi.fn(async () => {
    const body = queue.length > 1 ? queue.shift() : queue[0];
    const status = init.status ?? 200;
    return new Response(body === undefined || status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  const http = new HttpClient(
    resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
  );
  return { http, fetchMock };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

const lead = {
  id: "l1",
  provider: "osm",
  name: "Cafe Berlin",
  category: "cafe",
  email: "hi@cafe.de",
  rating: null,
  review_count: null,
  status: "new",
  enrichment_status: "none",
  contact_id: null,
  tags: [],
  people_count: 0,
};

describe("Leads", () => {
  it("config GETs /leads/config", async () => {
    const { http, fetchMock } = clientWith({
      providers: [{ id: "osm", name: "OpenStreetMap", available: true, needs_key: false }],
      categories: [{ id: "cafe", label: "Cafes", group: "Food and drink" }],
      default_provider: "osm",
      enrich_cost_usd: 0.01,
      map: { style_light: "a", style_dark: "b" },
    });
    const out = await new Leads(http).config();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/leads\/config$/);
    expect(out.default_provider).toBe("osm");
  });

  it("geocode GETs /leads/geocode with the query and unwraps data", async () => {
    const { http, fetchMock } = clientWith({
      data: [
        { label: "Berlin", detail: "Germany", kind: "city", center: { lat: 52.5, lng: 13.4 } },
      ],
    });
    const out = await new Leads(http).geocode({ q: "Berlin", lat: 52.5, lng: 13.4, lang: "de" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/leads/geocode?");
    const qs = new URL(url).searchParams;
    expect(qs.get("q")).toBe("Berlin");
    expect(qs.get("lat")).toBe("52.5");
    expect(qs.get("lng")).toBe("13.4");
    expect(qs.get("lang")).toBe("de");
    expect(out[0]?.center.lat).toBe(52.5);
  });

  it("search POSTs /leads/search", async () => {
    const { http, fetchMock } = clientWith({
      search: { id: "s1", name: "Cafes", saved: false, has_more: true },
      leads: [lead],
      found: 1,
      outside_area: 0,
      charged_usd: 0,
    });
    const area = { kind: "bbox", bounds: { south: 1, west: 2, north: 3, east: 4 } };
    const out = await new Leads(http).search({
      provider: "osm",
      category: "cafe",
      area,
      save: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/leads\/search$/);
    expect(JSON.parse(String(init.body))).toEqual({
      provider: "osm",
      category: "cafe",
      area,
      save: true,
    });
    expect(out.found).toBe(1);
    expect(out.leads[0]?.name).toBe("Cafe Berlin");
  });

  it("query POSTs /leads/query and auto-paginates with the cursor in the body", async () => {
    const { http, fetchMock } = clientWith([
      {
        data: [lead],
        pagination: { next_cursor: "c2", has_more: true, total: 2 },
      },
      {
        data: [{ ...lead, id: "l2" }],
        pagination: { next_cursor: null, has_more: false, total: 2 },
      },
    ]);
    const page = await new Leads(http).query({
      filter: { has_email: true },
      sort: "score",
      limit: 1,
    });
    const first = lastCall(fetchMock);
    expect(first.init.method).toBe("POST");
    expect(first.url).toMatch(/\/leads\/query$/);
    expect(JSON.parse(String(first.init.body))).toEqual({
      filter: { has_email: true },
      sort: "score",
      limit: 1,
    });
    expect(page.pagination.total).toBe(2);
    const ids: string[] = [];
    for await (const l of page) ids.push(l.id);
    expect(ids).toEqual(["l1", "l2"]);
    expect(JSON.parse(String(lastCall(fetchMock).init.body)).cursor).toBe("c2");
  });

  it("points POSTs /leads/points and keeps truncated", async () => {
    const { http, fetchMock } = clientWith({
      data: [{ id: "l1", name: "A", latitude: 1, longitude: 2, has_email: true }],
      truncated: false,
    });
    const out = await new Leads(http).points({ filter: { statuses: ["new"] } });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/leads\/points$/);
    expect(JSON.parse(String(init.body))).toEqual({ filter: { statuses: ["new"] } });
    expect(out.data[0]?.latitude).toBe(1);
    expect(out.truncated).toBe(false);
  });

  it("facets POSTs /leads/facets", async () => {
    const { http, fetchMock } = clientWith({
      categories: [{ value: "cafe", count: 4 }],
      tags: [],
      cities: [{ value: "Berlin", count: 4 }],
    });
    const out = await new Leads(http).facets({ filter: { q: "cafe" } });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/leads\/facets$/);
    expect(JSON.parse(String(init.body))).toEqual({ filter: { q: "cafe" } });
    expect(out.cities[0]?.count).toBe(4);
  });

  it("export POSTs /leads/export and returns the body", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("name,email\nCafe,hi@cafe.de\n", {
          status: 200,
          headers: { "content-type": "text/csv" },
        }),
    );
    const http = new HttpClient(
      resolveClientOptions({ apiKey: "wmbly_test", fetch: fetchMock as unknown as FetchLike }),
    );
    const out = await new Leads(http).export({ all: true, format: "csv", columns: ["name"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/leads\/export$/);
    expect(JSON.parse(String(init.body))).toEqual({ all: true, format: "csv", columns: ["name"] });
    expect(out).toBe("name,email\nCafe,hi@cafe.de\n");
  });

  it("update PATCHes /leads with the selection and patch", async () => {
    const { http, fetchMock } = clientWith({ updated: 2 });
    const out = await new Leads(http).update({
      lead_ids: ["l1", "l2"],
      status: "saved",
      add_tags: ["hot"],
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/leads$/);
    expect(JSON.parse(String(init.body))).toEqual({
      lead_ids: ["l1", "l2"],
      status: "saved",
      add_tags: ["hot"],
    });
    expect(out.updated).toBe(2);
  });

  it("delete DELETEs /leads with the selection in the body", async () => {
    const { http, fetchMock } = clientWith({ deleted: 1 });
    const out = await new Leads(http).delete({ lead_ids: ["l1"] });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toMatch(/\/leads$/);
    expect(JSON.parse(String(init.body))).toEqual({ lead_ids: ["l1"] });
    expect(out.deleted).toBe(1);
  });

  it("enrich POSTs /leads/enrich and returns the run", async () => {
    const { http, fetchMock } = clientWith(
      { id: "run1", status: "queued", total: 1, processed: 0, charged_usd: 0 },
      { status: 202 },
    );
    const out = await new Leads(http).enrich({ lead_ids: ["l1"], people: false });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/leads\/enrich$/);
    expect(JSON.parse(String(init.body))).toEqual({ lead_ids: ["l1"], people: false });
    expect(out.id).toBe("run1");
  });

  it("enrichments GETs /leads/enrichments and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: [{ id: "run1", status: "running" }] });
    const out = await new Leads(http).enrichments();
    expect(lastCall(fetchMock).url).toMatch(/\/leads\/enrichments$/);
    expect(out[0]?.status).toBe("running");
  });

  it("enrichments tolerates a missing data array", async () => {
    const { http } = clientWith({});
    expect(await new Leads(http).enrichments()).toEqual([]);
  });

  it("getEnrichment GETs /leads/enrichments/:id", async () => {
    const { http, fetchMock } = clientWith({ id: "run1", status: "completed", emails_found: 3 });
    const out = await new Leads(http).getEnrichment("run1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/leads\/enrichments\/run1$/);
    expect(out.emails_found).toBe(3);
  });

  it("addToContacts POSTs /leads/contacts", async () => {
    const { http, fetchMock } = clientWith({
      selected: 2,
      imported: 1,
      updated: 1,
      skipped: 0,
      failed: 0,
      no_email: 0,
      unverified: 0,
      suppressed: 0,
      guessed: 0,
      people: 0,
    });
    const out = await new Leads(http).addToContacts({
      lead_ids: ["l1", "l2"],
      who: "both",
      campaign_ids: ["c1"],
      verified_only: true,
    });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/leads\/contacts$/);
    expect(JSON.parse(String(init.body))).toEqual({
      lead_ids: ["l1", "l2"],
      who: "both",
      campaign_ids: ["c1"],
      verified_only: true,
    });
    expect(out.imported).toBe(1);
  });

  it("searches GETs /leads/searches with saved and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: [{ id: "s1", name: "Cafes", saved: true }] });
    const out = await new Leads(http).searches({ saved: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/leads\/searches\?saved=true$/);
    expect(out[0]?.saved).toBe(true);
  });

  it("updateSearch PATCHes /leads/searches/:id", async () => {
    const { http, fetchMock } = clientWith({ id: "s1", name: "New", saved: true });
    const out = await new Leads(http).updateSearch("s1", { name: "New", saved: true });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/leads\/searches\/s1$/);
    expect(JSON.parse(String(init.body))).toEqual({ name: "New", saved: true });
    expect(out.name).toBe("New");
  });

  it("deleteSearch DELETEs /leads/searches/:id and tolerates 204", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await expect(new Leads(http).deleteSearch("s1")).resolves.toBeUndefined();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toMatch(/\/leads\/searches\/s1$/);
  });

  it("get GETs /leads/:id", async () => {
    const { http, fetchMock } = clientWith({
      ...lead,
      people: [{ id: "p1", lead_id: "l1", name: "Ada", seniority: "owner", contact_id: null }],
    });
    const out = await new Leads(http).get("l1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/leads\/l1$/);
    expect(out.people?.[0]?.name).toBe("Ada");
  });

  it("edit PATCHes /leads/:id", async () => {
    const { http, fetchMock } = clientWith({ ...lead, status: "contacted", notes: "called" });
    const out = await new Leads(http).edit("l1", { status: "contacted", notes: "called" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/leads\/l1$/);
    expect(JSON.parse(String(init.body))).toEqual({ status: "contacted", notes: "called" });
    expect(out.status).toBe("contacted");
  });

  it("addPerson POSTs /leads/:id/people", async () => {
    const { http, fetchMock } = clientWith({
      id: "p1",
      lead_id: "l1",
      name: "Ada Lovelace",
      email: "ada@cafe.de",
      email_source: "pattern",
      email_status: "guessed",
      source: "manual",
    });
    const out = await new Leads(http).addPerson("l1", { name: "Ada Lovelace", title: "Owner" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/leads\/l1\/people$/);
    expect(JSON.parse(String(init.body))).toEqual({ name: "Ada Lovelace", title: "Owner" });
    expect(out.email_status).toBe("guessed");
  });

  it("updatePerson PATCHes /leads/:id/people/:pid", async () => {
    const { http, fetchMock } = clientWith({ id: "p1", lead_id: "l1", title: "CEO" });
    const out = await new Leads(http).updatePerson("l1", "p1", { title: "CEO" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/leads\/l1\/people\/p1$/);
    expect(JSON.parse(String(init.body))).toEqual({ title: "CEO" });
    expect(out.title).toBe("CEO");
  });

  it("deletePerson DELETEs /leads/:id/people/:pid and tolerates 204", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 204 });
    await expect(new Leads(http).deletePerson("l1", "p1")).resolves.toBeUndefined();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toMatch(/\/leads\/l1\/people\/p1$/);
  });

  it("findPersonEmail POSTs /leads/:id/people/:pid/find-email", async () => {
    const { http, fetchMock } = clientWith({ id: "p1", lead_id: "l1", email: "ada@cafe.de" });
    const out = await new Leads(http).findPersonEmail("l1", "p1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/leads\/l1\/people\/p1\/find-email$/);
    expect(out.email).toBe("ada@cafe.de");
  });
});
