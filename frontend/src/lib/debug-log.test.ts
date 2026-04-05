import { describe, expect, it } from "vitest";

import { matchesDebugScope, parseDebugScopes } from "./debug-log.js";

describe("debug-log", () => {
  it("parses comma-separated scopes and removes duplicates", () => {
    expect(parseDebugScopes("timeline, timeline:playback", "timeline")).toEqual(
      ["timeline", "timeline:playback"],
    );
  });

  it("matches exact and nested scopes", () => {
    expect(matchesDebugScope("timeline:playback", "timeline")).toBe(true);
    expect(matchesDebugScope("timeline:playback", "timeline:playback")).toBe(
      true,
    );
    expect(matchesDebugScope("timeline:playback", "timeline:viewport")).toBe(
      false,
    );
  });

  it("supports wildcard scopes", () => {
    expect(matchesDebugScope("timeline:playback", "*")).toBe(true);
    expect(matchesDebugScope("timeline:playback:timeupdate", "timeline:*")).toBe(
      true,
    );
  });
});
