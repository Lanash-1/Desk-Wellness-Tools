import { expect, test } from '@playwright/test';

// Tuesday 10:00 local: inside the default Mon–Fri 09:00–18:00 work hours.
const START = new Date('2026-10-27T10:00:00');

test('eye-rest reminder fires, is answered from the card, and reschedules', async ({ page }) => {
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByTestId('next-eyes')).toHaveText(/in (19|20) min/);

  await page.clock.fastForward(20 * 60_000 + 1_500);
  const card = page.getByTestId('reminder-card');
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText('Rest your eyes')).toBeVisible();
  await expect(card.getByText(/Look at something far away/)).toBeVisible();

  await card.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(card).toBeHidden();
  await expect(page.getByTestId('next-eyes')).toHaveText(/in (19|20) min/);
});

test('pausing reminders silences them and shows the resume time', async ({ page }) => {
  await page.clock.install({ time: START });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pause reminders' }).click();
  await page.getByRole('menuitem', { name: 'For 1 hour' }).click();
  await expect(page.getByText(/Reminders paused until/)).toBeVisible();
  await expect(page.getByTestId('next-eyes')).toHaveText('paused');

  await page.clock.fastForward(20 * 60_000 + 1_500);
  await page.waitForTimeout(1_500);
  await expect(page.getByTestId('reminder-card')).toBeHidden();

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('button', { name: 'Pause reminders' })).toBeVisible();
});

test('reminder settings persist', async ({ page }) => {
  await page.goto('/#/settings');
  const interval = page.getByLabel('Every').first();
  await interval.fill('30');
  await interval.blur();
  await page.reload();
  await expect(page.getByLabel('Every').first()).toHaveValue('30');
});
