import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { usePlatform } from '@/app/usePlatform';
import {
  BackupError,
  backupFileName,
  clearAllData,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
  type ImportMode,
} from '@/storage/backup';

export function DataSettings() {
  const platform = usePlatform();
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setStatus(null);
    try {
      const text = await fn();
      if (text) setStatus({ tone: 'ok', text });
    } catch (err) {
      setStatus({
        tone: 'error',
        text:
          err instanceof BackupError ? err.message : 'Something went wrong. Nothing was changed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const doExport = () =>
    run(async () => {
      const backup = await exportBackup();
      const saved = await platform.files.saveText(
        backupFileName(backup.exportedAt),
        serializeBackup(backup),
      );
      return saved ? 'Backup saved.' : null;
    });

  const doImport = (mode: ImportMode) =>
    run(async () => {
      const text = await platform.files.openText();
      if (text === null) return null;
      const summary = await importBackup(parseBackup(text), mode);
      return `Imported ${summary.sessions} sessions, ${summary.waterLogs} drinks and ${summary.reminderEvents} reminder events${
        summary.settingsApplied ? ', and applied the saved settings' : ''
      }.`;
    });

  const doClear = () =>
    run(async () => {
      await clearAllData();
      setConfirmClear(false);
      window.location.reload();
      return null;
    });

  return (
    <Card title="Your data">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Everything is stored on this device. Export a backup to move to another machine or keep a
        copy.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={doExport} disabled={busy}>
          Export backup
        </Button>
        <Button variant="secondary" onClick={() => doImport('merge')} disabled={busy}>
          Import &amp; merge
        </Button>
        <Button variant="secondary" onClick={() => doImport('replace')} disabled={busy}>
          Import &amp; replace
        </Button>
      </div>
      {status && (
        <p
          role="status"
          className={`mt-3 text-sm ${status.tone === 'ok' ? 'text-brand-700 dark:text-brand-100' : 'text-red-600'}`}
        >
          {status.text}
        </p>
      )}
      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
        {confirmClear ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-red-600">
              Delete all sessions, drinks, reminders and settings on this device?
            </span>
            <Button className="bg-red-600 hover:bg-red-700" onClick={doClear} disabled={busy}>
              Yes, delete everything
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm text-red-600 hover:underline"
            onClick={() => setConfirmClear(true)}
          >
            Clear all data…
          </button>
        )}
      </div>
    </Card>
  );
}
