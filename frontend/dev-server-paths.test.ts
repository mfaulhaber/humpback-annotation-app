import { describe, expect, it } from "vitest";

import { resolvePathWithinRoot } from "./dev-server-paths.js";

describe("resolvePathWithinRoot", () => {
  it("resolves files inside the configured root", () => {
    expect(
      resolvePathWithinRoot("/tmp/export", "8224c4a6-bc36-43db-ad59-e8933ef09115/manifest.json"),
    ).toBe("/tmp/export/8224c4a6-bc36-43db-ad59-e8933ef09115/manifest.json");
  });

  it("rejects sibling-path escapes even when the string prefix overlaps", () => {
    expect(
      resolvePathWithinRoot("/tmp/export", "../export-sibling/secret.txt"),
    ).toBeNull();
  });

  it("rejects broader parent traversal outside the export root", () => {
    expect(resolvePathWithinRoot("/tmp/export", "../../etc/passwd")).toBeNull();
  });
});
