import type { ListResponse, PaginationMeta } from "./types";

/** Fetches the page that follows a given cursor. */
export type PageFetcher<T> = (cursor: string) => Promise<Page<T>>;

/**
 * A single page of a cursor-paginated list that is also an async-iterable over the
 * full result set: iterating transparently fetches subsequent pages.
 *
 * @example
 * // Iterate every contact, fetching pages on demand.
 * for await (const contact of await warmbly.contacts.list()) {
 *   console.log(contact.email);
 * }
 *
 * @example
 * // Or page manually.
 * let page = await warmbly.contacts.list();
 * console.log(page.data, page.pagination.next_cursor);
 * if (page.hasNextPage()) page = (await page.nextPage())!;
 */
export class Page<T> implements AsyncIterable<T> {
  /** Items in this page. */
  readonly data: T[];
  /** Pagination metadata for this page. */
  readonly pagination: PaginationMeta;

  private readonly fetchNext: PageFetcher<T> | undefined;

  constructor(response: ListResponse<T>, fetchNext?: PageFetcher<T>) {
    this.data = response.data ?? [];
    this.pagination = response.pagination ?? {
      total: null,
      next_cursor: null,
      has_more: false,
    };
    this.fetchNext = fetchNext;
  }

  /** Whether another page can be fetched. */
  hasNextPage(): boolean {
    return Boolean(this.pagination.has_more && this.pagination.next_cursor && this.fetchNext);
  }

  /** Fetches the next page, or `null` if this is the last one. */
  async nextPage(): Promise<Page<T> | null> {
    if (!this.pagination.next_cursor || !this.fetchNext) return null;
    if (!this.pagination.has_more) return null;
    return this.fetchNext(this.pagination.next_cursor);
  }

  /** Async-iterates over each page object, starting with this one. */
  async *pages(): AsyncGenerator<Page<T>, void, unknown> {
    let page: Page<T> | null = this;
    while (page) {
      yield page;
      page = await page.nextPage();
    }
  }

  /** Async-iterates over every item across every page. */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for await (const page of this.pages()) {
      for (const item of page.data) {
        yield item;
      }
    }
  }

  /** Collects every item across every page into an array. Be mindful of large result sets. */
  async toArray(): Promise<T[]> {
    const all: T[] = [];
    for await (const item of this) {
      all.push(item);
    }
    return all;
  }
}
