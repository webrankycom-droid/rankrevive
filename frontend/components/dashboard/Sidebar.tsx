'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  FileText,
  Search,
  History,
  Settings,
  Shield,
  LogOut,
  TrendingUp,
  ChevronRight,
  AlertTriangle,
  BarChart2,
  Link2,
} from 'lucide-react';
import { cn, getPlanBadgeClass } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/pages', icon: FileText, label: 'Pages' },
  { href: '/dashboard/keywords', icon: Search, label: 'Keywords' },
  { href: '/dashboard/rankings', icon: BarChart2, label: 'Rank Tracker' },
  { href: '/dashboard/internal-links', icon: Link2, label: 'Internal Links' },
  { href: '/dashboard/cannibalization', icon: AlertTriangle, label: 'Cannibalization' },
  { href: '/dashboard/history', icon: History, label: 'History' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-60 shrink-0 bg-dark-900 border-r border-dark-700 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-dark-700">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <TrendingUp className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">
            Rank<span className="text-brand-400">Revive</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                    isActive
                      ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                      : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
                  )}
                >
                  <item.icon
                    className={cn(
                      'w-4.5 h-4.5 shrink-0',
                      isActive ? 'text-brand-400' : 'text-dark-500 group-hover:text-dark-300'
                    )}
                  />
                  {item.label}
                  {isActive && (
                    <ChevronRight className="w-3 h-3 ml-auto text-brand-500" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Admin link */}
        {session?.user?.isAdmin && (
          <div className="mt-4 pt-4 border-t border-dark-700">
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                pathname.startsWith('/admin')
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
              )}
            >
              <Shield className="w-4.5 h-4.5 shrink-0 text-purple-400" />
              Admin Panel
            </Link>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-dark-700">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
            <span className="text-brand-300 text-xs font-bold">
              {session?.user?.name?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-dark-200 truncate">
              {session?.user?.name || 'User'}
            </p>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full border font-medium capitalize',
              getPlanBadgeClass(session?.user?.plan || 'starter')
            )}>
              {session?.user?.plan || 'starter'}
            </span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-dark-500 hover:text-red-400 hover:bg-red-500/10 w-full transition-colors mt-1"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
