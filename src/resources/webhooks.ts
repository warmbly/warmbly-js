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

/** An entry in the webhook event-type catalog. */
export interface WebhookEventType {
  type: string;
  category?: string;
  description?: string;
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
   * Re-enqueues a delivery by id, regardless of its current status.
   * @example
   * await warmbly.webhooks.redeliver("dlv_1");
   */
  redeliver(deliveryId: string, opts?: RequestOptions): Promise<WebhookEventDelivery> {
    return this.http.post<WebhookEventDelivery>(
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
