'use client';

import { useState } from 'react';
import { Eye, EyeOff, Code, AlignLeft } from 'lucide-react';
import { cn, stripHtml } from '@/lib/utils';
import Button from '@/components/ui/Button';

interface BeforeAfterPreviewProps {
  originalContent: string;
  optimizedContent: string;
}

type ViewMode = 'html' | 'rendered';

function ContentPanel({
  title,
  content,
  viewMode,
  badge,
  badgeColor,
}: {
  title: string;
  content: string;
  viewMode: ViewMode;
  badge?: string;
  badgeColor?: string;
}) {
  const displayContent =
    viewMode === 'rendered'
      ? stripHtml(content).substring(0, 2000) + (content.length > 2000 ? '...' : '')
      : content;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <h3 className="text-sm font-semibold text-dark-300">{title}</h3>
        {badge && (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', badgeColor)}>
            {badge}
          </span>
        )}
      </div>
      <div
        className={cn(
          'flex-1 bg-dark-900 border border-dark-700 rounded-lg p-4 overflow-y-auto',
          'text-sm font-mono text-dark-300 leading-relaxed whitespace-pre-wrap',
          viewMode === 'rendered' && 'font-sans'
        )}
        style={{ minHeight: '400px', maxHeight: '600px' }}
      >
        {displayContent || <span className="text-dark-600 italic">No content</span>}
      </div>
    </div>
  );
}

export default function BeforeAfterPreview({
  originalContent,
  optimizedContent,
}: BeforeAfterPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('html');
  const [showSideBySide, setShowSideBySide] = useState(true);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wide">
          Content Comparison
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-dark-800 rounded-lg border border-dark-700 p-0.5">
            <button
              onClick={() => setViewMode('html')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'html'
                  ? 'bg-dark-700 text-dark-100'
                  : 'text-dark-500 hover:text-dark-300'
              )}
            >
              <Code className="w-3 h-3" />
              HTML
            </button>
            <button
              onClick={() => setViewMode('rendered')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'rendered'
                  ? 'bg-dark-700 text-dark-100'
                  : 'text-dark-500 hover:text-dark-300'
              )}
            >
              <AlignLeft className="w-3 h-3" />
              Text
            </button>
          </div>
          <button
            onClick={() => setShowSideBySide(!showSideBySide)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-dark-800 border border-dark-700 text-dark-400 hover:text-dark-200 transition-colors"
          >
            {showSideBySide ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showSideBySide ? 'Single' : 'Side by side'}
          </button>
        </div>
      </div>

      <div className={cn('flex gap-4', !showSideBySide && 'flex-col')}>
        <ContentPanel
          title="Original"
          content={originalContent}
          viewMode={viewMode}
          badge="Before"
          badgeColor="bg-dark-700 text-dark-400"
        />
        <ContentPanel
          title="Optimized"
          content={optimizedContent}
          viewMode={viewMode}
          badge="After"
          badgeColor="bg-brand-500/20 text-brand-300"
        />
      </div>
    </div>
  );
}
