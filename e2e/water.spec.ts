import { expect, test } from '@playwright/test';

test('logging water updates the total, persists, and can be removed', async ({ page }) => {
  await page.goto('/#/water');
  await expect(page.getByTestId('water-total')).toHaveText('0');

  await page.getByRole('button', { name: '+250 ml' }).click();
  await page.getByRole('button', { name: '+500 ml' }).click();
  await expect(page.getByTestId('water-total')).toHaveText('750');

  await page.getByLabel('Custom amount in millilitres').fill('120');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByTestId('water-total')).toHaveText('870');

  await page.reload();
  await expect(page.getByTestId('water-total')).toHaveText('870');

  await page.getByRole('button', { name: /Remove 120 ml/ }).click();
  await expect(page.getByTestId('water-total')).toHaveText('750');

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByTestId('today-water')).toHaveText('750 ml');
});
