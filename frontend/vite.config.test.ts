import { describe, expect, it } from "vitest";

import { parseByteRange } from "./vite.config.js";

describe("parseByteRange", () => {
  it("parses explicit byte ranges", () => {
    expect(parseByteRange("bytes=100-199", 1_000)).toEqual({
      start: 100,
      end: 199,
    });
  });

  it("parses open-ended ranges", () => {
    expect(parseByteRange("bytes=900-", 1_000)).toEqual({
      start: 900,
      end: 999,
    });
  });

  it("parses suffix ranges", () => {
    expect(parseByteRange("bytes=-100", 1_000)).toEqual({
      start: 900,
      end: 999,
    });
  });

  it("returns null for invalid or unsatisfiable ranges", () => {
    expect(parseByteRange("bytes=1200-1300", 1_000)).toBeNull();
    expect(parseByteRange("items=1-2", 1_000)).toBeNull();
    expect(parseByteRange(undefined, 1_000)).toBeNull();
  });
});
