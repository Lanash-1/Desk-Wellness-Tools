import { useLiveQuery } from 'dexie-react-hooks';
import type { Settings } from '@/core/models';
import { SETTINGS_ID } from '@/core/settings/defaults';
import { getDb } from '@/storage/db';
import { withDefaults } from '@/storage/settings';

/**
 * Live, read-only view of the settings row. Returns undefined until the row exists;
 * PlatformProvider creates it on startup (live queries must never write).
 */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const row = await getDb().settings.get(SETTINGS_ID);
    return row ? { ...row, ...withDefaults(row) } : undefined;
  }, []);
}
