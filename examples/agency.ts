/**
 * Agency API keys.
 * One `wmagency_...` key reaches the agency's own endpoints and every client workspace.
 * Lists the clients, reads the shared send pool, walks the cross-client inbox, caps a
 * client, moves AI balance into it, and acts inside a client workspace with
 * `withOrganization`.
 *
 * Needs an agency key with AGENCY_READ, AGENCY_READ_USAGE, AGENCY_MANAGE_CLIENTS,
 * AGENCY_TRANSFER_AI, READ_UNIBOX and READ_CAMPAIGNS.
 * Run with: WARMBLY_AGENCY_KEY=wmagency_... npx tsx examples/agency.ts
 */
import { ERROR_CODES, Warmbly, WarmblyAPIError } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_AGENCY_KEY });

// An agency key sees only its own agency.
const { data: agencies } = await warmbly.agency.list();
const agency = agencies[0];
if (!agency) throw new Error("This key belongs to no agency.");
const agencyId = agency.id;

// The shared send pool this period.
const usage = await warmbly.agency.usage(agencyId);
console.log(`pool: ${usage.used}/${usage.total} used, ${usage.days_left} days left`);

// Every client workspace, each with its caps.
const clients = await warmbly.agency.clients.list(agencyId);
for (const client of clients) {
  console.log(client.name, client.organization_id, client.monthly_send_limit ?? "no cap");
}

// Conversations across every client, newest first, auto-paginating.
for await (const thread of await warmbly.agency.inbox.list(agencyId, {
  needs_reply: true,
  limit: 30,
})) {
  console.log(thread.organization_id, thread.subject);
}

const first = clients[0];
if (first) {
  // Cap the client's sends per period (null removes the cap).
  await warmbly.agency.clients.update(agencyId, first.organization_id, {
    monthly_send_limit: 20_000,
  });

  // Move $25 of AI balance into the client. Reuse the same idempotency key on a retry so
  // the money moves once.
  try {
    const moved = await warmbly.agency.clients.transferAI(
      agencyId,
      first.organization_id,
      { amount_usd: 25 },
      { idempotencyKey: `topup-${first.organization_id}-2026-11` },
    );
    console.log("agency balance left:", moved.agency_balance_usd);
  } catch (err) {
    if (err instanceof WarmblyAPIError && err.code === ERROR_CODES.AGENCY_AI_BALANCE_INSUFFICIENT) {
      console.log("Not enough AI balance in the agency.");
    } else {
      throw err;
    }
  }

  // Workspace routes take the client in the Warmbly-Organization header. withOrganization
  // returns a client that sends it on every request.
  const workspace = warmbly.withOrganization(first.organization_id);
  for await (const campaign of await workspace.campaigns.list()) {
    console.log(first.name, campaign.name, campaign.status);
  }
}
