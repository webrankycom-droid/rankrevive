import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatCTR(ctr: number | null | undefined): string {
  if (ctr == null) return '0%';
  return `${(ctr * 100).toFixed(1)}%`;
}

export function formatPosition(pos: number | null | undefined): string {
  if (pos == null) return '—';
  return pos.toFixed(1);
}

export function getPositionVariant(position: number): 'success' | 'warning' | 'danger' {
  if (position < 5) return 'success';
  if (position <= 20) return 'warning';
  return 'danger';
}

export function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

export function getScoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-400';
  if (score >= 50) return 'bg-yellow-400';
  return 'bg-red-400';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Fair';
  return 'Needs Work';
}

export function truncateUrl(url: string, maxLength = 60): string {
  try {
    const { pathname } = new URL(url);
    if (pathname.length <= maxLength) return pathname;
    return pathname.substring(0, maxLength - 3) + '...';
  } catch {
    return url.length <= maxLength ? url : url.substring(0, maxLength - 3) + '...';
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getPlanColor(plan: string): string {
  switch (plan) {
    case 'agency': return 'text-purple-400';
    case 'pro': return 'text-brand-400';
    default: return 'text-dark-400';
  }
}

export function getPlanBadgeClass(plan: string): string {
  switch (plan) {
    case 'agency': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'pro': return 'bg-brand-500/20 text-brand-300 border-brand-500/30';
    default: return 'bg-dark-700 text-dark-300 border-dark-600';
  }
}
