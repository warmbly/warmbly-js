/**
 * CommonJS usage of the Warmbly SDK.
 *
 * The package ships both ESM and CommonJS builds, so require() works in plain
 * .cjs files and in CommonJS projects. This mirrors the ESM quick start but
 * uses require and an async main function instead of top-level await.
 *
 * This file is illustrative and is NOT typechecked.
 *
 * Run with: WARMBLY_API_KEY=wmbly_... node examples/runtimes/node-cjs.cjs
 */
const { Warmbly, NotFoundError } = require("warmbly");

async function main() {
  // process.env works the same as in ESM; apiKey is optional on the client.
  const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

  // Auto-paginate: for-await over a list fetches each page on demand.
  for await (const campaign of await warmbly.campaigns.list({ limit: 50 })) {
    console.log(campaign.id, campaign.name, campaign.status);
  }

  // Typed errors are exported from the same require() call.
  try {
    await warmbly.campaigns.get("does-not-exist");
  } catch (err) {
    if (err instanceof NotFoundError) {
      console.log("no such campaign");
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
