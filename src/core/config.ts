import {
  DEFAULT_API_BASE_URL,
  DEFAULT_APP_BASE_URL,
  DEFAULT_GATEWAY_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
} from "./constants";
import { resolveFetch } from "./fetch";
import type { ClientOptions, ResolvedClientOptions } from "./types";

function stripTrailingSlash(url: string): string {
  // Index math instead of /\/+$/ to avoid a polynomial-ReDoS pattern on long input.
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47) end -= 1;
  return url.slice(0, end);
}

/**
 * Applies defaults to user-supplied {@link ClientOptions} and normalizes the auth
 * strategy into a single async `getToken` resolver.
 */
export function resolveClientOptions(options: ClientOptions = {}): ResolvedClientOptions {
  const staticToken = options.apiKey ?? options.accessToken;
  const tokenResolver = options.getToken;

  const getToken: () => Promise<string | undefined> = tokenResolver
    ? async () => tokenResolver()
    : async () => staticToken;

  return {
    baseUrl: stripTrailingSlash(options.baseUrl ?? DEFAULT_API_BASE_URL),
    appBaseUrl: stripTrailingSlash(options.appBaseUrl ?? DEFAULT_APP_BASE_URL),
    gatewayUrl: stripTrailingSlash(options.gatewayUrl ?? DEFAULT_GATEWAY_URL),
    organizationId: options.organizationId,
    fetch: resolveFetch(options.fetch),
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    defaultHeaders: options.defaultHeaders ?? {},
    getToken,
  };
}
