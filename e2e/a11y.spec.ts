import { expect, test } from '@playwright/test';

test('keyboard shortcuts drive the timer', async ({ page }) => {
  await page.goto('/#/timer');
  await page.getByRole('heading', { name: 'Focus timer' }).click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeVisible();
});

test('skip link, landmarks and current-page navigation are present', async ({ page }) => {
  await page.goto('/#/water');
  await expect(page.getByRole('heading', { name: 'Water', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Water' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('progressbar', { name: 'Water goal progress' })).toBeVisible();
});
