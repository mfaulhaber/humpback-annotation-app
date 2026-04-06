import type { DetectionDrawRect, VocalizationDrawWindow } from "./timeline-overlay-geometry.js";

export interface TimelineCanvasTileDrawItem {
  image: CanvasImageSource | null;
  width: number;
  x: number;
}

export interface TimelineCanvasRenderOptions {
  detectionRects: DetectionDrawRect[];
  height: number;
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
const GRID_COLOR = "rgba(114, 224, 192, 0.06)";
const TILE_PLACEHOLDER = "rgba(20, 34, 54, 0.92)";
const CHIP_TEXT_COLOR = "#f5fbff";
const CHIP_HEIGHT = 22;
const CHIP_HORIZONTAL_PADDING = 8;
const CHIP_GAP = 6;
const DETECTION_BAND_HEIGHT = 92;
const DETECTION_BAND_OFFSET = 54;

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
  height: number,
): void {
  const bandTop = Math.max(0, height - DETECTION_BAND_HEIGHT - DETECTION_BAND_OFFSET);

  detectionRects.forEach((rect) => {
    context.fillStyle = rect.fill;
    context.strokeStyle = rect.stroke;
    context.lineWidth = 1;
    context.fillRect(rect.x, bandTop + rect.y, rect.width, rect.height);
    context.strokeRect(rect.x, bandTop + rect.y, rect.width, rect.height);
  });
}

function drawVocalizations(
  context: TimelineCanvasContextLike,
  vocalizationWindows: VocalizationDrawWindow[],
): void {
  context.font = '600 12px "IBM Plex Sans", sans-serif';
  context.textBaseline = "middle";

  vocalizationWindows.forEach((window) => {
    let cursorX = window.x;
    const maxX = window.x + window.width;

    window.labels.forEach((label) => {
      const textWidth = context.measureText(label.text).width;
      const chipWidth = Math.max(36, textWidth + CHIP_HORIZONTAL_PADDING * 2);
      const availableWidth = maxX - cursorX;
      if (availableWidth < 20) {
        return;
      }

      const drawWidth = Math.min(chipWidth, availableWidth);
      context.fillStyle = label.fill;
      context.strokeStyle = label.stroke;
      context.lineWidth = 1;
      context.fillRect(cursorX, window.y, drawWidth, CHIP_HEIGHT);
      context.strokeRect(cursorX, window.y, drawWidth, CHIP_HEIGHT);
      context.fillStyle = CHIP_TEXT_COLOR;
      context.fillText(label.text, cursorX + CHIP_HORIZONTAL_PADDING, window.y + CHIP_HEIGHT / 2);
      cursorX += drawWidth + CHIP_GAP;
    });
  });
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
  drawVocalizations(context, options.vocalizationWindows);
  drawDetections(context, options.detectionRects, options.height);
  context.restore();
}
