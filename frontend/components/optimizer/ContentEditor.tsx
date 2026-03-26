'use client';

import { useState, useRef, useEffect } from 'react';
import { Copy, Check, RotateCcw, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  readOnly?: boolean;
  placeholder?: string;
  wordCount?: boolean;
}

export default function ContentEditor({
  value,
  onChange,
  label,
  readOnly = false,
  placeholder = 'Content will appear here...',
  wordCount = true,
}: ContentEditorProps) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const words = value
    ? value.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
    : 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [value]);

  const editorContent = (
    <div className={cn('flex flex-col h-full', isFullscreen && 'fixed inset-0 z-50 bg-dark-950 p-6')}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 px-1">
        {label && <h3 className="text-sm font-semibold text-dark-300">{label}</h3>}
        <div className="flex items-center gap-1.5 ml-auto">
          {wordCount && (
            <span className="text-xs text-dark-500 mr-2">
              {words.toLocaleString()} words
            </span>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-dark-500 hover:text-dark-300 hover:bg-dark-800 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-dark-500 hover:text-dark-300 hover:bg-dark-800 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {isFullscreen && (
            <Button size="sm" variant="secondary" onClick={() => setIsFullscreen(false)}>
              Done
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div
        className={cn(
          'bg-dark-900 border border-dark-700 rounded-lg overflow-hidden flex-1 flex flex-col',
          !readOnly && 'focus-within:border-brand-500/40'
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn(
            'flex-1 w-full bg-transparent px-4 py-3.5 text-sm',
            'text-dark-200 font-mono leading-relaxed resize-none',
            'focus:outline-none placeholder-dark-600',
            readOnly && 'cursor-default',
            isFullscreen ? 'min-h-[80vh]' : 'min-h-[400px]'
          )}
          spellCheck={false}
        />
      </div>
    </div>
  );

  return editorContent;
}
