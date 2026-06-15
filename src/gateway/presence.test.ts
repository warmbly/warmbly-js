import { describe, expect, it } from "vitest";
import { buildPresenceUpdate, PresenceTracker } from "./presence";

describe("PresenceTracker", () => {
  it("replaces the map from presence_state", () => {
    const tracker = new PresenceTracker();
    const state = tracker.applyState({
      u_1: { metas: [{ phx_ref: "r1", action: "viewing" }] },
    });
    expect(Object.keys(state)).toEqual(["u_1"]);
    expect(state.u_1?.metas[0]?.action).toBe("viewing");
  });

  it("defaults a missing metas list to an empty array", () => {
    const tracker = new PresenceTracker();
    const state = tracker.applyState({ u_1: { online_at: "now" } as Record<string, unknown> });
    expect(state.u_1?.metas).toEqual([]);
  });

  it("applies joins and leaves from presence_diff", () => {
    const tracker = new PresenceTracker();
    tracker.applyState({ u_1: { metas: [{ phx_ref: "r1" }] } });
    const state = tracker.applyDiff({
      joins: { u_2: { metas: [{ phx_ref: "r2" }] } },
      leaves: { u_1: { metas: [{ phx_ref: "r1" }] } },
    });
    expect(Object.keys(state).sort()).toEqual(["u_2"]);
  });

  it("reset clears the map", () => {
    const tracker = new PresenceTracker();
    tracker.applyState({ u_1: { metas: [] } });
    tracker.reset();
    expect(Object.keys(tracker.state)).toEqual([]);
  });

  it("returns a copy so callers cannot mutate internal state", () => {
    const tracker = new PresenceTracker();
    tracker.applyState({ u_1: { metas: [] } });
    const snapshot = tracker.state;
    delete snapshot.u_1;
    expect(Object.keys(tracker.state)).toEqual(["u_1"]);
  });
});

describe("buildPresenceUpdate", () => {
  it("drops nullish fields", () => {
    expect(
      buildPresenceUpdate({ page: "/inbox", resource: undefined, action: "replying" }),
    ).toEqual({ page: "/inbox", action: "replying" });
  });
});
