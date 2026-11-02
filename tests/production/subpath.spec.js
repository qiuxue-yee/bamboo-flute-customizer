import { test, expect } from '@playwright/test';

test('production site loads assets, presets and exports under a project path', async ({ page }) => {
  const failures = [];
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('./');
  await expect(page.locator('#app-status')).toHaveText('Flute ready', { timeout: 30000 });
  await page.locator('[data-preset="leaves"]').click();
  await expect(page.locator('#preview-status')).toHaveText('Pattern applied');
  await page.locator('#export-format-select').selectOption('glb');
  const download = page.waitForEvent('download');
  await page.locator('#export-model-btn').click();
  expect((await download).suggestedFilename()).toMatch(/\.glb$/i);
  expect(failures).toEqual([]);
});
