import { test, expect } from '@playwright/test';

for (const width of [1440, 1024, 768, 390]) {
  test(`Studio layout and English UI remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => localStorage.setItem('studio:ui-language', 'uk'));
    await page.goto('/');
    // Generic test build uses the local template workflow, not a production auth bypass.
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('[data-ui-language]')).toHaveCount(0);
    await expect(page.locator('.workflow-steps a')).toHaveCount(4);
    await expect(page.locator('.format-option')).toHaveCount(4);
    await expect(page.locator('#quantity-instagram_post')).toBeEnabled();
    await expect(page.locator('#quantity-facebook')).toBeDisabled();
    await page.locator('[name="formats"][value="facebook"]').check();
    await expect(page.locator('#quantity-facebook')).toBeEnabled();
    await page.locator('#quantity-facebook').fill('3');
    await page.locator('[name="languages"][value="en"]').check();
    await page.locator('[name="languages"][value="uk"]').check();
    await expect(page.locator('#pack-total')).toHaveText('8 visuals · 4 shared post captions');
    await expect(page.locator('[name="languages"][value="uk"]').locator('..')).toContainText('Ukrainian');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const selector of ['.panel', '.format-option', '.pack-sticky', '.workflow-steps']) {
      for (const item of await page.locator(selector).all()) {
        const box = await item.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
    }
    if (width < 950) {
      await page.locator('#toggle-sidebar').click();
      await expect(page.locator('#sidebar')).toHaveClass(/open/);
      await page.locator('#sidebar-overlay').click({ position: { x: width - 10, y: 10 } });
      await expect(page.locator('#toggle-sidebar')).toHaveAttribute('aria-expanded', 'false');
    }
  });
}

test('the student brief clearly separates MVP and full-product requirements, with working detail links', async ({ page, request }) => {
  await page.goto('/brief/index.html');
  await expect(page.locator('h1')).toContainText('One event.');
  await expect(page.locator('#mvp .req-id')).toHaveCount(15);
  await expect(page.locator('#full-product .req-id')).toHaveCount(12);
  await expect(page.locator('#mvp')).toContainText('Java backend');
  await expect(page.locator('#full-product')).toContainText('Google Drive');
  await expect(page.locator('#mvp')).toContainText('Mandatory database');
  await expect(page.locator('#mvp .release-note')).toContainText('visual example only');
  await expect(page.locator('#full-product')).toContainText('optional');
  await expect(page.locator('#full-product')).toContainText('Administrator prompt editor');
  const response = await request.get('/brief/docs/PRODUCT_REQUIREMENTS.md');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('## Acceptance scenarios');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.menu-toggle').click();
  await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
});
