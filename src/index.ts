/**
 * warmbly: the official Warmbly SDK for JavaScript and TypeScript.
 *
 * Three pillars from one entry point:
 * - a typed REST client (`new Warmbly({ apiKey })`),
 * - an OAuth2 authorization-code helper (`new Warmbly.OAuth({ clientId, ... })`),
 * - a realtime gateway client (`warmbly.gateway({ orgId })`).
 *
 * @packageDocumentation
 */

// Top-level client.
export { default, Warmbly, Warmbly as WarmblyClient } from "./client";
export { resolveClientOptions } from "./core/config";

// Core: errors, shared types, pagination, the HTTP client, and option resolution.
export * from "./core/errors";
export type { HttpResponse } from "./core/http";
export { HttpClient } from "./core/http";
export type { PageFetcher } from "./core/pagination";
export { Page } from "./core/pagination";
export type * from "./core/types";
export * from "./gateway";
// Pillars.
export * from "./oauth";
// Permissions and OAuth scopes.
export * from "./permissions";
export * from "./resources";
// Version.
export { VERSION } from "./version";
export * from "./webhooks";
