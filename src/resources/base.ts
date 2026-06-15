import type { HttpClient } from "../core/http";

/**
 * Base class shared by every REST resource. It holds the {@link HttpClient} every
 * resource talks through and provides a small helper for building encoded paths.
 *
 * @example
 * class Widgets extends APIResource {
 *   get(id: string) {
 *     return this.http.get(this.path("widgets", id));
 *   }
 * }
 */
export abstract class APIResource {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Joins path segments into a request path, URL-encoding each dynamic segment so
   * ids with reserved characters are escaped. Pass a leading empty string to keep a
   * leading slash if needed.
   *
   * @example
   * this.path("campaigns", id, "steps"); // "campaigns/<encoded id>/steps"
   */
  protected path(...segments: Array<string | number>): string {
    return segments.map((segment) => encodeURIComponent(String(segment))).join("/");
  }
}
