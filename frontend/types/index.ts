// ─── User & Auth ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: 'starter' | 'pro' | 'agency';
  isAdmin: boolean;
  pagesUsedThisMonth: number;
  createdAt: string;
}

export interface AuthToken {
  token: string;
  user: User;
}

// ─── Sites ────────────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  userId: string;
  domain: string;
  gscProperty?: string;
  wpUrl?: string;
  wpUsername?: string;
  pageCount?: number;
  createdAt: string;
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export type PageStatus = 'pending' | 'synced' | 'optimized' | 'published';

export interface Page {
  id: string;
  siteId: string;
  url: string;
  title?: string;
  currentContent?: string;
  optimizedContent?: string;
  status: PageStatus;
  contentScore?: number;
  lastSyncedAt?: string;
  lastOptimizedAt?: string;
  createdAt: string;
  // Joined fields
  domain?: string;
  wpUrl?: string;
  keywordCount?: number;
  totalImpressions?: number;
  totalClicks?: number;
  avgPosition?: number;
}

// ─── Keywords ────────────────────────────────────────────────────────────────

export interface Keyword {
  id: string;
  pageId: string;
  keyword: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  dateRange?: string;
}

// ─── Optimizations ───────────────────────────────────────────────────────────

export type OptimizationStatus = 'draft' | 'draft_wp' | 'published';
export type AIProvider = 'claude' | 'openai';

export interface Optimization {
  id: string;
  pageId: string;
  userId: string;
  originalContent: string;
  optimizedContent: string;
  aiProvider: AIProvider;
  contentScoreBefore: number;
  contentScoreAfter: number;
  status: OptimizationStatus;
  publishedAt?: string;
  wpPostId?: number;
  createdAt: string;
  // Joined
  pageUrl?: string;
  pageTitle?: string;
  domain?: string;
}

// ─── Content Scoring ─────────────────────────────────────────────────────────

export interface ScoreMetric {
  score: number;
  maxScore: number;
  label: string;
  description: string;
  recommendation?: string;
}

export interface ContentScoreBreakdown {
  total: number;
  metrics: {
    keywordDensity: ScoreMetric;
    readability: ScoreMetric;
    headingStructure: ScoreMetric;
    eeeatSignals: ScoreMetric;
    wordCount: ScoreMetric;
    faqPresence: ScoreMetric;
    internalLinks: ScoreMetric;
    paragraphStructure: ScoreMetric;
    titleOptimization: ScoreMetric;
    multimediaPresence: ScoreMetric;
    // Advanced metrics
    semanticCoverage?: ScoreMetric;
    keywordInPositions?: ScoreMetric;
    featuredSnippetReady?: ScoreMetric;
    searchIntentMatch?: ScoreMetric;
  };
}

// ─── Content Brief ────────────────────────────────────────────────────────────

export interface BriefKeyword {
  keyword: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

export interface ContentBrief {
  detectedIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  recommendedWordCount: string;
  primaryKeyword: string;
  quickWins: BriefKeyword[];
  questionsToAnswer: string[];
  topicsTocover: string[];
  featuredSnippetOpportunity: string;
  contentGaps: string[];
  competitorAngle: string;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  error: string;
  errors?: Array<{ msg: string; path: string }>;
}

export interface OptimizationResult {
  optimizationId: string;
  optimizedContent: string;
  originalContent: string;
  provider: AIProvider;
  suggestions: string[];
  targetedKeywords: string[];
  scoreBreakdown: {
    before: ContentScoreBreakdown;
    after: ContentScoreBreakdown;
    improvement: number;
  };
  tokensUsed: number;
}

// ─── Cannibalization ──────────────────────────────────────────────────────────

export interface CannibalizedPage {
  pageId: string;
  url: string;
  title: string;
  impressions: number;
  clicks: number;
  position: number;
  contentScore: number | null;
  status: string;
}

export interface CannibalizationConflict {
  keyword: string;
  pageCount: number;
  totalImpressions: number;
  totalClicks: number;
  bestPosition: number;
  severity: 'high' | 'medium' | 'low';
  positionSpread: number;
  recommendation: string;
  pages: CannibalizedPage[];
}

export interface CannibalizationResult {
  siteId: string;
  domain: string;
  conflicts: CannibalizationConflict[];
  total: number;
  summary: { high: number; medium: number; low: number };
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  totalPages: number;
  optimizedPages: number;
  publishedPages: number;
  avgPosition: number;
  totalImpressions: number;
  totalClicks: number;
  avgContentScore: number;
  pagesUsedThisMonth: number;
  planLimit: number;
}

// ─── Stripe / Billing ────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  pagesUsed: number;
  pagesLimit: number;
}

export interface Plan {
  name: string;
  price: number;
  pagesPerMonth: number;
  features: string[];
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: {
    total: number;
    starter: number;
    pro: number;
    agency: number;
    newToday: number;
  };
  pages: {
    total: number;
    optimized: number;
    published: number;
    totalOptimizations: number;
  };
  sites: { total: number };
  recentOptimizations: Optimization[];
}

// ─── GSC ─────────────────────────────────────────────────────────────────────

export interface GSCOverview {
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  totalPages: number;
  topPages: Array<{
    url: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}
