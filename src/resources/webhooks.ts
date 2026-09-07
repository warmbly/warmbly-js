import type { Page } from "../core/pagination";
import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A registered webhook endpoint. The `secret` is only present at create/rotate time. */
export interface WebhookEndpoint {
  id: string;
  organization_id?: string;
  url: string;
  description?: string;
  event_types?: string[];
  enabled?: boolean;
  verified_at?: string | null;
  ownership_confirmed?: boolean;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_failure_reason?: string | null;
  consecutive_failures?: number;
  created_at?: string;
  updated_at?: string;
  /** Only returned by create and rotate-secret. */
  secret?: string;
  [key: string]: unknown;
}

/** A single webhook delivery attempt record. */
export interface WebhookEventDelivery {
  id: string;
  endpoint_id?: string;
  organization_id?: string;
  event_type?: string;
  event_id?: string;
  status?: "pending" | "in_flight" | "delivered" | "failed" | "abandoned";
  attempt_count?: number;
  max_attempts?: number;
  next_attempt_at?: string | null;
  last_attempt_at?: string | null;
  response_status?: number | null;
  response_body_excerpt?: string | null;
  error_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * Every event Warmbly delivers to a webhook endpoint, as of this SDK release. Pass any
 * subset as `event_types`; an empty list subscribes to everything except the firehose
 * events in {@link WEBHOOK_FIREHOSE_EVENTS}, which are opt-in only.
 *
 * The live catalog — with descriptions and categories — is available at runtime via
 * {@link Webhooks.eventTypes}.
 */
export const WEBHOOK_EVENTS = [
  "email_account.connected",
  "email_account.removed",
  "email_account.disconnected",
  "email_account.error",
  "email_account.synced",
  "email_account.health_changed",

  "campaign.created",
  "campaign.updated",
  "campaign.deleted",
  "campaign.started",
  "campaign.paused",
  "campaign.completed",
  "campaign.action",
  "campaign.deliverability_warning",
  "campaign.email_sent",
  "campaign.email_delivered",
  "campaign.email_opened",
  "campaign.email_clicked",
  "campaign.email_bounced",
  "campaign.reply_received",
  "campaign.unsubscribed",

  "warmup.email_sent",
  "warmup.health_changed",
  "warmup.placement_in_spam",
  "warmup.quarantined",
  "warmup.blocked",

  "deliverability.bounce",
  "deliverability.complaint",

  "meeting.booked",
  "meeting.rescheduled",
  "meeting.canceled",

  "inbound.webhook",

  "inbox.email_received",
  "inbox.email_updated",
  "inbox.email_deleted",
  "inbox.reply_received",

  "contact.created",
  "contact.updated",
  "contact.deleted",
  "form.submitted",

  "bulk_operation.started",
  "bulk_operation.completed",
  "bulk_operation.failed",

  "automation.created",
  "automation.updated",
  "automation.deleted",
  "automation.run",

  "template.created",
  "template.updated",
  "template.deleted",

  "team.member_invited",
  "team.member_removed",
  "role.created",
  "role.updated",
  "role.deleted",

  "crm.deal_created",
  "crm.deal_updated",
  "crm.deal_deleted",
  "crm.task_created",
  "crm.task_updated",
  "crm.note_created",
  "crm.pipeline_updated",

  "lead_sync_source.updated",
  "settings.updated",
  "subscription.updated",

  "custom.event",

  /** Delivered only to the endpoint being verified or tested, never fanned out. */
  "webhook.test",
] as const;

/** A known webhook event name, e.g. `"campaign.reply_received"`. */
export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

/**
 * High-volume, per-message events. They are excluded from the empty-filter "everything"
 * subscription so a catch-all endpoint isn't buried under per-open/click traffic —
 * list one explicitly in `event_types` to receive it.
 */
export const WEBHOOK_FIREHOSE_EVENTS = [
  "campaign.email_sent",
  "campaign.email_delivered",
  "campaign.email_opened",
  "campaign.email_clicked",
  "warmup.email_sent",
  "inbox.email_received",
  "inbox.email_updated",
  "inbox.email_deleted",
  "email_account.synced",
] as const satisfies readonly WebhookEventName[];

/** An entry in the webhook event-type catalog. */
export interface WebhookEventType {
  type: WebhookEventName | string;
  category?: string;
  description?: string;
  /** Whether the event is opt-in-only high-volume traffic. */
  firehose?: boolean;
  [key: string]: unknown;
}

/** Body for creating or updating a webhook endpoint. */
export interface WebhookEndpointParams {
  url: string;
  description?: string;
  event_types?: string[];
  enabled?: boolean;
  [key: string]: unknown;
}

/** Query params for listing webhook deliveries. */
export interface ListDeliveriesParams {
  status?: "pending" | "in_flight" | "delivered" | "failed" | "abandoned";
  event_type?: string;
  /** Max rows, 1..200 (default 50). */
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

/**
 * Manage webhook endpoints and inspect their deliveries. Reachable as `warmbly.webhooks`.
 * To verify inbound delivery signatures, use the exported `verifyWebhookSignature`.
 *
 * @example
 * const ep = await warmbly.webhooks.create({
 *   url: "https://hooks.example.com/warmbly",
 *   event_types: ["campaign.reply_received"],
 * });
 * console.log(ep.secret); // shown only once
 */
export class Webhooks extends APIResource {
  /**
   * Lists webhook endpoints. Returns the `{ endpoints }` object (not a paginated list).
   * @example
   * const { endpoints } = await warmbly.webhooks.list();
   */
  list(opts?: RequestOptions): Promise<{ endpoints: WebhookEndpoint[] }> {
    return this.http.get<{ endpoints: WebhookEndpoint[] }>("webhooks", opts);
  }

  /**
   * Creates a webhook endpoint. The returned `secret` is shown only once.
   * @example
   * const ep = await warmbly.webhooks.create({ url: "https://x.example.com/hook" });
   */
  create(params: WebhookEndpointParams): Promise<WebhookEndpoint> {
    return this.http.post<WebhookEndpoint>("webhooks", { body: params });
  }

  /**
   * Returns the canonical catalog of every event type Warmbly can emit.
   * @example
   * const { event_types } = await warmbly.webhooks.eventTypes();
   */
  eventTypes(opts?: RequestOptions): Promise<{ event_types: WebhookEventType[] }> {
    return this.http.get<{ event_types: WebhookEventType[] }>("webhooks/event-types", opts);
  }

  /**
   * Lists delivery attempts across all endpoints, auto-paginating when iterated.
   * @example
   * for await (const d of await warmbly.webhooks.deliveries({ status: "failed" })) console.log(d.id);
   */
  deliveries(params?: ListDeliveriesParams): Promise<Page<WebhookEventDelivery>> {
    return this.http.getPage<WebhookEventDelivery>("webhooks/deliveries", { query: params });
  }

  /**
   * Re-enqueues a delivery by id, regardless of its current status. Returns an
   * acknowledgement (`{ status: "queued" }`), not the delivery record.
   * @example
   * const { status } = await warmbly.webhooks.redeliver("dlv_1");
   */
  redeliver(deliveryId: string, opts?: RequestOptions): Promise<{ status: string }> {
    return this.http.post<{ status: string }>(
      this.path("webhooks", "deliveries", deliveryId, "redeliver"),
      opts,
    );
  }

  /**
   * Lists events suppressed by delivery or dispatch throttles.
   * @example
   * const drops = await warmbly.webhooks.throttleDrops();
   */
  throttleDrops(params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>("webhooks/throttle-drops", { query: params });
  }

  /**
   * Updates a webhook endpoint. Send the complete desired state (`event_types` is replaced).
   * @example
   * await warmbly.webhooks.update("ep_1", { url: "https://x.example.com/hook", enabled: false });
   */
  update(id: string, params: WebhookEndpointParams): Promise<WebhookEndpoint> {
    return this.http.patch<WebhookEndpoint>(this.path("webhooks", id), { body: params });
  }

  /**
   * Deletes a webhook endpoint and its delivery history.
   * @example
   * await warmbly.webhooks.delete("ep_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete<void>(this.path("webhooks", id), opts);
  }

  /**
   * Rotates an endpoint's signing secret, returning the new `secret` once.
   * @example
   * const { secret } = await warmbly.webhooks.rotateSecret("ep_1");
   */
  rotateSecret(id: string, opts?: RequestOptions): Promise<{ secret: string }> {
    return this.http.post<{ secret: string }>(this.path("webhooks", id, "rotate-secret"), opts);
  }

  /**
   * Sends a signed challenge to verify an endpoint (also a "send a test event" trigger).
   * @example
   * await warmbly.webhooks.verify("ep_1");
   */
  verify(id: string, opts?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("webhooks", id, "verify"), opts);
  }

  /**
   * Lists delivery attempts for a single endpoint, auto-paginating when iterated.
   * @example
   * for await (const d of await warmbly.webhooks.endpointDeliveries("ep_1")) console.log(d.status);
   */
  endpointDeliveries(
    id: string,
    params?: ListDeliveriesParams,
  ): Promise<Page<WebhookEventDelivery>> {
    return this.http.getPage<WebhookEventDelivery>(this.path("webhooks", id, "deliveries"), {
      query: params,
    });
  }
}
