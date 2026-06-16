import { describe, expect, it, vi } from "vitest";
import { Page } from "./pagination";
import type { ListResponse, PaginationMeta } from "./types";

interface Contact {
  email: string;
}

function meta(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  return { total: null, next_cursor: null, has_more: false, ...overrides };
}

function response(data: Contact[], pagination?: PaginationMeta): ListResponse<Contact> {
  return { data, pagination: pagination ?? meta() };
}

describe("Page", () => {
  describe("constructor", () => {
    it("exposes data and pagination from the response", () => {
      const pagination = meta({ total: 2, next_cursor: "abc", has_more: true });
      const page = new Page<Contact>(response([{ email: "ada@warmbly.com" }], pagination));
      expect(page.data).toEqual([{ email: "ada@warmbly.com" }]);
      expect(page.pagination).toEqual(pagination);
    });

    it("defaults data to an empty array when missing", () => {
      const page = new Page<Contact>({
        data: undefined as unknown as Contact[],
        pagination: meta(),
      });
      expect(page.data).toEqual([]);
    });

    it("defaults pagination when missing", () => {
      const page = new Page<Contact>({
        data: [{ email: "grace@warmbly.com" }],
        pagination: undefined as unknown as PaginationMeta,
      });
      expect(page.pagination).toEqual({ total: null, next_cursor: null, has_more: false });
    });
  });

  describe("hasNextPage", () => {
    it("returns true when has_more, next_cursor, and a fetcher are present", () => {
      const page = new Page<Contact>(
        response([], meta({ next_cursor: "c1", has_more: true })),
        vi.fn(),
      );
      expect(page.hasNextPage()).toBe(true);
    });

    it("returns false when has_more is false", () => {
      const page = new Page<Contact>(
        response([], meta({ next_cursor: "c1", has_more: false })),
        vi.fn(),
      );
      expect(page.hasNextPage()).toBe(false);
    });

    it("returns false when next_cursor is null", () => {
      const page = new Page<Contact>(
        response([], meta({ next_cursor: null, has_more: true })),
        vi.fn(),
      );
      expect(page.hasNextPage()).toBe(false);
    });

    it("returns false when there is no fetcher", () => {
      const page = new Page<Contact>(response([], meta({ next_cursor: "c1", has_more: true })));
      expect(page.hasNextPage()).toBe(false);
    });
  });

  describe("nextPage", () => {
    it("calls the fetcher with the next cursor and returns the next Page", async () => {
      const second = new Page<Contact>(response([{ email: "linus@warmbly.com" }]));
      const fetchNext = vi.fn(async () => second);
      const page = new Page<Contact>(
        response([{ email: "ada@warmbly.com" }], meta({ next_cursor: "cursor-2", has_more: true })),
        fetchNext,
      );

      const result = await page.nextPage();
      expect(fetchNext).toHaveBeenCalledWith("cursor-2");
      expect(result).toBe(second);
    });

    it("returns null when next_cursor is null", async () => {
      const fetchNext = vi.fn();
      const page = new Page<Contact>(
        response([], meta({ next_cursor: null, has_more: true })),
        fetchNext,
      );
      expect(await page.nextPage()).toBeNull();
      expect(fetchNext).not.toHaveBeenCalled();
    });

    it("returns null when there is no fetcher", async () => {
      const page = new Page<Contact>(response([], meta({ next_cursor: "c1", has_more: true })));
      expect(await page.nextPage()).toBeNull();
    });

    it("returns null when has_more is false even if a cursor is present", async () => {
      const fetchNext = vi.fn();
      const page = new Page<Contact>(
        response([], meta({ next_cursor: "c1", has_more: false })),
        fetchNext,
      );
      expect(await page.nextPage()).toBeNull();
      expect(fetchNext).not.toHaveBeenCalled();
    });
  });

  describe("pages", () => {
    it("yields each page in order, starting with this one", async () => {
      const third = new Page<Contact>(response([{ email: "marie@warmbly.com" }]));
      const second = new Page<Contact>(
        response([{ email: "linus@warmbly.com" }], meta({ next_cursor: "c3", has_more: true })),
        async () => third,
      );
      const first = new Page<Contact>(
        response([{ email: "ada@warmbly.com" }], meta({ next_cursor: "c2", has_more: true })),
        async () => second,
      );

      const collected: Page<Contact>[] = [];
      for await (const page of first.pages()) {
        collected.push(page);
      }
      expect(collected).toEqual([first, second, third]);
    });

    it("yields only the current page when there is no next page", async () => {
      const only = new Page<Contact>(response([{ email: "ada@warmbly.com" }]));
      const collected: Page<Contact>[] = [];
      for await (const page of only.pages()) {
        collected.push(page);
      }
      expect(collected).toEqual([only]);
    });
  });

  describe("async iteration", () => {
    it("walks every item across multiple pages via the fetcher", async () => {
      const second = new Page<Contact>(
        response([{ email: "linus@warmbly.com" }, { email: "marie@warmbly.com" }]),
      );
      const fetchNext = vi.fn(async (cursor: string) => {
        expect(cursor).toBe("next");
        return second;
      });
      const first = new Page<Contact>(
        response([{ email: "ada@warmbly.com" }], meta({ next_cursor: "next", has_more: true })),
        fetchNext,
      );

      const emails: string[] = [];
      for await (const contact of first) {
        emails.push(contact.email);
      }
      expect(emails).toEqual(["ada@warmbly.com", "linus@warmbly.com", "marie@warmbly.com"]);
      expect(fetchNext).toHaveBeenCalledTimes(1);
    });

    it("iterates a single page with no fetcher", async () => {
      const page = new Page<Contact>(
        response([{ email: "ada@warmbly.com" }, { email: "grace@warmbly.com" }]),
      );
      const emails: string[] = [];
      for await (const contact of page) {
        emails.push(contact.email);
      }
      expect(emails).toEqual(["ada@warmbly.com", "grace@warmbly.com"]);
    });
  });

  describe("toArray", () => {
    it("collects every item across every page", async () => {
      const third = new Page<Contact>(response([{ email: "marie@warmbly.com" }]));
      const second = new Page<Contact>(
        response([{ email: "linus@warmbly.com" }], meta({ next_cursor: "c3", has_more: true })),
        async () => third,
      );
      const first = new Page<Contact>(
        response([{ email: "ada@warmbly.com" }], meta({ next_cursor: "c2", has_more: true })),
        async () => second,
      );

      expect(await first.toArray()).toEqual([
        { email: "ada@warmbly.com" },
        { email: "linus@warmbly.com" },
        { email: "marie@warmbly.com" },
      ]);
    });

    it("returns an empty array when the only page has no data", async () => {
      const page = new Page<Contact>(response([]));
      expect(await page.toArray()).toEqual([]);
    });
  });
});
