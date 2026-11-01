import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/**
 * One image in the workspace's library for email bodies. The bytes live at a public URL,
 * because the recipient's mail client fetches them with no session.
 */
export interface EmailImage {
  id: string;
  organization_id: string;
  /** Absent when the upload came from an API key with no user behind it. */
  user_id?: string;
  /** The display name, with the extension forced to match the real image type. */
  filename: string;
  /** `image/png`, `image/jpeg`, `image/gif` or `image/webp`, as sniffed from the bytes. */
  mime_type: string;
  size: number;
  /** 0 when unknown (WebP dimensions are not read). */
  width: number;
  height: number;
  /** The absolute public URL to place in an email body. */
  url: string;
  created_at: string;
  [key: string]: unknown;
}

/** Query params for listing library images. */
export interface ListEmailImagesParams {
  cursor?: string;
  /** Page size (1..100, default 40). */
  limit?: number;
  [key: string]: unknown;
}

/**
 * The workspace image library for email bodies: upload, list, and delete. Reachable as
 * `warmbly.emailImages`. Listing needs the `READ_CAMPAIGNS` scope; uploading and deleting
 * need `WRITE_CAMPAIGNS`.
 *
 * @example
 * const png = new Blob([bytes], { type: "image/png" });
 * const image = await warmbly.emailImages.upload(png, { filename: "logo.png" });
 * const html = `<img src="${image.url}" alt="${image.filename}">`;
 */
export class EmailImages extends APIResource {
  /**
   * Lists library images, newest first, auto-paginating when iterated. Needs
   * `READ_CAMPAIGNS`.
   *
   * @example
   * for await (const image of await warmbly.emailImages.list()) console.log(image.url);
   */
  list(params?: ListEmailImagesParams): Promise<Page<EmailImage>> {
    return this.http.getPage<EmailImage>("email-images", { query: params });
  }

  /**
   * Uploads an image as `multipart/form-data`. Pass the file as a `Blob` or `File`; set
   * `filename` for the upload name. The server sniffs the real type: PNG, JPEG, GIF and
   * WebP only (SVG is refused), up to 5 MB and 4000 px on a side. The upload counts against
   * the plan's storage quota: a 400 with code `storage_limit_reached` means it did not fit. Needs
   * `WRITE_CAMPAIGNS`.
   *
   * @example
   * const image = await warmbly.emailImages.upload(file, { filename: "logo.png" });
   */
  upload(file: Blob, params?: { filename?: string }, opts?: RequestOptions): Promise<EmailImage> {
    const form = new FormData();
    // Name the part only when there is a name: a non-spec FormData (React Native's, some
    // polyfills) would otherwise stringify an explicit undefined into "undefined".
    if (params?.filename !== undefined) form.append("file", file, params.filename);
    else form.append("file", file);
    return this.http.post<EmailImage>("email-images", { ...opts, body: form });
  }

  /**
   * Deletes an image from the library together with its stored bytes, so any email already
   * sent with it loses the picture. Deleting is idempotent. Resolves with no body (204).
   * Needs `WRITE_CAMPAIGNS`.
   *
   * @example
   * await warmbly.emailImages.delete("img_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("email-images", id), opts);
  }
}
