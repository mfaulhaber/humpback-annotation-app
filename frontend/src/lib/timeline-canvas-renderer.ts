import {
  type DetectionDrawRect,
  type VocalizationDrawWindow,
} from "./timeline-overlay-geometry.js";

export interface TimelineCanvasTileDrawItem {
  image: CanvasImageSource | null;
  width: number;
  x: number;
}

export interface TimelineCanvasRenderOptions {
  detectionRects: DetectionDrawRect[];
  height: number;
  hoveredDetectionKey?: string | null;
  hoveredVocalizationKey?: string | null;
  pixelRatio: number;
  tileItems: TimelineCanvasTileDrawItem[];
  vocalizationWindows: VocalizationDrawWindow[];
  width: number;
}

interface TextMetricsLike {
  width: number;
}

export interface TimelineCanvasContextLike {
  clearRect: (x: number, y: number, width: number, height: number) => void;
  drawImage: (
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ) => void;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void;
  measureText: (text: string) => TextMetricsLike;
  moveTo: (x: number, y: number) => void;
  beginPath: () => void;
  lineTo: (x: number, y: number) => void;
  restore: () => void;
  save: () => void;
  setTransform: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => void;
  stroke: () => void;
  strokeRect: (x: number, y: number, width: number, height: number) => void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  textBaseline: CanvasTextBaseline;
}

const BACKDROP_COLOR = "rgba(5, 11, 18, 1)";
const GRID_COLOR = "rgba(119, 201, 188, 0.045)";
const TILE_PLACEHOLDER = "rgba(20, 34, 54, 0.92)";
const LOWER_BAND_BACKDROP = "rgba(6, 14, 24, 0.34)";
const LOWER_BAND_EDGE = "rgba(111, 197, 184, 0.14)";
const HOVER_OUTLINE_WIDTH = 1;
const DETECTION_HOVER_OUTLINE = "rgba(142, 244, 228, 0.72)";
const VOCALIZATION_HOVER_OUTLINE = "rgba(212, 186, 250, 0.78)";

function truncateTextToWidth(
  context: TimelineCanvasContextLike,
  text: string,
  maxTextWidth: number,
): string {
  if (context.measureText(text).width <= maxTextWidth) {
    return text;
  }

  const ellipsis = "...";
  let current = text;
  while (current.length > 1) {
    current = current.slice(0, -1);
    const candidate = `${current}${ellipsis}`;
    if (context.measureText(candidate).width <= maxTextWidth) {
      return candidate;
    }
  }

  return ellipsis;
}

function drawBackdrop(
  context: TimelineCanvasContextLike,
  width: number,
  height: number,
): void {
  context.fillStyle = BACKDROP_COLOR;
  context.fillRect(0, 0, width, height);
}

function drawGrid(
  context: TimelineCanvasContextLike,
  width: number,
  height: number,
): void {
  context.beginPath();
  context.strokeStyle = GRID_COLOR;
  context.lineWidth = 1;

  for (let x = 0; x <= width; x += 120) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }

  for (let y = 0; y <= height; y += 56) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }

  context.stroke();
}

function drawLowerOverlayZone(
  context: TimelineCanvasContextLike,
  width: number,
  height: number,
): void {
  const top = Math.max(0, height - 96);
  context.fillStyle = LOWER_BAND_BACKDROP;
  context.fillRect(0, top, width, height - top);

  context.beginPath();
  context.strokeStyle = LOWER_BAND_EDGE;
  context.lineWidth = 1;
  context.moveTo(0, top + 0.5);
  context.lineTo(width, top + 0.5);
  context.stroke();
}

function drawTiles(
  context: TimelineCanvasContextLike,
  tileItems: TimelineCanvasTileDrawItem[],
  height: number,
): void {
  tileItems.forEach((tile) => {
    if (tile.image) {
      context.drawImage(tile.image, tile.x, 0, tile.width, height);
      return;
    }

    context.fillStyle = TILE_PLACEHOLDER;
    context.fillRect(tile.x, 0, tile.width, height);
  });
}

function drawDetections(
  context: TimelineCanvasContextLike,
  detectionRects: DetectionDrawRect[],
): void {
  if (detectionRects.length === 0) {
    return;
  }

  detectionRects.forEach((rect) => {
    context.fillStyle = rect.fill;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  });
}

function drawVocalizationIndicators(
  context: TimelineCanvasContextLike,
  vocalizationWindows: VocalizationDrawWindow[],
  height: number,
): void {
  vocalizationWindows.forEach((window) => {
    context.fillStyle = window.indicatorFill;
    context.fillRect(
      window.x,
      0,
      window.indicatorWidth,
      height,
    );
  });
}

function drawVocalizations(
  context: TimelineCanvasContextLike,
  vocalizationWindows: VocalizationDrawWindow[],
): void {
  context.textBaseline = "middle";

  vocalizationWindows.forEach((window) => {
    context.font = `600 ${window.chipFontSize}px "IBM Plex Sans", sans-serif`;
    let cursorY = window.y;
    const maxX = window.x + window.width;

    window.labels.forEach((label) => {
      const maxTextWidth =
        window.chipMaxWidth - window.chipHorizontalPadding * 2;
      const visibleText = truncateTextToWidth(
        context,
        label.text,
        maxTextWidth,
      );
      const textWidth = context.measureText(visibleText).width;
      const chipWidth = Math.min(
        window.chipMaxWidth,
        Math.max(window.chipHeight + 4, textWidth + window.chipHorizontalPadding * 2),
      );
      const availableWidth = maxX - window.x;
      if (availableWidth < 20 || cursorY < 0) {
        return;
      }

      const drawWidth = Math.min(chipWidth, availableWidth);
      context.strokeStyle = label.stroke;
      context.lineWidth = window.chipBorderWidth;
      context.strokeRect(window.x, cursorY, drawWidth, window.chipHeight);
      context.fillStyle = label.textColor;
      context.fillText(
        visibleText,
        window.x + window.chipHorizontalPadding,
        cursorY + window.chipHeight / 2 + window.chipTextBaselineOffset,
      );
      cursorY -= window.chipHeight + window.chipGap;
    });
  });
}

function drawHoverOutline(
  context: TimelineCanvasContextLike,
  hoveredDetectionKey: string | null | undefined,
  hoveredVocalizationKey: string | null | undefined,
  detectionRects: DetectionDrawRect[],
  vocalizationWindows: VocalizationDrawWindow[],
): void {
  if (hoveredDetectionKey) {
    const rect = detectionRects.find(
      (candidate) => candidate.detection.row_id === hoveredDetectionKey,
    );

    if (rect) {
      context.strokeStyle = DETECTION_HOVER_OUTLINE;
      context.lineWidth = HOVER_OUTLINE_WIDTH;
      context.strokeRect(
        rect.x + 0.5,
        rect.y + 0.5,
        Math.max(1, rect.width - 1),
        Math.max(1, rect.height - 1),
      );
    }
  }

  if (hoveredVocalizationKey) {
    const window = vocalizationWindows.find(
      (candidate) => candidate.key === hoveredVocalizationKey,
    );

    if (window) {
      context.strokeStyle = VOCALIZATION_HOVER_OUTLINE;
      context.lineWidth = HOVER_OUTLINE_WIDTH;
      context.strokeRect(
        window.x + 0.5,
        0.5,
        Math.max(1, window.width - 1),
        Math.max(1, window.indicatorHeight - 1),
      );
    }
  }
}

export function drawTimelineCanvas(
  context: TimelineCanvasContextLike,
  options: TimelineCanvasRenderOptions,
): void {
  context.save();
  context.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  context.clearRect(0, 0, options.width, options.height);
  drawBackdrop(context, options.width, options.height);
  drawGrid(context, options.width, options.height);
  drawTiles(context, options.tileItems, options.height);
  drawLowerOverlayZone(context, options.width, options.height);
  drawDetections(context, options.detectionRects);
  drawVocalizationIndicators(context, options.vocalizationWindows, options.height);
  drawVocalizations(context, options.vocalizationWindows);
  drawHoverOutline(
    context,
    options.hoveredDetectionKey,
    options.hoveredVocalizationKey,
    options.detectionRects,
    options.vocalizationWindows,
  );
  context.restore();
}
