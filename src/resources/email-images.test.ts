import { describe, expect, it, vi } from "vitest";
import { resolveClientOptions } from "../core/config";
import { HttpClient } from "../core/http";
import type { FetchLike } from "../core/types";
import { EmailImages } from "./email-images";

function clientWith(responses: Array<{ body?: unknown; status?: number }>): {
  http: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  let i = 0;
  const fetchMock = vi.fn(async () => {
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const status = next?.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(next?.body), {
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

const image = {
  id: "img_1",
  organization_id: "org_1",
  user_id: "usr_1",
  filename: "logo.png",
  mime_type: "image/png",
  size: 2048,
  width: 600,
  height: 200,
  url: "https://api.warmbly.com/public/email-images/org_1/abc.png",
  created_at: "2026-11-08T10:00:00Z",
};

describe("EmailImages", () => {
  it("lists images with limit and follows the cursor when iterating", async () => {
    const { http, fetchMock } = clientWith([
      { body: { data: [image], pagination: { next_cursor: "cur_2", has_more: true } } },
      {
        body: {
          data: [{ ...image, id: "img_2", user_id: undefined }],
          pagination: { next_cursor: null, has_more: false },
        },
      },
    ]);
    const ids: string[] = [];
    for await (const img of await new EmailImages(http).list({ limit: 1 })) ids.push(img.id);
    expect(ids).toEqual(["img_1", "img_2"]);
    const first = callAt(fetchMock, 0);
    expect(first.init.method).toBe("GET");
    expect(first.url).toContain("/email-images");
    expect(first.url).toContain("limit=1");
    expect(callAt(fetchMock, 1).url).toContain("cursor=cur_2");
  });

  it("uploads as multipart under `file` with the given filename", async () => {
    const { http, fetchMock } = clientWith([{ body: image, status: 201 }]);
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const img = await new EmailImages(http).upload(blob, { filename: "logo.png" });
    expect(img.url).toContain("/public/email-images/");
    expect(img.width).toBe(600);
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("POST");
    expect(url).toContain("/email-images");
    expect(init.body).toBeInstanceOf(FormData);
    const sent = (init.body as FormData).get("file") as File;
    expect(sent.name).toBe("logo.png");
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers).some((k) => k.toLowerCase() === "content-type")).toBe(false);
  });

  it("deletes an image and tolerates 204", async () => {
    const { http, fetchMock } = clientWith([{ status: 204 }]);
    await new EmailImages(http).delete("img_1");
    const { url, init } = callAt(fetchMock, 0);
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/email-images/img_1");
  });
});
