import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { Forms } from "./forms";

function clientWith(
  body: unknown,
  init: { status?: number } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? "" : JSON.stringify(body), {
        status: init.status ?? 200,
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

describe("Forms", () => {
  it("list GETs /forms and unwraps data", async () => {
    const { http, fetchMock } = clientWith({ data: [{ id: "f1", name: "Demo" }] });
    const out = await new Forms(http).list();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toMatch(/\/forms$/);
    expect(out).toEqual([{ id: "f1", name: "Demo" }]);
  });

  it("config GETs /forms/config", async () => {
    const { http, fetchMock } = clientWith({
      base_url: "https://f.warmbly.com",
      captcha_available: true,
    });
    const out = await new Forms(http).config();
    expect(lastCall(fetchMock).url).toMatch(/\/forms\/config$/);
    expect(out.captcha_available).toBe(true);
  });

  it("create POSTs the name to /forms", async () => {
    const { http, fetchMock } = clientWith({ id: "f1", name: "Demo" }, { status: 201 });
    const out = await new Forms(http).create({ name: "Demo" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/forms$/);
    expect(JSON.parse(String(init.body))).toEqual({ name: "Demo" });
    expect(out.id).toBe("f1");
  });

  it("get GETs /forms/:id", async () => {
    const { http, fetchMock } = clientWith({ id: "f1" });
    await new Forms(http).get("f1");
    expect(lastCall(fetchMock).url).toContain("/forms/f1");
  });

  it("update PATCHes /forms/:id and passes a null campaign_id through", async () => {
    const { http, fetchMock } = clientWith({ id: "f1", status: "published" });
    await new Forms(http).update("f1", { status: "published", campaign_id: null });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(url).toContain("/forms/f1");
    expect(JSON.parse(String(init.body))).toEqual({ status: "published", campaign_id: null });
  });

  it("delete DELETEs /forms/:id", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 200 });
    await new Forms(http).delete("f1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/forms/f1");
  });

  it("listSubmissions GETs /forms/:id/submissions with limit and before", async () => {
    const { http, fetchMock } = clientWith({ data: [{ id: "s1" }], has_more: false });
    const out = await new Forms(http).listSubmissions("f1", {
      limit: 10,
      before: "2026-09-01T00:00:00Z",
    });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/forms/f1/submissions");
    expect(url).toContain("limit=10");
    expect(url).toContain("before=2026-09-01T00%3A00%3A00Z");
    expect(out.data[0]?.id).toBe("s1");
    expect(out.has_more).toBe(false);
  });

  it("deleteSubmission DELETEs /forms/:id/submissions/:sid", async () => {
    const { http, fetchMock } = clientWith(undefined, { status: 200 });
    await new Forms(http).deleteSubmission("f1", "s1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/forms/f1/submissions/s1");
  });

  it("stats GETs /forms/:id/stats with the range", async () => {
    const { http, fetchMock } = clientWith({ totals: { views: 10 } });
    const out = await new Forms(http).stats("f1", { range: "7d" });
    const { url } = lastCall(fetchMock);
    expect(url).toContain("/forms/f1/stats");
    expect(url).toContain("range=7d");
    expect(out.totals?.views).toBe(10);
  });

  it("mintLink GETs /forms/:id/links/:contactId", async () => {
    const { http, fetchMock } = clientWith({ url: "https://f.warmbly.com/f/abc?t=x" });
    const out = await new Forms(http).mintLink("f1", "c1");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("GET");
    expect(url).toContain("/forms/f1/links/c1");
    expect(out.url).toContain("/f/abc");
  });

  it("uploadAsset POSTs multipart form data to /forms/:id/assets/:kind", async () => {
    const { http, fetchMock } = clientWith({ id: "f1", logo_url: "https://cdn/x.png" });
    const blob = new Blob(["png"], { type: "image/png" });
    const out = await new Forms(http).uploadAsset("f1", "logo", blob, { filename: "logo.png" });
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toContain("/forms/f1/assets/logo");
    expect(init.body).toBeInstanceOf(FormData);
    const file = (init.body as FormData).get("file") as File;
    expect(file.name).toBe("logo.png");
    expect(out.logo_url).toBe("https://cdn/x.png");
  });

  it("deleteAsset DELETEs /forms/:id/assets/:kind and returns the form", async () => {
    const { http, fetchMock } = clientWith({ id: "f1", cover_url: "" });
    const out = await new Forms(http).deleteAsset("f1", "cover");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/forms/f1/assets/cover");
    expect(out.id).toBe("f1");
  });

  it("getDomain GETs /forms/domain", async () => {
    const { http, fetchMock } = clientWith({
      forms_domain: "forms.acme.com",
      forms_domain_verified: false,
    });
    const out = await new Forms(http).getDomain();
    expect(lastCall(fetchMock).url).toMatch(/\/forms\/domain$/);
    expect(out.forms_domain).toBe("forms.acme.com");
  });

  it("setDomain PUTs forms_domain to /forms/domain", async () => {
    const { http, fetchMock } = clientWith({
      forms_domain: "forms.acme.com",
      forms_domain_verified: true,
    });
    await new Forms(http).setDomain("forms.acme.com");
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("PUT");
    expect(url).toMatch(/\/forms\/domain$/);
    expect(JSON.parse(String(init.body))).toEqual({ forms_domain: "forms.acme.com" });
  });

  it("verifyDomain POSTs /forms/domain/verify", async () => {
    const { http, fetchMock } = clientWith({
      forms_domain: "forms.acme.com",
      forms_domain_verified: true,
    });
    const out = await new Forms(http).verifyDomain();
    const { url, init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/forms\/domain\/verify$/);
    expect(out.forms_domain_verified).toBe(true);
  });
});
