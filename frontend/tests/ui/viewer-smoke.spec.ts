import { expect, test } from "@playwright/test";
import {
  expectLocatorToHaveBox,
  expectNoHorizontalOverflow,
} from "./helpers/assertions.js";
import {
  openIndex,
  readViewerGeometry,
  resizeViewer,
  waitForViewerStable,
} from "./helpers/viewer.js";

test("external export root opens the first timeline viewer without layout clipping", async ({
  page,
}) => {
  await openIndex(page);

  const firstTimelineLink = page.locator("[data-testid='timeline-index-grid'] a").first();

  await expect(firstTimelineLink).toBeVisible();
  await firstTimelineLink.click();
  await waitForViewerStable(page);
  await resizeViewer(page, {
    width: 1180,
    height: 900,
  });

  const geometry = await readViewerGeometry(page);

  await expectLocatorToHaveBox(page.getByTestId("timeline-track"), "timeline track");
  await expectNoHorizontalOverflow(page);
  expect(geometry.track.width).toBeGreaterThan(0);
  expect(geometry.stage.height).toBeGreaterThan(0);
});
