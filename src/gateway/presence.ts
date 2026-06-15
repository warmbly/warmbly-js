/**
 * Presence tracking for the org channel. Applies `presence_state` (a full map) and
 * `presence_diff` (joins/leaves) into a {@link PresenceState}, and builds the outbound
 * `presence:update` payload. API-key connections receive presence but are never tracked.
 */

import type { PresenceDiff, PresenceEntry, PresenceState, PresenceUpdate } from "./types";

/**
 * Accumulates the org channel presence map from `presence_state` and `presence_diff` frames.
 *
 * @example
 * const tracker = new PresenceTracker();
 * tracker.applyState(statePayload);
 * tracker.applyDiff(diffPayload);
 * const online = Object.keys(tracker.state).length;
 */
export class PresenceTracker {
  private current: PresenceState = {};

  /** A shallow copy of the current presence map. */
  get state(): PresenceState {
    return { ...this.current };
  }

  /** Replaces the map wholesale from a `presence_state` payload. Returns the new state. */
  applyState(payload: PresenceState | Record<string, unknown>): PresenceState {
    this.current = normalizeState(payload);
    return this.state;
  }

  /** Applies a `presence_diff` payload's joins and leaves. Returns the updated state. */
  applyDiff(payload: PresenceDiff | Record<string, unknown>): PresenceState {
    const diff = payload as Partial<PresenceDiff>;
    const joins = normalizeState(diff.joins ?? {});
    const leaves = normalizeState(diff.leaves ?? {});
    const next: PresenceState = { ...this.current };

    for (const key of Object.keys(leaves)) {
      delete next[key];
    }
    for (const [key, entry] of Object.entries(joins)) {
      next[key] = entry;
    }

    this.current = next;
    return this.state;
  }

  /** Clears all presence, e.g. after a socket close. */
  reset(): void {
    this.current = {};
  }
}

/** Coerces an arbitrary object into a {@link PresenceState}, defaulting `metas` to `[]`. */
function normalizeState(payload: Record<string, unknown>): PresenceState {
  const out: PresenceState = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value && typeof value === "object") {
      const entry = value as Partial<PresenceEntry>;
      out[key] = {
        ...(value as PresenceEntry),
        metas: Array.isArray(entry.metas) ? entry.metas : [],
      };
    }
  }
  return out;
}

/** The Phoenix event name used to push a presence update. */
export const PRESENCE_UPDATE_EVENT = "presence:update";

/**
 * Builds the payload for a `presence:update` push, dropping nullish fields.
 *
 * @example
 * const payload = buildPresenceUpdate({ page: "/inbox", action: "replying" });
 * // { page: "/inbox", action: "replying" }
 */
export function buildPresenceUpdate(update: PresenceUpdate): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined && value !== null) payload[key] = value;
  }
  return payload;
}
