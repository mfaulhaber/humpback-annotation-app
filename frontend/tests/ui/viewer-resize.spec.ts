import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectWithinTolerance,
} from "./helpers/assertions.js";
import {
  openCommittedFixtureViewer,
  readViewerGeometry,
  resizeViewer,
} from "./helpers/viewer.js";

const resizeSequence = [
  { width: 1440, height: 960 },
  { width: 1180, height: 900 },
  { width: 820, height: 1180 },
  { width: 430, height: 932 },
  { width: 1440, height: 960 },
] as const;

test("viewer stays visible and aligned through the responsive resize sequence", async ({
  page,
}) => {
  await openCommittedFixtureViewer(page, {
    overlayMode: "vocalizations",
    zoom: "5m",
  });

  const trackWidths: number[] = [];

  for (const viewport of resizeSequence) {
    await resizeViewer(page, viewport);
    await expectNoHorizontalOverflow(page);

    const geometry = await readViewerGeometry(page);
    const playheadCenter = geometry.playhead.left + geometry.playhead.width / 2;
    const trackCenter = geometry.track.left + geometry.track.width / 2;

    expect(geometry.stage.height).toBeGreaterThan(0);
    expect(geometry.track.width).toBeGreaterThan(0);
    expect(geometry.confidenceStrip.width).toBeGreaterThan(0);
    expect(geometry.axis.width).toBeGreaterThan(0);
    expect(geometry.canvas.right).toBeLessThanOrEqual(geometry.track.right + 1);

    expectWithinTolerance(
      playheadCenter,
      trackCenter,
      2,
      "playhead center alignment",
    );
    expectWithinTolerance(
      geometry.confidenceStrip.width,
      geometry.track.width,
      4,
      "confidence strip width alignment",
    );
    expectWithinTolerance(
      geometry.axis.width,
      geometry.track.width,
      4,
      "axis width alignment",
    );

    trackWidths.push(geometry.track.width);
  }

  expect(trackWidths[0]).toBeGreaterThan(trackWidths[3] ?? 0);
  expect(trackWidths[1]).toBeGreaterThan(trackWidths[3] ?? 0);
  expectWithinTolerance(
    trackWidths[0] ?? 0,
    trackWidths[4] ?? 0,
    6,
    "desktop width after expanding back",
  );
});
