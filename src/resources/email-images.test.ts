import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { BadRequestError } from "../core/errors";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { EmailImages } from "./email-images";

function clientWithSequence(responses: Array<{ body: unknown; status?: number }>): {
  http: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  let i = 0;
  const fetchMock = vi.fn(async () => {
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const status = next?.status ?? 200;
    const payload = status === 204 ? null : JSON.stringify(next?.body);
    return new Response(payload, { status, headers: { "content-type": "application/json" } });
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

const image = {
  id: "img_1",
  organization_id: "org_1",
  user_id: "u_1",
  filename: "logo.png",
  mime_type: "image/png",
  size: 2048,
  width: 600,
  height: 200,
  url: "https://api.warmbly.com/public/email-images/org_1/abc.png",
  created_at: "2026-10-04T09:00:00Z",
};

describe("EmailImages", () => {
  it("list GETs /email-images as a Page and follows the cursor", async () => {
    const { http, fetchMock } = clientWithSequence([
      { body: { data: [image], pagination: { next_cursor: "cur2", has_more: true } } },
      {
        body: {
          data: [{ ...image, id: "img_2", width: 0, height: 0, mime_type: "image/webp" }],
          pagination: { next_cursor: null, has_more: false },
        },
      },
    ]);
    const page = await new EmailImages(http).list({ limit: 1 });
    const all = await page.toArray();
    expect(all.map((i) => i.id)).toEqual(["img_1", "img_2"]);
    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("GET");
    expect(first.url).toContain("/email-images");
    expect(first.url).toContain("limit=1");
    expect(callAt(fetchMock, 1).url).toContain("cursor=cur2");
  });

  it("list decodes an image whose uploader is unknown", async () => {
    const { user_id: _omit, ...apiKeyImage } = image;
    const { http } = clientWithSequence([
      { body: { data: [apiKeyImage], pagination: { next_cursor: null, has_more: false } } },
    ]);
    const page = await new EmailImages(http).list();
    expect(page.data[0]?.user_id).toBeUndefined();
  });

  it("upload POSTs the file as multipart and decodes the 201", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: image, status: 201 }]);
    const out = await new EmailImages(http).upload(new Blob(["png"], { type: "image/png" }), {
      filename: "logo.png",
    });
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toMatch(/\/email-images$/);
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get("file") as File).name).toBe("logo.png");
    expect(out.url).toContain("/email-images/");
    expect(out.mime_type).toBe("image/png");
  });

  it("upload surfaces the storage_limit_reached 400", async () => {
    const { http } = clientWithSequence([
      {
        body: {
          error: "Bad Request",
          message: "Storage limit reached: 100 MB of 100 MB used, 1 MB to add.",
          code: "storage_limit_reached",
        },
        status: 400,
      },
    ]);
    const err = await new EmailImages(http).upload(new Blob(["x"])).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.code).toBe("storage_limit_reached");
  });

  it("delete DELETEs /email-images/:id and treats the 204 as no body", async () => {
    const { http, fetchMock } = clientWithSequence([{ body: undefined, status: 204 }]);
    await expect(new EmailImages(http).delete("img 1")).resolves.toBeUndefined();
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(url).toMatch(/\/email-images\/img%201$/);
  });
});
