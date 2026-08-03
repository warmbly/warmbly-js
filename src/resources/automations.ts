import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/**
 * One node on the automation canvas. `type` is `"trigger"` (exactly one, with id
 * `"trigger"`), `"condition"` (an IF with true/false outgoing edges), or `"action"`.
 */
export interface AutomationNode {
  id: string;
  type: "trigger" | "condition" | "action" | string;
  /** The integration action to run. Action nodes only. */
  action?: string;
  /** The integration connection the action runs through. Action nodes only. */
  connection_id?: string | null;
  /** Action-specific configuration. */
  config?: unknown;
  /** The test to evaluate. Condition nodes only. */
  condition?: AutomationCondition | null;
  x: number;
  y: number;
  [key: string]: unknown;
}

/**
 * An IF test evaluated against the trigger event's data. `field` selects the test kind:
 * `"expression"` uses a template predicate, `"ai"` asks a plain-language yes/no question
 * (the true edge is YES, and each evaluation costs one AI credit).
 */
export interface AutomationCondition {
  field: string;
  /** The event-data key to test, for the generic `"field"` kind. */
  key?: string;
  operator?: string;
  value?: unknown;
  /** A template predicate, for the `"expression"` kind. */
  expression?: string;
  /** A yes/no question, for the `"ai"` kind. */
  prompt?: string;
  [key: string]: unknown;
}

/**
 * Connects two nodes. `when` is empty for plain edges and `"true"`/`"false"` for the two
 * outgoing edges of a condition node.
 */
export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  when?: string;
  [key: string]: unknown;
}

/** The editable flow: nodes plus the edges connecting them. */
export interface AutomationGraph {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

/** A visual automation: a trigger event plus action steps across integrations. */
export interface Automation {
  id: string;
  organization_id?: string;
  name?: string;
  enabled?: boolean;
  /** The event that fires the flow, e.g. `"inbound.webhook"`. */
  trigger_event?: string;
  /** An optional flow-wide gate applied on top of any condition nodes. */
  filter?: unknown;
  graph?: AutomationGraph;
  /**
   * The public POST URL that fires this automation. Present only when the trigger is the
   * inbound webhook; the token it carries is the credential.
   */
  inbound_url?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Body for creating or updating an automation. */
export interface AutomationParams {
  name: string;
  enabled?: boolean;
  trigger_event: string;
  filter?: unknown;
  graph: AutomationGraph;
  [key: string]: unknown;
}

/** One node's canvas coordinates. */
export interface AutomationPosition {
  id: string;
  x: number;
  y: number;
}

/** Body for {@link Automations.setLayout}: a position-only update, max 1000 entries. */
export interface AutomationLayoutParams {
  positions: AutomationPosition[];
  [key: string]: unknown;
}

/**
 * Automations: the visual flow builder — a trigger event plus action steps across
 * integrations. Reachable as `warmbly.automations`. Requires the `INTEGRATIONS` scope.
 *
 * @example
 * const flows = await warmbly.automations.list();
 * await warmbly.automations.update(flows[0]!.id, { ...flows[0]!, enabled: false } as AutomationParams);
 */
export class Automations extends APIResource {
  /**
   * Lists the organization's automations.
   * @example
   * const flows = await warmbly.automations.list();
   */
  list(params?: Record<string, unknown>): Promise<Automation[]> {
    return this.http
      .get<{ automations: Automation[] }>("automations", { query: params })
      .then((r) => r.automations ?? []);
  }

  /**
   * Creates an automation.
   * @example
   * const flow = await warmbly.automations.create({
   *   name: "Notify on reply",
   *   trigger_event: "inbox.reply_received",
   *   graph: { nodes: [], edges: [] },
   * });
   */
  create(params: AutomationParams): Promise<Automation> {
    return this.http
      .post<{ automation: Automation }>("automations", { body: params })
      .then((r) => r.automation);
  }

  /**
   * Retrieves one automation, including its full node graph.
   * @example
   * const flow = await warmbly.automations.get("auto_1");
   */
  get(id: string, opts?: RequestOptions): Promise<Automation> {
    return this.http
      .get<{ automation: Automation }>(this.path("automations", id), opts)
      .then((r) => r.automation);
  }

  /**
   * Replaces an automation. The payload is a full write, so send the whole graph — read
   * it back with {@link Automations.get} first if you only mean to change one field.
   *
   * @example
   * const flow = await warmbly.automations.get("auto_1");
   * await warmbly.automations.update("auto_1", { ...flow, enabled: false } as AutomationParams);
   */
  update(id: string, params: AutomationParams): Promise<Automation> {
    return this.http
      .patch<{ automation: Automation }>(this.path("automations", id), { body: params })
      .then((r) => r.automation);
  }

  /**
   * Persists node coordinates without rewriting the graph's logic, and without bumping
   * `updated_at`. Last-write-wins, so retries are safe. Up to 1000 positions per call.
   *
   * @example
   * await warmbly.automations.setLayout("auto_1", { positions: [{ id: "trigger", x: 0, y: 0 }] });
   */
  setLayout(id: string, params: AutomationLayoutParams): Promise<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(this.path("automations", id, "layout"), {
      body: params,
    });
  }

  /**
   * Deletes an automation. Returns `409 Conflict` when campaign steps still reference it.
   * @example
   * await warmbly.automations.delete("auto_1");
   */
  delete(id: string, opts?: RequestOptions): Promise<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(this.path("automations", id), opts);
  }

  /**
   * Runs the automation against sample (or supplied) data without side effects, and
   * returns the path taken plus a per-action preview.
   *
   * @example
   * const result = await warmbly.automations.test("auto_1", { data: { email: "a@b.com" } });
   */
  test(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.path("automations", id, "test"), {
      body: params,
    });
  }

  /**
   * Lists an automation's run history.
   * @example
   * const runs = await warmbly.automations.runs("auto_1", { limit: 20 });
   */
  runs(id: string, params?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return this.http
      .get<{ runs: Record<string, unknown>[] }>(this.path("automations", id, "runs"), {
        query: params,
      })
      .then((r) => r.runs ?? []);
  }
}
