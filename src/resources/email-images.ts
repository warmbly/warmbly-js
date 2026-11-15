import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** One image in the workspace library for email bodies. */
export interface EmailImage {
  id: string;
  organization_id: string;
  /** The uploader, when a user (not an API key) uploaded it. */
  user_id?: string;
  /** The display name; its extension always matches the detected type. */
  filename: string;
  /** Decided from the bytes: `image/png`, `image/jpeg`, `image/gif` or `image/webp`. */
  mime_type: string;
  /** Bytes. */
  size: number;
  width: number;
  height: number;
  /** The public, absolute URL a recipient's mail client loads. Insert this in the body. */
  url: string;
  created_at: string;
  [key: string]: unknown;
}

/** Query params for {@link EmailImages.list}. */
export interface ListEmailImagesParams {
  /** 1..100, default 40. */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/** Options for {@link EmailImages.upload}. */
export interface UploadEmailImageParams {
  /** The filename to send. Defaults to the `File` name, or an extensionless blob name. */
  filename?: string;
}

/**
 * The workspace image library for email bodies: upload, list, delete. Reachable as
 * `warmbly.emailImages`.
 *
 * @example
 * const img = await warmbly.emailImages.upload(file);
 * const html = `<img src="${img.url}" width="${img.width}" alt="${img.filename}">`;
 */
export class EmailImages extends APIResource {
  /**
   * Lists the library, newest first, auto-paginating when iterated. Needs `READ_CAMPAIGNS`.
   * @example
   * for await (const img of await warmbly.emailImages.list()) console.log(img.url);
   */
  list(params?: ListEmailImagesParams): Promise<Page<EmailImage>> {
    return this.http.getPage<EmailImage>("email-images", { query: params });
  }

  /**
   * Uploads an image as `multipart/form-data` (field `file`). The format is decided from
   * the bytes: PNG, JPEG, GIF or WebP only (SVG is refused), at most 5 MB and 4000 px on
   * each side. The image counts against the plan's storage quota
   * (`storage_limit_reached` when full). The bytes are public: a mail client loads them
   * with no session. Needs `WRITE_CAMPAIGNS`.
   * @example
   * const img = await warmbly.emailImages.upload(new Blob([bytes], { type: "image/png" }), {
   *   filename: "logo.png",
   * });
   */
  upload(file: Blob, params?: UploadEmailImageParams, opts?: RequestOptions): Promise<EmailImage> {
    const form = new FormData();
    // Append the filename only when there is one; a non-spec FormData would stringify an
    // explicit undefined into a file named "undefined".
    if (params?.filename !== undefined) form.append("file", file, params.filename);
    else form.append("file", file);
    return this.http.post<EmailImage>("email-images", { ...opts, body: form });
  }

  /**
   * Deletes an image (204). The bytes go with the row, so any email already sent with this
   * image loses it. Safe to retry. Needs `WRITE_CAMPAIGNS`.
   * @example
   * await warmbly.emailImages.delete("img_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("email-images", id), opts);
  }
}
