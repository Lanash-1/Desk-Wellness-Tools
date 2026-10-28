import { NavLink, Outlet } from 'react-router-dom';
import { PauseMenu } from '@/features/reminders/PauseMenu';
import { ReminderCard } from '@/features/reminders/ReminderCard';
import { UpdateToast } from '@/features/pwa/UpdateToast';

const NAV = [
  { to: '/', label: 'Today', icon: '☀️' },
  { to: '/timer', label: 'Focus', icon: '⏱️' },
  { to: '/water', label: 'Water', icon: '💧' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function AppLayout() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <nav
        aria-label="Primary"
        className="order-last flex shrink-0 border-t border-slate-200 bg-white md:order-first md:w-56 md:flex-col md:border-r md:border-t-0 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="hidden items-center gap-2 px-5 py-5 md:flex">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            ✦
          </span>
          <span className="font-semibold">Desk Wellness</span>
        </div>
        <ul className="flex w-full justify-around md:flex-col md:gap-1 md:px-3">
          {NAV.map((item) => (
            <li key={item.to} className="flex-1 md:flex-none">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 md:flex-row md:gap-3 md:px-3 md:py-2 md:text-sm',
                    isActive
                      ? 'text-brand-700 md:bg-brand-50 dark:text-brand-100 md:dark:bg-brand-900/40'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
                  ].join(' ')
                }
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto focus:outline-none">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
          <div className="mb-4 flex justify-end">
            <PauseMenu />
          </div>
          <Outlet />
        </div>
      </main>
      <ReminderCard />
      <UpdateToast />
    </div>
  );
}
