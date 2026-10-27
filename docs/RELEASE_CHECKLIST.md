# Release checklist (manual desktop smoke test)

Tauri end-to-end automation is immature on macOS, so each release gets this manual pass on
both Windows and macOS using a bundled debug build (`pnpm tauri build --debug`). Notifications
on macOS only work from a bundled app, not from `pnpm tauri dev`.

## Launch & window

- [ ] App starts, window opens centred, tray/menu-bar icon appears.
- [ ] Closing the window hides it to the tray; a one-time "still running" notification shows.
- [ ] Left-clicking the tray icon toggles the window; right-click shows the menu.
- [ ] "Quit" in the tray menu and in Settings exits the process.
- [ ] Launching the app a second time focuses the existing window instead of opening another.
- [ ] Window size and position are restored after a restart.

## Notifications & sound

- [ ] "Enable notifications" grants permission; "Send test" shows an OS notification.
- [ ] A notification fires while the window is hidden.
- [ ] Clicking a notification brings the window forward.
- [ ] Sounds play at the configured volume; the Sounds toggle silences them.

## Timing

- [ ] Start a 1-minute focus session, hide the window, wait: the phase-change notification arrives on time.
- [ ] Put the machine to sleep for 15+ minutes with reminders pending: on wake there is no burst of stale notifications.
- [ ] Change the system clock / time zone: streaks and today's stats stay consistent.

## Settings

- [ ] "Launch at login" toggles the OS login item; relaunching with `--minimized` starts hidden.
- [ ] Theme switch (system / light / dark) applies immediately.
- [ ] Export JSON then import it into a fresh install restores the data.

## Packaging

- [ ] Windows: NSIS installer and MSI both install and uninstall cleanly.
- [ ] macOS: unsigned DMG opens via right-click → Open (or `xattr -cr`); document in release notes.
