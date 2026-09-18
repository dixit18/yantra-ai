import { expect, test } from '@playwright/test';

// 3D-perfect gate: primary content never waits for WebGL; reduced motion and
// missing WebGL always resolve to the poster; scroll is never trapped.

test('primary content renders with canvas or poster', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /best service engineer/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /how a machine is resolved/i })).toBeVisible();
  const visual = page.getByTestId('hero-canvas').or(page.getByTestId('machine-poster'));
  await expect(visual).toBeVisible();
});

test('stepper advances the annotation', async ({ page }) => {
  await page.goto('/');
  const annotation = page.getByTestId('step-annotation');
  await expect(annotation).toContainText('Scan the machine');
  await page.getByRole('button', { name: /03 — Diagnose/i }).click();
  await expect(annotation).toContainText('Follow approved steps');
  await page.getByRole('button', { name: /04 — Act/i }).click();
  await expect(annotation).toContainText('Move to part, case, or quote');
});

test('reduced motion always shows the poster, never the canvas', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByTestId('machine-poster')).toBeVisible();
  await expect(page.getByTestId('hero-canvas')).toHaveCount(0);
  await context.close();
});

test('page scroll is never hijacked over the visual', async ({ page }) => {
  await page.goto('/');
  await page.mouse.move(900, 320);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('mobile viewport renders without horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /best service engineer/i })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});
