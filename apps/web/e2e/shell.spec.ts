import { expect, test } from '@playwright/test';

// P1-UI-006 acceptance: responsive shell, visible keyboard focus, no default
// template branding.

test('shell landmarks and brand render without template boilerplate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Yantra AI home' })).toBeVisible();
  await expect(page.getByText(/Vercel|Next\.js boilerplate|Learn React/i)).toHaveCount(0);
});

test('skip link jumps keyboard focus to the main region', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveText('Skip to content');
  await focused.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('keyboard focus is always visible', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) {
      return 'none';
    }
    return getComputedStyle(el).outlineStyle;
  });
  expect(outline).not.toBe('none');
});

test('primary nav reaches page sections', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Problem' })
    .click();
  await expect(page).toHaveURL(/#problem$/);
  await expect(page.getByRole('heading', { name: /expensive part/i })).toBeVisible();
});
