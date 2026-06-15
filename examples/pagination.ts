/**
 * Pagination patterns: the three ways to walk a cursor-paginated list endpoint.
 * List methods return a `Page`, which is async-iterable and also exposes manual
 * page-by-page controls. This file demonstrates all three approaches.
 *
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/pagination.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// ---------------------------------------------------------------------------
// 1) for-await over the Page.
// Iterating a Page transparently fetches each subsequent page on demand, so you
// see every record across every page without ever touching a cursor yourself.
// This is the recommended default: it streams items and never holds more than
// one page in memory at a time.
// ---------------------------------------------------------------------------
let seen = 0;
// `list()` returns a Promise<Page>, so await it first, then iterate the Page.
for await (const contact of await warmbly.contacts.list({ limit: 50 })) {
  // `contact` is a single Contact; the loop pulls the next page when this one runs out.
  console.log(contact.id, contact.email);
  seen += 1;
}
console.log(`iterated ${seen} contacts across all pages`);

// ---------------------------------------------------------------------------
// 2) Manual page-by-page with hasNextPage() / nextPage().
// Use this when you want explicit control over each page, for example to render
// a "load more" button, checkpoint a cursor, or stop early on a condition.
// ---------------------------------------------------------------------------
let page = await warmbly.contacts.list({ limit: 50 });
let pageNumber = 1;
for (;;) {
  // `page.data` is this page's records; `page.pagination` carries the cursor metadata.
  console.log(`page ${pageNumber}: ${page.data.length} contacts`);
  console.log("  total:", page.pagination.total, "next_cursor:", page.pagination.next_cursor);

  // Stop when the server reports no further pages.
  if (!page.hasNextPage()) break;

  // nextPage() fetches the following page; it returns null only on the last page,
  // which hasNextPage() already guarded against, so this is safe to use here.
  const next = await page.nextPage();
  if (next === null) break;
  page = next;
  pageNumber += 1;
}

// ---------------------------------------------------------------------------
// 3) toArray() to collect everything into a single array.
// CAUTION: this eagerly fetches and buffers EVERY record across EVERY page into
// memory. Only do this for small, bounded result sets (for example, a filtered
// query you know returns a handful of rows). For large collections, prefer the
// for-await stream in approach 1 so you process one page at a time.
// ---------------------------------------------------------------------------
const recentCampaigns = await warmbly.campaigns
  .list({ status: "active", limit: 100 })
  .then((p) => p.toArray());
console.log(`collected ${recentCampaigns.length} active campaigns into an array`);
