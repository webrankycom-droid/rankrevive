import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { queryOne } from '../db';

// Cache DB-sourced API keys for 5 minutes to avoid repeated DB hits
const _keyCache: Record<string, { value: string; expires: number }> = {};

async function getApiKey(envVar: string): Promise<string> {
  if (process.env[envVar]) return process.env[envVar]!;
  const cached = _keyCache[envVar];
  if (cached && cached.expires > Date.now()) return cached.value;
  const row = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = $1', [envVar]);
  if (!row?.value) {
    throw new Error(`${envVar} is not configured. Go to Admin -> Configuration to add it.`);
  }
  _keyCache[envVar] = { value: row.value, expires: Date.now() + 5 * 60 * 1000 };
  return row.value;
}

export function clearApiKeyCache(): void {
  Object.keys(_keyCache).forEach((k) => delete _keyCache[k]);
}

async function getAnthropic(): Promise<Anthropic> {
  const apiKey = await getApiKey('ANTHROPIC_API_KEY');
  return new Anthropic({ apiKey });
}

async function getOpenAI(): Promise<OpenAI> {
  const apiKey = await getApiKey('OPENAI_API_KEY');
  return new OpenAI({ apiKey });
}

export type AIProvider = 'claude' | 'openai';
export type SearchIntent = 'informational' | 'commercial' | 'transactional' | 'navigational';

export interface KeywordData {
  keyword: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

export interface OptimizationInput {
  content: string;
  keywords: string[];
  keywordData?: KeywordData[];
  pageUrl: string;
  pageTitle?: string;
  targetPosition?: number;
}

export interface OptimizationResult {
  optimizedContent: string;
  provider: AIProvider;
  suggestions: string[];
  targetedKeywords: string[];
  tokensUsed: number;
  detectedIntent?: SearchIntent;
}

// ─── Search Intent Detection ──────────────────────────────────────────────────

export function detectSearchIntent(keywords: string[]): SearchIntent {
  const allKw = keywords.join(' ').toLowerCase();

  const transactionalSignals = /\b(buy|purchase|order|price|cost|cheap|discount|coupon|deal|shop|sale|free shipping|credit card|apply|sign up|get started|download|subscribe)\b/;
  const commercialSignals = /\b(best|top|review|vs|versus|compare|comparison|alternative|ranking|rated|recommended|pros and cons|worth it)\b/;
  const informationalSignals = /\b(how|what|why|when|where|who|guide|tutorial|tips|learn|explain|definition|meaning|example|idea|benefit|way to|steps)\b/;

  if (transactionalSignals.test(allKw)) return 'transactional';
  if (commercialSignals.test(allKw)) return 'commercial';
  if (informationalSignals.test(allKw)) return 'informational';
  return 'informational'; // default
}

function getIntentStrategy(intent: SearchIntent): string {
  switch (intent) {
    case 'transactional':
      return `
## Intent: TRANSACTIONAL — User wants to take action (apply, buy, sign up)
Content Strategy:
- Lead with a clear value proposition in H1 and first paragraph
- Use action-oriented language throughout (apply now, get started, claim your)
- Add a prominent CTA section early in the content
- Include trust signals: security badges, guarantees, ratings (e.g., "4.8/5 stars")
- List key features/benefits with checkmarks (✓) in bullet points
- Address objections directly (fees, eligibility, requirements)
- Keep content focused (800-1500 words) — don't pad with unnecessary info
- End with a strong CTA section`;

    case 'commercial':
      return `
## Intent: COMMERCIAL INVESTIGATION — User is comparing options before deciding
Content Strategy:
- Position this option clearly vs. alternatives early
- Include a comparison table (pros/cons, features, pricing)
- Use subheadings for each key decision factor
- Add specific data points (APR, fees, limits, rewards rates)
- Include "Who is this best for?" section
- Address "Is it worth it?" directly
- Add expert verdict / bottom line section
- Target length: 1500-3000 words for thorough coverage
- End with clear recommendation`;

    case 'informational':
      return `
## Intent: INFORMATIONAL — User wants to learn and understand
Content Strategy:
- Start with a clear definition or direct answer in first 50 words (featured snippet target)
- Use a logical content flow: What → Why → How → Examples → FAQ
- Add real-world examples and case studies
- Include statistics and data with year (e.g., "According to 2024 data...")
- Use analogies to explain complex concepts
- Add a comprehensive FAQ section (5-7 questions from GSC queries)
- Target length: 2000-3500 words for comprehensive coverage
- Include a summary/TL;DR box at the start or end`;

    case 'navigational':
      return `
## Intent: NAVIGATIONAL — User is looking for a specific page or brand
Content Strategy:
- Make the brand/product name clear immediately
- Provide direct answers about what this page is and does
- Include clear navigation aids (table of contents, jump links)
- Focus on the most important information first
- Keep it concise and scannable
- Target length: 500-1000 words`;
  }
}

function getFeaturedSnippetStrategy(keywords: string[]): string {
  const allKw = keywords.join(' ').toLowerCase();

  const isDefinitionQuery = /\bwhat is\b|\bwhat are\b|\bdefin/i.test(allKw);
  const isHowToQuery = /\bhow to\b|\bhow do\b|\bsteps to\b/i.test(allKw);
  const isListQuery = /\bbest\b|\btop \d|\blist of\b|\btypes of\b/i.test(allKw);
  const isComparisonQuery = /\bvs\b|\bversus\b|\bdifference between\b/i.test(allKw);

  const opportunities: string[] = [];

  if (isDefinitionQuery) {
    opportunities.push('DEFINITION BOX: Write a concise 40-55 word definition paragraph immediately after H1. This is the highest chance for a featured snippet. Format: "[Topic] is [clear, direct definition]. [One supporting sentence]. [One use case or example]."');
  }
  if (isHowToQuery) {
    opportunities.push('HOW-TO LIST: Include a numbered step-by-step section with 4-8 clear steps. Each step: short headline + 1-2 sentence explanation. Google often pulls this as a featured snippet.');
  }
  if (isListQuery) {
    opportunities.push('BEST-OF LIST: Include a clearly formatted list with each item as an H3 heading. Add 2-3 sentences per item. Google often features the list structure in position 0.');
  }
  if (isComparisonQuery) {
    opportunities.push('COMPARISON TABLE: Add an HTML table comparing the key options. Include: Feature | Option A | Option B format. Tables frequently win featured snippets for comparison queries.');
  }

  if (opportunities.length === 0) {
    opportunities.push('QUICK ANSWER BOX: Add a 40-55 word direct answer to the primary query in the first section. Start with the keyword phrase and give an immediate answer.');
  }

  return `\n## Featured Snippet Opportunities\n${opportunities.map(o => `- ${o}`).join('\n')}`;
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildSEOPrompt(input: OptimizationInput): string {
  const { content, keywords, keywordData, pageUrl, pageTitle } = input;
  const primaryKeyword = keywords[0] || '';
  const intent = detectSearchIntent(keywords);
  const intentStrategy = getIntentStrategy(intent);
  const snippetStrategy = getFeaturedSnippetStrategy(keywords);

  // Build GSC keyword intelligence section
  let keywordSection = '';
  if (keywordData && keywordData.length > 0) {
    const quickWins = keywordData
      .filter(k => k.position > 10 && k.position <= 30 && k.impressions > 3)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 8);

    const protecting = keywordData
      .filter(k => k.position <= 10)
      .sort((a, b) => a.position - b.position)
      .slice(0, 6);

    const lowCtr = keywordData
      .filter(k => k.impressions > 10 && k.ctr < 0.03 && k.position <= 20)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    const questionKeywords = keywordData
      .filter(k => /^(how|what|why|when|where|which|can|does|is|are)\b/i.test(k.keyword))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 6);

    const allOthers = keywordData
      .filter(k => !quickWins.includes(k) && !protecting.includes(k) && !lowCtr.includes(k) && !questionKeywords.includes(k))
      .slice(0, 10);

    keywordSection = `
## Google Search Console Keyword Intelligence
These are REAL keywords from Google — weave ALL of them naturally into the content.

${quickWins.length ? `### 🎯 Quick Win Keywords (position 11–30 — one good article pushes these to page 1)
${quickWins.map(k => `- "${k.keyword}" — pos ${k.position.toFixed(0)}, ${k.impressions} impressions → Create a dedicated H2 or H3 section`).join('\n')}` : ''}

${protecting.length ? `### ✅ Ranking Keywords (top 10 — keep these signals strong)
${protecting.map(k => `- "${k.keyword}" — pos ${k.position.toFixed(1)}, ${k.clicks} clicks/mo → Maintain density, don't dilute`).join('\n')}` : ''}

${lowCtr.length ? `### 💡 Low CTR Keywords (Google shows page but users don't click — fix search intent match)
${lowCtr.map(k => `- "${k.keyword}" — ${k.impressions} impressions, ${(k.ctr * 100).toFixed(1)}% CTR → Rewrite H1/intro so searcher immediately finds what they want`).join('\n')}` : ''}

${questionKeywords.length ? `### ❓ Question Keywords (real questions from Google — answer each one in FAQ or body)
${questionKeywords.map(k => `- "${k.keyword}" (${k.impressions} searches/mo)`).join('\n')}` : ''}

${allOthers.length ? `### Additional GSC Keywords (weave naturally — every one is a real search signal)
${allOthers.map(k => `"${k.keyword}" (${k.impressions} impr)`).join(', ')}` : ''}`;

  } else {
    keywordSection = `
## Target Keywords
- Primary: ${primaryKeyword}
- Secondary: ${keywords.slice(1, 10).join(', ')}`;
  }

  return `You are a world-class SEO content strategist. Your task is to rewrite and optimize this page to rank in the top 3 Google results.
${intentStrategy}
${snippetStrategy}
${keywordSection}

## Page Context
- URL: ${pageUrl}
- Current Title: ${pageTitle || 'Not provided'}
- Primary Keyword: ${primaryKeyword}
- Detected Intent: ${intent.toUpperCase()}

## Core Optimization Requirements

### 1. Keyword Integration (ALL GSC keywords must appear naturally)
- Primary keyword: H1 + first 100 words + 2–3 subheadings + last paragraph (1–2% density)
- Quick Win keywords: each gets its own H2 or H3 section — this is how you push them to page 1
- Question keywords: each answered directly in body text or FAQ section
- All other GSC keywords: woven naturally throughout — they represent real user searches

### 2. Content Structure for ${intent.toUpperCase()} intent
- Clear H1 → H2 → H3 hierarchy, never skip levels
- Short paragraphs (3–4 sentences max), white space matters for UX and dwell time
- Use numbered lists for processes, bullet points for features/benefits
- Add a Table of Contents with anchor links if content exceeds 1500 words
- Bold the most important phrases (2–3 per section) — readers scan before they read

### 3. E-E-A-T (Experience, Expertise, Authority, Trustworthiness)
- Include at least 3 specific statistics with year (e.g., "As of 2024...")
- Add at least one direct quote style statement showing expertise ("The key thing most people miss is...")
- Include "who is this for" / "who should avoid this" framing where relevant
- Trust signals: mention any credentials, certifications, or factual backing

### 4. FAQ Section (target question keywords from GSC above)
- Write 4–6 Q&A pairs based on the Question Keywords listed above
- Each answer: 40–80 words, direct and actionable
- Use <div class="faq-section"> wrapper for schema markup readiness
- Questions should use exact phrasing from GSC when possible

### 5. Semantic Completeness
- The optimized content must cover the TOPIC comprehensively, not just the keywords
- Include related concepts, entities, and subtopics Google expects to see on this page
- Avoid surface-level coverage — Google rewards depth over breadth

## Output Format — Strict Rules
- Return ONLY the HTML content (no <html>, <head>, <body> tags)
- Use: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <table>, <section>
- Wrap FAQ in: <div class="faq-section">
- Add id attributes to H2s for table of contents (e.g., <h2 id="what-is-x">)
- Mark internal linking opportunities: [INTERNAL LINK: topic to link]
- DO NOT make up statistics — only include data you are confident is accurate

## Original Content to Optimize:
${content}

CRITICAL: Every keyword listed in the GSC section above is a real user search. Treating them as random phrases to stuff in is wrong — treat them as user needs to satisfy. The article must genuinely help the person who searched for any of those terms.`;
}

// ─── AI Calls ─────────────────────────────────────────────────────────────────

export async function optimizeWithClaude(input: OptimizationInput): Promise<OptimizationResult> {
  const prompt = buildSEOPrompt(input);
  const client = await getAnthropic();
  const intent = detectSearchIntent(input.keywords);

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a world-class SEO content strategist with 15+ years of experience. You write content that ranks in Google AND converts readers. You produce clean, semantic HTML with natural keyword integration that reads like it was written by a human expert, not an AI optimizing for algorithms.',
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const optimizedContent = textBlock?.text || '';
  const suggestions = extractSuggestions(optimizedContent, input.keywords, intent);

  return {
    optimizedContent,
    provider: 'claude',
    suggestions,
    targetedKeywords: input.keywords.slice(0, 15),
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    detectedIntent: intent,
  };
}

export async function optimizeWithOpenAI(input: OptimizationInput): Promise<OptimizationResult> {
  const prompt = buildSEOPrompt(input);
  const client = await getOpenAI();
  const intent = detectSearchIntent(input.keywords);

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 6000,
    messages: [
      {
        role: 'system',
        content: 'You are a world-class SEO content strategist with 15+ years of experience. You write content that ranks in Google AND converts readers. You produce clean, semantic HTML with natural keyword integration.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.65,
  });

  const optimizedContent = response.choices[0]?.message?.content || '';
  const suggestions = extractSuggestions(optimizedContent, input.keywords, intent);

  return {
    optimizedContent,
    provider: 'openai',
    suggestions,
    targetedKeywords: input.keywords.slice(0, 15),
    tokensUsed: response.usage?.total_tokens || 0,
    detectedIntent: intent,
  };
}

function extractSuggestions(content: string, keywords: string[], intent: SearchIntent): string[] {
  const suggestions: string[] = [];

  suggestions.push(`Detected search intent: ${intent} — content optimized accordingly`);
  if (keywords.length > 0 && content.toLowerCase().includes(keywords[0].toLowerCase())) {
    suggestions.push(`Primary keyword "${keywords[0]}" integrated`);
  }
  if (content.includes('<h1>')) suggestions.push('H1 heading present');
  if (content.includes('<h2>')) suggestions.push('H2 subheadings added for structure');
  if (content.includes('faq') || content.includes('FAQ') || content.includes('faq-section')) {
    suggestions.push('FAQ section added — eligible for Google FAQ rich results');
  }
  if (content.includes('<ul>') || content.includes('<ol>')) suggestions.push('Lists added for readability and featured snippet eligibility');
  if (content.includes('<strong>')) suggestions.push('Key phrases bolded for emphasis and scanning');
  if (content.includes('<table>')) suggestions.push('Comparison table added — high featured snippet potential');
  if (content.includes('[INTERNAL LINK:')) {
    const linkCount = (content.match(/\[INTERNAL LINK:/g) || []).length;
    suggestions.push(`${linkCount} internal linking opportunities identified`);
  }
  if (intent === 'transactional') suggestions.push('CTA-focused structure applied for conversion optimization');
  if (intent === 'commercial') suggestions.push('Comparison structure applied for commercial investigation queries');

  return suggestions;
}

export async function optimizeContent(
  input: OptimizationInput,
  provider: AIProvider = 'claude'
): Promise<OptimizationResult> {
  if (provider === 'openai') return optimizeWithOpenAI(input);
  return optimizeWithClaude(input);
}

// ─── Content Brief Generator ──────────────────────────────────────────────────

export interface ContentBrief {
  detectedIntent: SearchIntent;
  recommendedWordCount: string;
  primaryKeyword: string;
  quickWins: KeywordData[];
  questionsToAnswer: string[];
  topicsTocover: string[];
  featuredSnippetOpportunity: string;
  contentGaps: string[];
  competitorAngle: string;
}

export function generateContentBrief(input: {
  keywords: string[];
  keywordData?: KeywordData[];
  pageTitle?: string;
  currentWordCount?: number;
}): ContentBrief {
  const { keywords, keywordData, pageTitle, currentWordCount } = input;
  const intent = detectSearchIntent(keywords);

  const wordCountTargets: Record<SearchIntent, string> = {
    informational: '2000–3500 words (comprehensive guide)',
    commercial: '1800–3000 words (thorough comparison)',
    transactional: '900–1600 words (focused, action-oriented)',
    navigational: '500–1000 words (concise, direct)',
  };

  const quickWins = (keywordData || [])
    .filter(k => k.position > 10 && k.position <= 30 && k.impressions > 3)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  const questionsToAnswer = (keywordData || [])
    .filter(k => /^(how|what|why|when|where|which|can|does|is|are)\b/i.test(k.keyword))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8)
    .map(k => k.keyword);

  const topicsTocover = quickWins.slice(0, 5).map(k => {
    const kw = k.keyword.toLowerCase().replace(keywords[0]?.toLowerCase() || '', '').trim();
    return kw.length > 3 ? `Section on: ${k.keyword}` : `Expand coverage of: ${k.keyword}`;
  });

  // Identify content gaps — keywords with impressions but position > 30
  const contentGaps = (keywordData || [])
    .filter(k => k.position > 30 && k.impressions > 5)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map(k => `"${k.keyword}" — ${k.impressions} monthly searches, currently not ranking (pos ${k.position.toFixed(0)})`);

  const snippetOpportunity = getFeaturedSnippetStrategy(keywords)
    .replace('\n## Featured Snippet Opportunities\n', '').trim();

  const gapFromTarget = currentWordCount
    ? wordCountTargets[intent].match(/(\d+)/)
      ? Math.max(0, parseInt(wordCountTargets[intent].match(/(\d+)/)![1]) - currentWordCount)
      : 0
    : 0;

  const competitorAngles: Record<SearchIntent, string> = {
    informational: 'Competitors ranking for this likely have 2000+ words, clear definitions, and FAQ sections. Match or exceed their depth.',
    commercial: 'Competitors ranking here use comparison tables, pros/cons lists, and clear expert verdicts. Include all three.',
    transactional: 'Competitors ranking here lead with the offer, benefits, and social proof immediately. Reduce friction to conversion.',
    navigational: 'Competitors here are direct and answer the core question immediately. Avoid fluff.',
  };

  return {
    detectedIntent: intent,
    recommendedWordCount: wordCountTargets[intent] + (gapFromTarget > 0 ? ` (need ~${gapFromTarget} more words)` : ''),
    primaryKeyword: keywords[0] || '',
    quickWins,
    questionsToAnswer,
    topicsTocover,
    featuredSnippetOpportunity: snippetOpportunity,
    contentGaps,
    competitorAngle: competitorAngles[intent],
  };
}

// ─── Meta Tags ────────────────────────────────────────────────────────────────

export async function generateMetaTags(
  content: string,
  primaryKeyword: string,
  pageTitle?: string
): Promise<{ title: string; description: string; ogTitle: string; ogDescription: string }> {
  const client = await getAnthropic();
  const intent = detectSearchIntent([primaryKeyword]);

  const intentGuidance: Record<SearchIntent, string> = {
    transactional: 'Include a power word (Get, Apply, Start). Add urgency or benefit (e.g., "No Annual Fee", "Earn 5x Points").',
    commercial: 'Include a comparison hook (Best, Top, vs). Hint at the verdict.',
    informational: 'Answer the question implicitly. Include the year if relevant.',
    navigational: 'Be direct and clear about what the page is.',
  };

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Generate high-CTR SEO meta tags for this page.

Primary Keyword: ${primaryKeyword}
Search Intent: ${intent}
Intent Guidance: ${intentGuidance[intent]}
Current Title: ${pageTitle || 'Not provided'}

Content excerpt:
${content.substring(0, 800)}

Return a JSON object:
{
  "title": "SEO title tag (50-60 chars, keyword near start, compelling)",
  "description": "Meta description (145-155 chars, keyword included, strong CTA or hook)",
  "ogTitle": "Open Graph title (can be more engaging/emotional than title tag)",
  "ogDescription": "OG description (more conversational, can be 1-2 sentences)"
}

Return ONLY the JSON, no other text.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  try {
    return JSON.parse(textBlock?.text || '{}');
  } catch {
    return {
      title: `${primaryKeyword} — Complete Guide ${new Date().getFullYear()}`,
      description: `Everything you need to know about ${primaryKeyword}. Expert guide with tips, examples, and actionable advice.`,
      ogTitle: `The Complete Guide to ${primaryKeyword}`,
      ogDescription: `Learn everything about ${primaryKeyword} with expert insights and proven strategies.`,
    };
  }
}
