import { expect, test } from '@playwright/test';

test('stats reflect today’s activity and streak tiles render', async ({ page }) => {
  await page.goto('/#/water');
  await page.getByRole('button', { name: '+500 ml' }).click();

  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await expect(page.getByTestId('streak-wellness')).toBeVisible();
  await expect(page.getByTestId('chart-water').locator('svg').first()).toBeVisible();

  await page.getByRole('button', { name: '30 days' }).click();
  await expect(page.getByRole('button', { name: '30 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByTestId('today-water')).toHaveText('500 ml');
  await expect(page.getByTestId('today-focus')).toHaveText('0 sessions');
});
