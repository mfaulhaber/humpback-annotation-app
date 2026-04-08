import {
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  committedFixtureEndTimestamp,
  committedFixtureHotspotTimestamp,
  committedFixtureJobId,
  committedFixtureStartTimestamp,
} from "./export-root.js";

export interface GeometryBox {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  x: number;
  y: number;
}

export interface ViewerGeometry {
  axis: GeometryBox;
  canvas: GeometryBox;
  confidenceStrip: GeometryBox;
  controls: GeometryBox;
  header: GeometryBox;
  playhead: GeometryBox;
  shell: GeometryBox;
  stage: GeometryBox;
  track: GeometryBox;
  viewer: GeometryBox;
}

export interface OpenViewerOptions {
  navigateToHotspot?: boolean;
  overlayMode?: "detections" | "vocalizations";
  zoom?: "24h" | "6h" | "1h" | "15m" | "5m" | "1m";
}

const VISUAL_SETTLE_DELAY_MS = 250;

const timelineTestIds = {
  axis: "timeline-axis",
  canvas: "timeline-track-canvas",
  confidenceStrip: "timeline-confidence-strip",
  controls: "timeline-controls",
  header: "timeline-viewer-header",
  playhead: "timeline-playhead",
  shell: "timeline-shell",
  stage: "timeline-stage",
  track: "timeline-track",
  viewer: "timeline-viewer",
} as const;

function getBox(locator: Locator): Promise<GeometryBox> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    };
  });
}

export async function disableMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition: none !important;
      }
    `,
  });
}

export async function waitForViewerStable(page: Page): Promise<void> {
  await page.getByTestId(timelineTestIds.viewer).waitFor();
  await page.getByTestId(timelineTestIds.controls).waitFor();
  await page.waitForFunction(() => {
    const track = document.querySelector("[data-testid='timeline-track']");
    const canvas = document.querySelector("[data-testid='timeline-track-canvas']");

    if (!(track instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
      return false;
    }

    const rect = track.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && canvas.width > 0 && canvas.height > 0;
  });
  await page.evaluate(async () => {
    if ("fonts" in document && document.fonts) {
      await document.fonts.ready;
    }

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve()),
      ),
    );
  });
}

export async function waitForVisualSettled(page: Page): Promise<void> {
  await waitForViewerStable(page);
  await page.waitForTimeout(VISUAL_SETTLE_DELAY_MS);
}

export async function openIndex(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("timeline-index-grid").waitFor();
  await page.evaluate(async () => {
    if ("fonts" in document && document.fonts) {
      await document.fonts.ready;
    }
  });
}

export async function setZoom(
  page: Page,
  zoom: "24h" | "6h" | "1h" | "15m" | "5m" | "1m",
): Promise<void> {
  await page.getByRole("button", {
    name: zoom,
    exact: true,
  }).click();
  await waitForViewerStable(page);
}

export async function setOverlayMode(
  page: Page,
  overlayMode: "detections" | "vocalizations",
): Promise<void> {
  const button = page.getByRole("button", {
    name: overlayMode === "detections" ? "Detections" : "Vocalizations",
    exact: true,
  });
  const isPressed = (await button.getAttribute("aria-pressed")) === "true";

  if (!isPressed) {
    await button.click();
    await waitForViewerStable(page);
  }
}

export async function clickTrackAtRatio(
  page: Page,
  ratio: number,
): Promise<void> {
  const track = page.getByTestId(timelineTestIds.track);
  const box = await track.boundingBox();

  expect(box).not.toBeNull();

  await track.click({
    position: {
      x: Math.max(1, Math.min((box?.width ?? 0) - 1, (box?.width ?? 0) * ratio)),
      y: Math.max(1, (box?.height ?? 0) / 2),
    },
  });
  await waitForViewerStable(page);
}

export async function hoverTrackAtRatio(
  page: Page,
  ratio: number,
  yRatio = 0.5,
): Promise<void> {
  const track = page.getByTestId(timelineTestIds.track);
  const box = await track.boundingBox();

  expect(box).not.toBeNull();

  await page.mouse.move(
    (box?.x ?? 0) + Math.max(1, Math.min((box?.width ?? 0) - 1, (box?.width ?? 0) * ratio)),
    (box?.y ?? 0) + Math.max(1, Math.min((box?.height ?? 0) - 1, (box?.height ?? 0) * yRatio)),
  );
}

export async function centerViewerOnCommittedFixtureTimestamp(
  page: Page,
  timestamp: number,
): Promise<void> {
  const span =
    committedFixtureEndTimestamp - committedFixtureStartTimestamp;
  const ratio = (timestamp - committedFixtureStartTimestamp) / span;

  await setZoom(page, "24h");
  await clickTrackAtRatio(page, ratio);
}

export async function centerViewerOnCommittedHotspot(
  page: Page,
): Promise<void> {
  await centerViewerOnCommittedFixtureTimestamp(
    page,
    committedFixtureHotspotTimestamp,
  );
}

export async function openCommittedFixtureViewer(
  page: Page,
  options: OpenViewerOptions = {},
): Promise<void> {
  await page.goto(`/${committedFixtureJobId}`);
  await waitForViewerStable(page);

  if (options.navigateToHotspot ?? true) {
    await centerViewerOnCommittedHotspot(page);
  }

  if (options.overlayMode) {
    await setOverlayMode(page, options.overlayMode);
  }

  if (options.zoom) {
    await setZoom(page, options.zoom);
  }
}

export async function resizeViewer(
  page: Page,
  viewport: { height: number; width: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  await waitForViewerStable(page);
}

export async function readViewerGeometry(
  page: Page,
): Promise<ViewerGeometry> {
  return {
    axis: await getBox(page.getByTestId(timelineTestIds.axis)),
    canvas: await getBox(page.getByTestId(timelineTestIds.canvas)),
    confidenceStrip: await getBox(page.getByTestId(timelineTestIds.confidenceStrip)),
    controls: await getBox(page.getByTestId(timelineTestIds.controls)),
    header: await getBox(page.getByTestId(timelineTestIds.header)),
    playhead: await getBox(page.getByTestId(timelineTestIds.playhead)),
    shell: await getBox(page.getByTestId(timelineTestIds.shell)),
    stage: await getBox(page.getByTestId(timelineTestIds.stage)),
    track: await getBox(page.getByTestId(timelineTestIds.track)),
    viewer: await getBox(page.getByTestId(timelineTestIds.viewer)),
  };
}
