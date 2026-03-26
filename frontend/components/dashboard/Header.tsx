'use client';

import { Bell, RefreshCw, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-900/50 backdrop-blur-sm sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-dark-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {action && (
          <Button
            onClick={action.onClick}
            loading={action.loading}
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            {action.label}
          </Button>
        )}
        <button className="w-8 h-8 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center text-dark-400 hover:text-dark-200 transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-brand-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
