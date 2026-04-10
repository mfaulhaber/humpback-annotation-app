import { expect, test } from "@playwright/test";
import {
  committedFixtureDefaultOverlayMode,
  committedFixtureDefaultTimecode,
  committedFixtureDefaultZoom,
  committedFixtureJobId,
  committedFixtureQueryOverrideOverlayMode,
  committedFixtureQueryOverrideTimecode,
  committedFixtureQueryOverrideTimestamp,
  committedFixtureQueryOverrideZoom,
} from "./helpers/export-root.js";
import {
  openIndex,
  readActiveZoom,
  readTimecode,
  waitForViewerStable,
} from "./helpers/viewer.js";

test("index page link includes the committed viewer defaults as query params", async ({
  page,
}) => {
  await openIndex(page);

  const timelineLink = page.locator("[data-testid='timeline-index-grid'] a").first();

  await expect(timelineLink).toHaveAttribute(
    "href",
    `/${committedFixtureJobId}?starting_pos=1635473100&zoom_level=${committedFixtureDefaultZoom}&view_mode=${committedFixtureDefaultOverlayMode}`,
  );
});

test("viewer applies the committed index defaults on a direct job route load", async ({
  page,
}) => {
  await page.goto(`/${committedFixtureJobId}`);
  await waitForViewerStable(page);

  await expect(page.getByTestId("timeline-viewer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Vocalizations", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Detections", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await readActiveZoom(page)).toBe(committedFixtureDefaultZoom);
  expect(await readTimecode(page)).toBe(committedFixtureDefaultTimecode);
});

test("query params override the committed index defaults on direct job route load", async ({
  page,
}) => {
  await page.goto(
    `/${committedFixtureJobId}?starting_pos=${committedFixtureQueryOverrideTimestamp}&zoom_level=${committedFixtureQueryOverrideZoom}&view_mode=${committedFixtureQueryOverrideOverlayMode}`,
  );
  await waitForViewerStable(page);

  await expect(page.getByTestId("timeline-viewer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Vocalizations", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Detections", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await readActiveZoom(page)).toBe(committedFixtureQueryOverrideZoom);
  expect(await readTimecode(page)).toBe(committedFixtureQueryOverrideTimecode);
});
