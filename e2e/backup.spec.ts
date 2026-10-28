import { expect, test } from '@playwright/test';

test('exporting a backup downloads a JSON file with the current data', async ({ page }) => {
  await page.goto('/#/water');
  await page.getByRole('button', { name: '+250 ml' }).click();

  await page.getByRole('link', { name: 'Settings' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^desk-wellness-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const backup = JSON.parse(await readFile(path!, 'utf8'));
  expect(backup.app).toBe('desk-wellness');
  expect(backup.waterLogs).toHaveLength(1);
  expect(backup.waterLogs[0].amountMl).toBe(250);
  await expect(page.getByRole('status')).toHaveText('Backup saved.');
});

test('clearing all data asks for confirmation and wipes the device', async ({ page }) => {
  await page.goto('/#/water');
  await page.getByRole('button', { name: '+500 ml' }).click();
  await expect(page.getByTestId('water-total')).toHaveText('500');

  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Clear all data…' }).click();
  await page.getByRole('button', { name: 'Yes, delete everything' }).click();
  await page.waitForLoadState('load');

  await page.goto('/#/water');
  await expect(page.getByTestId('water-total')).toHaveText('0');
});
