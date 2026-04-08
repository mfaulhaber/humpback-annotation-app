import { expect, test } from "@playwright/test";
import {
  disableMotion,
  openCommittedFixtureViewer,
  resizeViewer,
  waitForVisualSettled,
} from "./helpers/viewer.js";

test.skip(
  process.platform !== "darwin",
  "Committed screenshot baselines currently target macOS Chromium.",
);

test("viewer shell matches the detections desktop baseline", async ({ page }) => {
  await openCommittedFixtureViewer(page, {
    zoom: "15m",
  });
  await disableMotion(page);
  await waitForVisualSettled(page);

  await expect(page.getByTestId("timeline-viewer")).toHaveScreenshot(
    "viewer-detections-desktop.png",
  );
});

test("viewer shell matches the compact mobile layout baseline after resize", async ({
  page,
}) => {
  await openCommittedFixtureViewer(page, {
    zoom: "1h",
  });
  await disableMotion(page);
  await resizeViewer(page, {
    width: 430,
    height: 932,
  });
  await waitForVisualSettled(page);

  await expect(page.getByTestId("timeline-viewer")).toHaveScreenshot(
    "viewer-detections-mobile-shell.png",
  );
});

test("timeline stage matches the vocalizations mobile baseline", async ({ page }) => {
  await page.setViewportSize({
    width: 430,
    height: 932,
  });
  await openCommittedFixtureViewer(page, {
    overlayMode: "vocalizations",
    zoom: "5m",
  });
  await disableMotion(page);
  await waitForVisualSettled(page);

  await expect(page.getByTestId("timeline-stage")).toHaveScreenshot(
    "timeline-stage-vocalizations-mobile.png",
  );
});

test("timeline stage matches the vocalizations resized desktop baseline", async ({
  page,
}) => {
  await openCommittedFixtureViewer(page, {
    overlayMode: "vocalizations",
    zoom: "5m",
  });
  await disableMotion(page);
  await resizeViewer(page, {
    width: 430,
    height: 932,
  });
  await resizeViewer(page, {
    width: 1180,
    height: 900,
  });
  await waitForVisualSettled(page);

  await expect(page.getByTestId("timeline-stage")).toHaveScreenshot(
    "timeline-stage-vocalizations-resized-desktop.png",
  );
});
