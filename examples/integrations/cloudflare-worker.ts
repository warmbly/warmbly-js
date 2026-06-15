/**
 * Cloudflare Worker using the Warmbly client at the edge.
 *
 * The SDK is built on web standards (fetch, Web Crypto), so it runs on Workers
 * with no Node shims. The API key comes from the Worker's env bindings, not
 * process.env, and a fresh client is created per request to stay stateless.
 *
 * This file is illustrative and is NOT typechecked. It uses Worker globals.
 *
 * Setup (wrangler.toml):
 *   name = "warmbly-edge"
 *   main = "examples/integrations/cloudflare-worker.ts"
 *   # set the secret with: wrangler secret put WARMBLY_API_KEY
 */
import { Warmbly } from "warmbly";

export default {
  async fetch(request, env) {
    // Build a client per request; env.WARMBLY_API_KEY is the Worker secret.
    const warmbly = new Warmbly({ apiKey: env.WARMBLY_API_KEY });

    // GET /campaigns -> return the first page of campaigns as JSON.
    const url = new URL(request.url);
    if (url.pathname === "/campaigns") {
      // List methods return a Page; .data is the current page of records and
      // .pagination.next_cursor lets a caller request the following page.
      const page = await warmbly.campaigns.list({ limit: 25 });

      return Response.json({
        campaigns: page.data,
        nextCursor: page.pagination.next_cursor,
      });
    }

    return new Response("not found", { status: 404 });
  },
};
