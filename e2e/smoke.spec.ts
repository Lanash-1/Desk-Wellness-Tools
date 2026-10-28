import { expect, test } from '@playwright/test';

test('app shell loads and navigates', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Time for some water' })).toBeVisible();
});

test('settings persist across reloads', async ({ page }) => {
  await page.goto('/#/settings');
  const toggle = page.getByRole('switch', { name: 'Posture check' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await page.reload();
  await expect(page.getByRole('switch', { name: 'Posture check' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});
