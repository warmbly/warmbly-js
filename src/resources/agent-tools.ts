import type { RequestOptions } from "../core/types";
import { APIResource } from "./base";

/** A JSON Schema object describing a tool's arguments. */
export type JsonSchema = Record<string, unknown>;

/** A tool in Warmbly's native manifest format (`format=warmbly`, the default). */
export interface AgentTool {
  name: string;
  description: string;
  input_schema: JsonSchema;
  [key: string]: unknown;
}

/**
 * A tool in OpenAI function-calling format (`format=openai`, or its aliases `hermes`
 * and `functions`). Drops straight into a `tools` array or a Hermes `<tools>` block.
 */
export interface OpenAIFunctionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** The result of {@link AgentTools.call}. */
export interface AgentToolResult<T = unknown> {
  name: string;
  /** The tool's output, decoded as JSON when it is JSON, otherwise the raw string. */
  result: T;
  [key: string]: unknown;
}

/**
 * The AI tool registry over plain HTTP, for function-calling agents that do not speak
 * MCP. There is no route-level scope: each tool enforces its own permission, the list
 * only shows what the caller may use, and send-class tools are never exposed. Reachable
 * as `warmbly.agentTools`.
 *
 * @example
 * const tools = await warmbly.agentTools.list({ format: "openai" });
 * // ...hand `tools` to the model; when it emits a call:
 * const { result } = await warmbly.agentTools.call("list_threads", { folder: "inbox", limit: 10 });
 */
export class AgentTools extends APIResource {
  /**
   * Lists the tools the caller's credentials allow, in Warmbly's native format.
   * @example
   * const tools = await warmbly.agentTools.list();
   */
  list(params?: { format?: "warmbly" }, opts?: RequestOptions): Promise<AgentTool[]>;
  /**
   * Lists the tools in OpenAI function-calling format (`hermes` and `functions` are aliases).
   * @example
   * const tools = await warmbly.agentTools.list({ format: "hermes" });
   */
  list(
    params: { format: "openai" | "hermes" | "functions" },
    opts?: RequestOptions,
  ): Promise<OpenAIFunctionTool[]>;
  list(
    params?: { format?: "warmbly" | "openai" | "hermes" | "functions" },
    opts?: RequestOptions,
  ): Promise<AgentTool[] | OpenAIFunctionTool[]> {
    return this.http
      .get<{ data: AgentTool[] | OpenAIFunctionTool[] }>("ai/tools", { ...opts, query: params })
      .then((r) => r.data ?? []);
  }

  /**
   * Executes one tool with the JSON argument object the model produced. An unknown
   * tool is a 404, a tool the credential lacks the scope for a 403, and a tool-level
   * failure a 422 whose message is meant for the model to read.
   * @example
   * const { result } = await warmbly.agentTools.call("search_contacts", { query: "acme" });
   */
  call<T = unknown>(
    name: string,
    args?: Record<string, unknown>,
    opts?: RequestOptions,
  ): Promise<AgentToolResult<T>> {
    return this.http
      .post<{ data: AgentToolResult<T> }>(this.path("ai", "tools", name, "call"), {
        ...opts,
        body: args ?? {},
      })
      .then((r) => r.data);
  }
}
