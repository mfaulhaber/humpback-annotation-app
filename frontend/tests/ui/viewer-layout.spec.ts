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

test("viewer exits drag mode when the pointer returns with the mouse button released", async ({
  page,
}) => {
  await openCommittedFixtureViewer(page, {
    zoom: "1h",
  });

  const track = page.getByTestId("timeline-track");
  const timecode = page.getByTestId("timeline-timecode");
  const box = await track.boundingBox();

  expect(box).not.toBeNull();

  const startX = (box?.x ?? 0) + (box?.width ?? 0) * 0.7;
  const dragX = (box?.x ?? 0) + (box?.width ?? 0) * 0.35;
  const releaseX = (box?.x ?? 0) + (box?.width ?? 0) * 0.2;
  const laterX = (box?.x ?? 0) + (box?.width ?? 0) * 0.85;
  const y = (box?.y ?? 0) + (box?.height ?? 0) * 0.5;
  const initialTimecode = await timecode.innerText();

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(dragX, y);

  await expect(track).toHaveClass(/timeline-track--dragging/);
  await expect(timecode).not.toHaveText(initialTimecode);

  const draggedTimecode = await timecode.innerText();

  await track.evaluate(
    (element, payload) => {
      element.dispatchEvent(new PointerEvent("pointermove", payload));
    },
    {
      bubbles: true,
      button: -1,
      buttons: 0,
      cancelable: true,
      clientX: releaseX,
      clientY: y,
      composed: true,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
    },
  );

  await expect(track).not.toHaveClass(/timeline-track--dragging/);

  await track.evaluate(
    (element, payload) => {
      element.dispatchEvent(new PointerEvent("pointermove", payload));
    },
    {
      bubbles: true,
      button: -1,
      buttons: 0,
      cancelable: true,
      clientX: laterX,
      clientY: y,
      composed: true,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
    },
  );

  await expect(timecode).toHaveText(draggedTimecode);
  await page.mouse.up();
});
