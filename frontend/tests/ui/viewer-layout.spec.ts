import { expect, test } from "@playwright/test";
import {
  expectLocatorToHaveBox,
  expectNoHorizontalOverflow,
} from "./helpers/assertions.js";
import {
  openCommittedFixtureViewer,
  openIndex,
  readViewerGeometry,
} from "./helpers/viewer.js";

test("index page renders the committed fixture card grid without horizontal overflow", async ({
  page,
}) => {
  await openIndex(page);

  const cardGrid = page.getByTestId("timeline-index-grid");

  await expect(cardGrid).toBeVisible();
  await expect(cardGrid.locator("a")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
});

test("viewer layout keeps the header, stage, and controls inside the viewer shell", async ({
  page,
}) => {
  await openCommittedFixtureViewer(page, {
    zoom: "1h",
  });

  const viewer = page.getByTestId("timeline-viewer");
  const header = page.getByTestId("timeline-viewer-header");
  const stage = page.getByTestId("timeline-stage");
  const controls = page.getByTestId("timeline-controls");
  const track = page.getByTestId("timeline-track");
  const canvas = page.getByTestId("timeline-track-canvas");
  const geometry = await readViewerGeometry(page);

  await expectLocatorToHaveBox(viewer, "timeline viewer");
  await expectLocatorToHaveBox(header, "viewer header");
  await expectLocatorToHaveBox(stage, "timeline stage");
  await expectLocatorToHaveBox(controls, "timeline controls");
  await expectLocatorToHaveBox(track, "timeline track");
  await expectLocatorToHaveBox(canvas, "timeline canvas");
  await expectNoHorizontalOverflow(page);

  expect(geometry.viewer.top).toBeGreaterThanOrEqual(geometry.shell.top);
  expect(geometry.viewer.bottom).toBeLessThanOrEqual(geometry.shell.bottom + 1);
  expect(geometry.header.bottom).toBeLessThanOrEqual(geometry.stage.top + 20);
  expect(geometry.stage.bottom).toBeLessThanOrEqual(geometry.controls.top + 20);
  expect(geometry.controls.bottom).toBeLessThanOrEqual(geometry.viewer.bottom + 1);
  expect(geometry.track.width).toBeGreaterThan(0);
  expect(geometry.canvas.width).toBeGreaterThan(0);
});
