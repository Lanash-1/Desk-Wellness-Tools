import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './app/AppLayout';
import { PlatformProvider } from './app/PlatformProvider';
import { useTheme } from './app/useTheme';
import { TodayPage } from './features/today/TodayPage';
import { TimerPage } from './features/timer/TimerPage';
import { WaterPage } from './features/water/WaterPage';
import { StatsPage } from './features/stats/StatsPage';
import { SettingsPage } from './features/settings/SettingsPage';

export default function App() {
  useTheme();
  return (
    <PlatformProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<TodayPage />} />
            <Route path="timer" element={<TimerPage />} />
            <Route path="water" element={<WaterPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </PlatformProvider>
  );
}
