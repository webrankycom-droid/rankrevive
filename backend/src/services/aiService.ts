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

// Clear cached keys so next call re-reads from DB (called after admin saves settings)
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
  keywordData?: KeywordData[];   // Full GSC data for smart prioritization
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
}

function buildSEOPrompt(input: OptimizationInput): string {
  const { content, keywords, keywordData, pageUrl, pageTitle, targetPosition } = input;
  const primaryKeyword = keywords[0] || '';

  // Build GSC keyword intelligence section if full data is available
  let keywordSection = '';
  if (keywordData && keywordData.length > 0) {
    // Categorize keywords by opportunity
    const quickWins = keywordData.filter(k => k.position > 10 && k.position <= 30 && k.impressions > 5)
      .sort((a, b) => b.impressions - a.impressions);
    const protecting = keywordData.filter(k => k.position <= 10)
      .sort((a, b) => a.position - b.position);
    const lowCtr = keywordData.filter(k => k.impressions > 10 && k.ctr < 0.03 && k.position <= 20)
      .sort((a, b) => b.impressions - a.impressions);
    const allOthers = keywordData.filter(k =>
      !quickWins.includes(k) && !protecting.includes(k) && !lowCtr.includes(k)
    );

    keywordSection = `
## Google Search Console Keyword Intelligence
These are REAL keywords Google is already showing this page for. Use ALL of them naturally.

### 🎯 Quick Win Keywords (position 11–30, high search volume — push these to page 1)
${quickWins.length > 0
  ? quickWins.map(k => `- "${k.keyword}" — pos ${k.position.toFixed(0)}, ${k.impressions} impressions/mo → Use prominently in H2/H3 headings and body`).join('\n')
  : '- None in this range'}

### ✅ Protecting (already ranking top 10 — keep these ranking signals intact)
${protecting.length > 0
  ? protecting.map(k => `- "${k.keyword}" — pos ${k.position.toFixed(1)}, ${k.clicks} clicks/mo → Maintain this keyword density`).join('\n')
  : '- None'}

### 💡 High Impression / Low CTR (Google shows page but users don't click — fix search intent match)
${lowCtr.length > 0
  ? lowCtr.map(k => `- "${k.keyword}" — ${k.impressions} impressions, ${(k.ctr * 100).toFixed(1)}% CTR → Rewrite H1/intro to better match what searchers want`).join('\n')
  : '- None'}

### Additional GSC Keywords (weave naturally throughout)
${allOthers.length > 0
  ? allOthers.map(k => `- "${k.keyword}" (${k.impressions} impr, pos ${k.position.toFixed(0)})`).join('\n')
  : '- None'}
`;
  } else {
    // Fallback to simple keyword list
    keywordSection = `
## Target Keywords
- Primary: ${primaryKeyword}
- Secondary: ${keywords.slice(1, 10).join(', ')}
`;
  }

  return `You are an expert SEO content optimizer. Your task is to rewrite and optimize the following web page content to improve its Google Search ranking.

## Page Context
- URL: ${pageUrl}
- Current Title: ${pageTitle || 'Not provided'}
- Primary Keyword: ${primaryKeyword}
- Target Position: ${targetPosition ? `Top ${targetPosition}` : 'Top 10'}
${keywordSection}
## Optimization Requirements

1. **Keyword Integration** — Use ALL keywords from the GSC list above naturally:
   - Primary keyword in H1, first 100 words, 2–3 subheadings, last paragraph (~1.5% density)
   - Quick Win keywords in H2/H3 headings and dedicated sections
   - Low-CTR keywords addressed in the intro (match what searchers actually want)
   - All other GSC keywords woven naturally into body paragraphs — do NOT ignore them

2. **Content Structure**:
   - Clear H1 → H2 → H3 hierarchy
   - Short paragraphs (3–5 sentences max)
   - Bullet points or numbered lists where appropriate
   - Add a FAQ section at the end using 3–5 questions based on the GSC keywords (these reflect what people actually search)

3. **E-E-A-T Signals**:
   - Add specific statistics, data points, or cite authoritative sources
   - Include expert perspective language ("According to SEO best practices...")
   - Add actionable advice and real-world examples
   - Demonstrate firsthand experience where relevant

4. **Readability**:
   - Flesch-Kincaid Grade Level: 8–10 (accessible but professional)
   - Use active voice predominantly
   - Vary sentence length
   - Add transition words for flow

5. **Additional SEO Elements**:
   - Suggest internal linking opportunities with [INTERNAL LINK: topic] markers
   - Bold important phrases (2–4 per section)

## Output Format
Return ONLY the optimized HTML content. Use proper semantic HTML:
- <h1> for main title
- <h2> for major sections
- <h3> for subsections
- <p> for paragraphs
- <ul>/<ol> for lists
- <strong> for important phrases
- <section> to wrap major content blocks
- Include a <div class="faq-section"> for FAQ

Do not include <html>, <head>, or <body> tags. Only the content HTML.

## Original Content to Optimize:
${content}

Remember: The optimized content must read naturally to humans while being strategically optimized for search engines. Do not stuff keywords artificially. Every GSC keyword listed above is a real search query — treat them as user intent signals.`;
}

export async function optimizeWithClaude(input: OptimizationInput): Promise<OptimizationResult> {
  const prompt = buildSEOPrompt(input);
  const client = await getAnthropic();

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
    system: 'You are an expert SEO content strategist with 10+ years of experience helping websites recover lost rankings. You produce clean, semantic HTML with natural keyword integration.',
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const optimizedContent = textBlock?.text || '';
  const suggestions = extractSuggestions(optimizedContent, input.keywords);

  return {
    optimizedContent,
    provider: 'claude',
    suggestions,
    targetedKeywords: input.keywords.slice(0, 10),
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

export async function optimizeWithOpenAI(input: OptimizationInput): Promise<OptimizationResult> {
  const prompt = buildSEOPrompt(input);
  const client = await getOpenAI();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: 'You are an expert SEO content strategist with 10+ years of experience helping websites recover lost rankings. You produce clean, semantic HTML with natural keyword integration.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  });

  const optimizedContent = response.choices[0]?.message?.content || '';
  const suggestions = extractSuggestions(optimizedContent, input.keywords);

  return {
    optimizedContent,
    provider: 'openai',
    suggestions,
    targetedKeywords: input.keywords.slice(0, 10),
    tokensUsed: response.usage?.total_tokens || 0,
  };
}

function extractSuggestions(content: string, keywords: string[]): string[] {
  const suggestions: string[] = [];
  if (keywords.length > 0 && content.toLowerCase().includes(keywords[0].toLowerCase())) {
    suggestions.push(`Primary keyword "${keywords[0]}" successfully integrated`);
  }
  if (content.includes('<h1>')) suggestions.push('H1 heading present');
  if (content.includes('<h2>')) suggestions.push('H2 subheadings added for structure');
  if (content.includes('faq') || content.includes('FAQ')) suggestions.push('FAQ section added for featured snippet opportunities');
  if (content.includes('<ul>') || content.includes('<ol>')) suggestions.push('Lists added for improved readability');
  if (content.includes('<strong>')) suggestions.push('Key phrases bolded for emphasis');
  return suggestions;
}

export async function optimizeContent(
  input: OptimizationInput,
  provider: AIProvider = 'claude'
): Promise<OptimizationResult> {
  if (provider === 'openai') return optimizeWithOpenAI(input);
  return optimizeWithClaude(input);
}

export async function generateMetaTags(
  content: string,
  primaryKeyword: string,
  pageTitle?: string
): Promise<{ title: string; description: string; ogTitle: string; ogDescription: string }> {
  const client = await getAnthropic();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Generate SEO-optimized meta tags for this content.

Primary Keyword: ${primaryKeyword}
Current Title: ${pageTitle || 'Not provided'}

Content excerpt:
${content.substring(0, 1000)}

Return a JSON object with these exact fields:
{
  "title": "SEO title (50-60 chars, include keyword near start)",
  "description": "Meta description (150-160 chars, include keyword, compelling CTA)",
  "ogTitle": "Open Graph title (can be slightly longer than title tag)",
  "ogDescription": "OG description (can be slightly more conversational)"
}

Return ONLY the JSON object, no other text.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  try {
    return JSON.parse(textBlock?.text || '{}');
  } catch {
    return {
      title: `${primaryKeyword} | Complete Guide`,
      description: `Learn everything about ${primaryKeyword}. Expert tips, strategies, and actionable advice.`,
      ogTitle: `The Complete ${primaryKeyword} Guide`,
      ogDescription: `Comprehensive guide to ${primaryKeyword} with expert insights and proven strategies.`,
    };
  }
}
