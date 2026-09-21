import { expect, test } from '@playwright/test';

// P1-WEB-007 acceptance: routes complete, semantic headings, responsive
// layout, validating CTA form — all without depending on the 3D bundle.

const ROUTES = [
  { path: '/', heading: /best service engineer/i },
  { path: '/product', heading: /cites its sources/i },
  { path: '/security', heading: /fail safely/i },
  { path: '/contact', heading: /request a pilot/i },
];

for (const route of ROUTES) {
  test(`route ${route.path} serves one h1 and landmark shell`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
}

test('product demo CTA reaches the home journey', async ({ page }) => {
  await page.goto('/product');
  await page.getByRole('link', { name: /interactive demo/i }).click();
  await expect(page).toHaveURL(/\/#demo$/);
  await expect(page.locator('#demo')).toBeVisible();
});

test('contact form validates and stays honest', async ({ page }) => {
  await page.goto('/contact');
  await page.getByRole('button', { name: /validate details/i }).click();
  await expect(page.getByTestId('pilot-error-name')).toBeVisible();
  await expect(page.getByTestId('pilot-error-email')).toBeVisible();

  await page.getByLabel('Your name').fill('Asha Rao');
  await page.getByLabel('Work email').fill('asha@oem.example');
  await page.getByLabel('Company').fill('Acme Packaging');
  await page
    .getByLabel('Service challenge')
    .fill('Our technicians wait days for senior answers on fault codes.');
  await page.getByRole('button', { name: /validate details/i }).click();
  const notice = page.getByTestId('pilot-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/sends nothing/i);
});

test('core content works with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /best service engineer/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /how a machine is resolved/i })).toBeVisible();
  await expect(page.getByTestId('machine-poster')).toBeVisible();
  await page.goto('/contact');
  await expect(page.getByTestId('pilot-form')).toBeVisible();
  await context.close();
});

test('routes stay responsive at mobile width', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const route of ROUTES) {
    await page.goto(route.path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, route.path).toBeLessThanOrEqual(1);
  }
  await context.close();
});
