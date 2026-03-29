'use client';

import { Target, TrendingUp, HelpCircle, Lightbulb, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ContentBrief } from '@/types';

interface ContentBriefPanelProps {
  brief: ContentBrief;
  loading?: boolean;
}

const INTENT_CONFIG = {
  informational: { label: 'Informational', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', desc: 'User wants to learn' },
  commercial: { label: 'Commercial', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', desc: 'User is comparing options' },
  transactional: { label: 'Transactional', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', desc: 'User wants to take action' },
  navigational: { label: 'Navigational', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', desc: 'User seeks specific page' },
};

export default function ContentBriefPanel({ brief, loading }: ContentBriefPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div className="rounded-xl border border-dark-700 bg-dark-800 p-4 space-y-3 animate-pulse">
        <div className="h-4 w-40 bg-dark-700 rounded" />
        <div className="h-3 w-full bg-dark-700 rounded" />
        <div className="h-3 w-3/4 bg-dark-700 rounded" />
      </div>
    );
  }

  const intentCfg = INTENT_CONFIG[brief.detectedIntent] || INTENT_CONFIG.informational;

  return (
    <div className="rounded-xl border border-brand-500/20 bg-dark-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-brand-500/5 hover:bg-brand-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-dark-100">SEO Content Brief</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${intentCfg.bg} ${intentCfg.color}`}>
            {intentCfg.label} — {intentCfg.desc}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Word count target + competitor angle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-dark-700/50 border border-dark-600 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-xs font-semibold text-dark-300 uppercase tracking-wide">Word Count Target</span>
              </div>
              <p className="text-sm text-dark-100">{brief.recommendedWordCount}</p>
            </div>
            <div className="rounded-lg bg-dark-700/50 border border-dark-600 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-dark-300 uppercase tracking-wide">vs. Competitors</span>
              </div>
              <p className="text-xs text-dark-300 leading-relaxed">{brief.competitorAngle}</p>
            </div>
          </div>

          {/* Featured snippet opportunity */}
          {brief.featuredSnippetOpportunity && (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">⚡ Featured Snippet Opportunity</span>
              </div>
              <p className="text-xs text-dark-300 leading-relaxed whitespace-pre-line">{brief.featuredSnippetOpportunity}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quick Win Keywords */}
            {brief.quickWins.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-dark-300 uppercase tracking-wide">
                    Quick Win Keywords ({brief.quickWins.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {brief.quickWins.slice(0, 6).map((kw, i) => (
                    <div key={i} className="flex items-center justify-between rounded bg-emerald-500/5 border border-emerald-500/15 px-2.5 py-1.5">
                      <span className="text-xs text-dark-200 truncate mr-2">{kw.keyword}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-dark-500">{kw.impressions} impr</span>
                        <span className="text-xs font-medium text-emerald-400">pos {Math.round(kw.position)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions to Answer */}
            {brief.questionsToAnswer.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-dark-300 uppercase tracking-wide">
                    Answer These Questions ({brief.questionsToAnswer.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {brief.questionsToAnswer.slice(0, 6).map((q, i) => (
                    <div key={i} className="rounded bg-blue-500/5 border border-blue-500/15 px-2.5 py-1.5">
                      <span className="text-xs text-dark-200">{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Content Gaps */}
          {brief.contentGaps.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-semibold text-dark-300 uppercase tracking-wide">Content Gaps (not yet ranking)</span>
              </div>
              <div className="space-y-1.5">
                {brief.contentGaps.slice(0, 4).map((gap, i) => (
                  <div key={i} className="rounded bg-red-500/5 border border-red-500/15 px-2.5 py-1.5">
                    <span className="text-xs text-dark-300">{gap}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topics to cover */}
          {brief.topicsTocover.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-dark-300 uppercase tracking-wide mb-2">Sections to Add</p>
              <div className="flex flex-wrap gap-1.5">
                {brief.topicsTocover.map((topic, i) => (
                  <span key={i} className="text-xs bg-dark-700 border border-dark-600 text-dark-300 px-2 py-1 rounded-md">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
