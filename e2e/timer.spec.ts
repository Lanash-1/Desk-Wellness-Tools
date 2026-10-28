import { expect, test } from '@playwright/test';

test('a focus session runs to completion and starts the break', async ({ page }) => {
  // Fake the page clock so we can jump 25 minutes; the heartbeat worker keeps its real cadence.
  await page.clock.install({ time: new Date('2026-10-27T10:00:00') });
  await page.goto('/#/timer');

  await page.getByRole('button', { name: 'Start focus' }).click();
  await expect(page.getByTestId('timer-clock')).toHaveText(/^24:5\d$/, { timeout: 15_000 });
  await expect(page.getByText('Session 1 of 4')).toBeVisible();

  await page.clock.fastForward(25 * 60_000 + 1_500);

  await expect(page.getByText('Short break', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timer-clock')).toHaveText(/^0[45]:\d\d$/);
  await expect(page.getByText('1 of 4 done')).toBeVisible();
  await expect(page).toHaveTitle(/· Short break · Desk Wellness$/);

  // Pause freezes the clock.
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const frozen = await page.getByTestId('timer-clock').textContent();
  await page.clock.fastForward(30_000);
  await expect(page.getByTestId('timer-clock')).toHaveText(frozen!);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

test('the running timer survives a reload', async ({ page }) => {
  await page.goto('/#/timer');
  await page.getByRole('button', { name: 'Start focus' }).click();
  await expect(page.getByTestId('timer-clock')).toHaveText(/^24:5\d$/, { timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.getByTestId('timer-clock')).toHaveText(/^24:[45]\d$/);
});
