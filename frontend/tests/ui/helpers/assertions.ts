import { expect, type Locator, type Page } from "@playwright/test";

export function expectWithinTolerance(
  actual: number,
  expected: number,
  tolerance: number,
  label: string,
): void {
  expect(
    Math.abs(actual - expected),
    `${label} expected ${actual} to be within ${tolerance} of ${expected}`,
  ).toBeLessThanOrEqual(tolerance);
}

export async function expectLocatorToHaveBox(
  locator: Locator,
  label: string,
): Promise<void> {
  const box = await locator.boundingBox();

  expect(box, `${label} should have a measurable layout box`).not.toBeNull();
  expect(box?.width ?? 0, `${label} width should be positive`).toBeGreaterThan(0);
  expect(box?.height ?? 0, `${label} height should be positive`).toBeGreaterThan(0);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });

  expect(hasOverflow).toBe(false);
}
