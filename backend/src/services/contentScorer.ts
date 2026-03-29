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
    semanticCoverage: ScoreMetric;
    keywordInPositions: ScoreMetric;
    featuredSnippetReady: ScoreMetric;
    searchIntentMatch: ScoreMetric;
  };
}

export interface ScoreMetric {
  score: number;
  maxScore: number;
  label: string;
  description: string;
  recommendation?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countHeadings(html: string): { h1: number; h2: number; h3: number } {
  return {
    h1: (html.match(/<h1[^>]*>/gi) || []).length,
    h2: (html.match(/<h2[^>]*>/gi) || []).length,
    h3: (html.match(/<h3[^>]*>/gi) || []).length,
  };
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

function averageSentenceLength(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  return sentences > 0 ? words / sentences : 0;
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const syllables = word.match(/[aeiouy]{1,2}/g);
  return syllables ? syllables.length : 1;
}

function fleschKincaidGradeLevel(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = countSentences(text);
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  if (words.length === 0 || sentences === 0) return 0;
  return 0.39 * (words.length / sentences) + 11.8 * (totalSyllables / words.length) - 15.59;
}

/** Lightweight intent detection (no import from aiService to avoid coupling) */
type SimpleIntent = 'informational' | 'commercial' | 'transactional' | 'navigational';

function detectIntent(keywords: string[]): SimpleIntent {
  const allKw = keywords.join(' ').toLowerCase();
  if (/\b(buy|purchase|order|price|cost|cheap|discount|coupon|deal|apply|sign up|get started|download|subscribe|credit card)\b/.test(allKw)) return 'transactional';
  if (/\b(best|top|review|vs|versus|compare|comparison|alternative|ranking|rated|recommended|pros and cons|worth it)\b/.test(allKw)) return 'commercial';
  if (/\b(how|what|why|when|where|who|guide|tutorial|tips|learn|explain|definition|meaning|example|benefit|steps)\b/.test(allKw)) return 'informational';
  return 'informational';
}

// ─── Existing Metrics ─────────────────────────────────────────────────────────

function scoreKeywordDensity(content: string, keywords: string[]): ScoreMetric {
  if (!keywords.length) {
    return { score: 5, maxScore: 15, label: 'Keyword Density', description: 'No keywords provided', recommendation: 'Add target keywords for better optimization' };
  }

  const text = stripHtml(content).toLowerCase();
  const wordCount = countWords(text);
  const primaryKw = keywords[0].toLowerCase();
  const occurrences = (text.match(new RegExp(primaryKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  const density = wordCount > 0 ? (occurrences / wordCount) * 100 : 0;

  let score = 0;
  let recommendation: string | undefined;

  if (density >= 0.5 && density <= 2.5) {
    score = 15;
  } else if (density >= 0.3 && density < 0.5) {
    score = 10;
    recommendation = `Increase keyword density slightly. Current: ${density.toFixed(2)}%. Target: 0.5-2.5%`;
  } else if (density > 2.5 && density <= 4) {
    score = 8;
    recommendation = `Keyword density too high (${density.toFixed(2)}%). Reduce to avoid over-optimization.`;
  } else if (density > 4) {
    score = 3;
    recommendation = `Keyword stuffing detected (${density.toFixed(2)}%). Significantly reduce keyword usage.`;
  } else {
    score = 5;
    recommendation = `Very low keyword density (${density.toFixed(2)}%). Add more instances of "${keywords[0]}"`;
  }

  return {
    score,
    maxScore: 15,
    label: 'Keyword Density',
    description: `Primary keyword density: ${density.toFixed(2)}% (${occurrences} occurrences in ${wordCount} words)`,
    recommendation,
  };
}

function scoreReadability(content: string): ScoreMetric {
  const text = stripHtml(content);
  const gradeLevel = fleschKincaidGradeLevel(text);
  const avgSentenceLen = averageSentenceLength(text);

  let score = 0;
  let recommendation: string | undefined;

  if (gradeLevel >= 6 && gradeLevel <= 10) {
    score = 15;
  } else if (gradeLevel > 10 && gradeLevel <= 12) {
    score = 10;
    recommendation = 'Content is somewhat complex. Simplify sentences for better readability.';
  } else if (gradeLevel > 12) {
    score = 5;
    recommendation = `Content is too complex (Grade Level: ${gradeLevel.toFixed(1)}). Aim for Grade Level 8-10.`;
  } else if (gradeLevel < 6) {
    score = 8;
    recommendation = 'Content may be too simple. Add more depth and detailed explanations.';
  }

  if (avgSentenceLen > 25) {
    score = Math.max(score - 3, 0);
    recommendation = (recommendation || '') + ` Average sentence length (${avgSentenceLen.toFixed(0)} words) is too long. Target 15-20 words.`;
  }

  return {
    score,
    maxScore: 15,
    label: 'Readability',
    description: `Flesch-Kincaid Grade Level: ${gradeLevel.toFixed(1)}, Avg sentence: ${avgSentenceLen.toFixed(0)} words`,
    recommendation,
  };
}

function scoreHeadingStructure(content: string): ScoreMetric {
  const headings = countHeadings(content);
  let score = 0;
  const issues: string[] = [];

  if (headings.h1 === 1) { score += 5; }
  else if (headings.h1 === 0) { issues.push('Missing H1 heading'); }
  else { issues.push('Multiple H1 headings (should have exactly 1)'); score += 2; }

  if (headings.h2 >= 3) { score += 5; }
  else if (headings.h2 >= 1) { score += 3; issues.push(`Only ${headings.h2} H2 headings. Add at least 3 for better structure.`); }
  else { issues.push('No H2 subheadings. Add H2s to structure your content.'); }

  if (headings.h3 >= 2) { score += 3; }
  else if (headings.h3 === 1) { score += 1; }

  return {
    score,
    maxScore: 13,
    label: 'Heading Structure',
    description: `H1: ${headings.h1}, H2: ${headings.h2}, H3: ${headings.h3}`,
    recommendation: issues.length ? issues.join('. ') : undefined,
  };
}

function scoreEEAT(content: string): ScoreMetric {
  const text = stripHtml(content).toLowerCase();
  let score = 0;
  const signals: string[] = [];
  const missing: string[] = [];

  const experienceTerms = ['years of experience', 'we have', 'our team', 'i have', 'in my experience', 'based on our'];
  if (experienceTerms.some((t) => text.includes(t))) { score += 2; signals.push('Experience signals present'); }
  else missing.push('Add experience signals (e.g., "Based on our X years of experience...")');

  const expertiseTerms = ['expert', 'specialist', 'professional', 'according to', 'research shows', 'studies show', 'data shows'];
  if (expertiseTerms.some((t) => text.includes(t))) { score += 2; signals.push('Expertise signals present'); }
  else missing.push('Add expertise signals (cite research or expert opinions)');

  const authorityTerms = ['study', 'research', 'published', 'university', 'institute', 'journal', '%', 'statistics'];
  if (authorityTerms.some((t) => text.includes(t))) { score += 2; signals.push('Authority signals (data/stats) present'); }
  else missing.push('Add authoritative data, statistics, or citations');

  const trustTerms = ['privacy', 'secure', 'guarantee', 'certified', 'award', 'trusted', 'verified'];
  if (trustTerms.some((t) => text.includes(t))) { score += 2; signals.push('Trust signals present'); }

  if (/\d+\.?\d*\s*(%|percent|million|billion|thousand|users|customers)/i.test(text)) { score += 2; signals.push('Specific data points present'); }
  else missing.push('Add specific numbers and data points');

  return {
    score,
    maxScore: 10,
    label: 'E-E-A-T Signals',
    description: `${signals.length} E-E-A-T signals detected`,
    recommendation: missing.length ? missing.slice(0, 2).join('. ') : undefined,
  };
}

function scoreWordCount(content: string): ScoreMetric {
  const wordCount = countWords(content);
  let score = 0;
  let recommendation: string | undefined;

  if (wordCount >= 1500 && wordCount <= 3000) { score = 10; }
  else if (wordCount >= 1000 && wordCount < 1500) { score = 7; recommendation = `Content is ${wordCount} words. Aim for 1500-2500 words for comprehensive coverage.`; }
  else if (wordCount >= 3000) { score = 8; recommendation = 'Very long content. Ensure it stays focused and avoid padding.'; }
  else if (wordCount >= 600) { score = 4; recommendation = `Thin content (${wordCount} words). Expand to at least 1000 words.`; }
  else { score = 1; recommendation = `Very thin content (${wordCount} words). Needs significant expansion.`; }

  return { score, maxScore: 10, label: 'Word Count', description: `${wordCount.toLocaleString()} words`, recommendation };
}

function scoreFAQPresence(content: string): ScoreMetric {
  const hasFAQ = /faq|frequently asked|questions?.*answer/i.test(content);
  const faqItemCount = (content.match(/<dt>|class="faq-question"|class="question"|faq-section/gi) || []).length;

  let score = 0;
  let recommendation: string | undefined;

  if (hasFAQ && faqItemCount >= 3) { score = 8; }
  else if (hasFAQ) { score = 5; recommendation = 'FAQ section present but add at least 3-5 Q&A pairs for better featured snippet chances.'; }
  else { score = 0; recommendation = 'Add a FAQ section with 3-5 questions. FAQ schema can trigger rich results in Google.'; }

  return {
    score,
    maxScore: 8,
    label: 'FAQ Section',
    description: hasFAQ ? `FAQ section found (${faqItemCount} items detected)` : 'No FAQ section found',
    recommendation,
  };
}

function scoreInternalLinks(content: string): ScoreMetric {
  const linkMatches = content.match(/<a\s[^>]*href=["|'][^"']*["|'][^>]*>/gi) || [];
  const externalLinks = linkMatches.filter((l) => /href=["']https?:\/\//i.test(l));
  const internalLinks = linkMatches.filter((l) => !(/href=["']https?:\/\//i.test(l)) && !/href=["']#/i.test(l));
  const markedLinks = (content.match(/\[INTERNAL LINK:/g) || []).length;
  const totalInternal = internalLinks.length + markedLinks;

  let score = 0;
  let recommendation: string | undefined;

  if (totalInternal >= 3) { score = 7; }
  else if (totalInternal >= 1) { score = 4; recommendation = `Only ${totalInternal} internal link(s). Add 3-5 internal links to related content.`; }
  else { score = 0; recommendation = 'No internal links found. Add 3-5 links to related pages on your site.'; }

  return {
    score,
    maxScore: 7,
    label: 'Internal Links',
    description: `${totalInternal} internal link(s), ${externalLinks.length} external link(s)`,
    recommendation,
  };
}

function scoreParagraphStructure(content: string): ScoreMetric {
  const paragraphs = content.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  const longParagraphs = paragraphs.filter((p) => countWords(p) > 100).length;
  const hasBulletPoints = /<ul|<ol/i.test(content);
  const hasBoldText = /<strong|<b>/i.test(content);

  let score = 0;
  const details: string[] = [];

  if (paragraphs.length >= 5) { score += 2; details.push(`${paragraphs.length} paragraphs`); }
  if (longParagraphs === 0) { score += 2; } else { details.push(`${longParagraphs} overly long paragraphs`); }
  if (hasBulletPoints) { score += 2; details.push('Lists present'); }
  if (hasBoldText) { score += 2; details.push('Bold text for emphasis'); }

  return {
    score,
    maxScore: 8,
    label: 'Paragraph Structure',
    description: details.join(', ') || 'Basic structure',
    recommendation: longParagraphs > 0 ? `${longParagraphs} paragraphs are too long (>100 words). Break them into smaller chunks.` : undefined,
  };
}

function scoreTitleOptimization(content: string, keywords: string[]): ScoreMetric {
  const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match ? stripHtml(h1Match[0]).toLowerCase() : '';
  const primaryKw = keywords[0]?.toLowerCase() || '';

  let score = 0;
  const details: string[] = [];

  if (h1Text) {
    score += 2;
    details.push('H1 present');
    if (primaryKw && h1Text.includes(primaryKw)) { score += 5; details.push('Primary keyword in H1'); }
    else if (primaryKw) { details.push('Primary keyword missing from H1'); }
    const h1Words = h1Text.split(/\s+/).length;
    if (h1Words >= 5 && h1Words <= 12) { score += 2; details.push('H1 length optimal'); }
  }

  return {
    score,
    maxScore: 9,
    label: 'Title Optimization',
    description: h1Text ? `H1: "${h1Text.substring(0, 60)}${h1Text.length > 60 ? '...' : ''}"` : 'No H1 found',
    recommendation: !h1Text ? 'Add an H1 heading with your primary keyword' :
      (primaryKw && !h1Text.includes(primaryKw) ? `Include "${primaryKw}" in your H1 heading` : undefined),
  };
}

function scoreMultimedia(content: string): ScoreMetric {
  const images = (content.match(/<img/gi) || []).length;
  const videos = (content.match(/<video|youtube\.com\/embed|vimeo\.com\/video/gi) || []).length;
  const hasAltText = !/(<img(?![^>]*alt=)[^>]*>)/i.test(content);

  let score = 0;
  const details: string[] = [];

  if (images >= 2) { score += 3; details.push(`${images} images`); }
  else if (images === 1) { score += 2; details.push('1 image'); }
  else { details.push('No images'); }

  if (hasAltText && images > 0) { score += 2; details.push('Alt text present'); }
  if (videos > 0) { score += 3; details.push(`${videos} video(s)`); }

  return {
    score,
    maxScore: 5,
    label: 'Multimedia',
    description: details.join(', ') || 'No multimedia',
    recommendation: images === 0 ? 'Add relevant images with descriptive alt text' :
      (!hasAltText ? 'Add alt text to all images for accessibility and SEO' : undefined),
  };
}

// ─── New Advanced Metrics ────────────────────────────────────────────────────

/**
 * Semantic Coverage — measures how many of the provided GSC keywords
 * appear in the content. Every keyword represents a real user search;
 * covering more = more topical authority.
 */
function scoreSemanticCoverage(content: string, keywords: string[]): ScoreMetric {
  if (!keywords.length) {
    return { score: 6, maxScore: 12, label: 'Semantic Coverage', description: 'No keywords to check', recommendation: 'Sync GSC keywords to measure semantic coverage' };
  }

  const text = stripHtml(content).toLowerCase();
  const covered = keywords.filter(kw =>
    text.includes(kw.toLowerCase())
  );
  const coverageRate = covered.length / keywords.length;
  const pct = Math.round(coverageRate * 100);

  let score: number;
  let recommendation: string | undefined;

  if (coverageRate >= 0.9) { score = 12; }
  else if (coverageRate >= 0.7) { score = 9; recommendation = `${covered.length}/${keywords.length} keywords covered. Add: ${keywords.filter(k => !text.includes(k.toLowerCase())).slice(0, 3).map(k => `"${k}"`).join(', ')}`; }
  else if (coverageRate >= 0.5) { score = 6; recommendation = `Only ${pct}% of GSC keywords covered. Weave in missing terms naturally.`; }
  else if (coverageRate >= 0.3) { score = 3; recommendation = `Low semantic coverage (${pct}%). Many GSC keywords are missing from content.`; }
  else { score = 1; recommendation = `Very low coverage (${pct}%). Most GSC keywords absent. Run AI optimization to fix.`; }

  return {
    score,
    maxScore: 12,
    label: 'Semantic Coverage',
    description: `${covered.length}/${keywords.length} GSC keywords found in content (${pct}%)`,
    recommendation,
  };
}

/**
 * Keyword in Key Positions — primary keyword should appear in:
 * first 100 words (signals relevance to Google immediately),
 * at least one H2 subheading, and in the final paragraph.
 */
function scoreKeywordInPositions(content: string, keywords: string[]): ScoreMetric {
  if (!keywords.length) {
    return { score: 5, maxScore: 10, label: 'Keyword in Key Positions', description: 'No primary keyword to check' };
  }

  const primaryKw = keywords[0].toLowerCase();
  const escapedKw = primaryKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const kwRegex = new RegExp(escapedKw, 'i');

  let score = 0;
  const details: string[] = [];
  const missing: string[] = [];

  // First 100 words
  const fullText = stripHtml(content);
  const first100Words = fullText.split(/\s+/).slice(0, 100).join(' ');
  if (kwRegex.test(first100Words)) {
    score += 4;
    details.push('Keyword in opening paragraph');
  } else {
    missing.push(`Add "${keywords[0]}" within the first 100 words`);
  }

  // In H2 subheadings
  const h2Matches = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
  const kwInH2 = h2Matches.some(h => kwRegex.test(stripHtml(h)));
  if (kwInH2) {
    score += 3;
    details.push('Keyword in H2 subheading');
  } else {
    missing.push(`Include "${keywords[0]}" in at least one H2 subheading`);
  }

  // In conclusion / last 200 words
  const last200Words = fullText.split(/\s+/).slice(-200).join(' ');
  if (kwRegex.test(last200Words)) {
    score += 3;
    details.push('Keyword in conclusion');
  } else {
    missing.push(`Mention "${keywords[0]}" in the concluding section`);
  }

  return {
    score,
    maxScore: 10,
    label: 'Keyword in Key Positions',
    description: details.length ? details.join(', ') : 'Primary keyword missing from key positions',
    recommendation: missing.length ? missing.join('. ') : undefined,
  };
}

/**
 * Featured Snippet Readiness — Google's position 0 requires specific
 * content patterns. Score based on snippet-friendly elements present.
 */
function scoreFeaturedSnippetReady(content: string): ScoreMetric {
  let score = 0;
  const signals: string[] = [];
  const missing: string[] = [];

  // Short definition-style paragraph (40-80 words) near the top of content
  const firstParagraphs = (content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []).slice(0, 3);
  const hasDefinitionPara = firstParagraphs.some(p => {
    const wc = countWords(p);
    return wc >= 35 && wc <= 90;
  });
  if (hasDefinitionPara) { score += 2; signals.push('Definition-length paragraph (40-80 words)'); }
  else { missing.push('Add a 40-80 word answer paragraph early in the content'); }

  // Numbered list (how-to steps)
  if (/<ol[^>]*>[\s\S]*?<\/ol>/i.test(content)) {
    score += 2;
    signals.push('Numbered list for featured snippet');
  } else {
    missing.push('Add a numbered list (steps/process) for how-to snippet opportunity');
  }

  // HTML table
  if (/<table[^>]*>/i.test(content)) {
    score += 2;
    signals.push('Comparison table present');
  } else {
    missing.push('Add a comparison table for table-type featured snippets');
  }

  // FAQ section
  if (/faq|frequently asked/i.test(content)) {
    score += 2;
    signals.push('FAQ section for Q&A snippets');
  } else {
    missing.push('Add FAQ section for Q&A featured snippet opportunities');
  }

  return {
    score,
    maxScore: 8,
    label: 'Featured Snippet Ready',
    description: signals.length ? signals.join(', ') : 'No featured snippet signals found',
    recommendation: missing.length ? missing.slice(0, 2).join('. ') : undefined,
  };
}

/**
 * Search Intent Match — detects likely user intent from keywords and
 * checks if the content structure matches what users expect to find.
 */
function scoreSearchIntentMatch(content: string, keywords: string[]): ScoreMetric {
  if (!keywords.length) {
    return { score: 5, maxScore: 10, label: 'Search Intent Match', description: 'No keywords to determine intent' };
  }

  const intent = detectIntent(keywords);
  const text = stripHtml(content).toLowerCase();
  const wordCount = countWords(content);
  const hasTable = /<table/i.test(content);
  const hasList = /<ul|<ol/i.test(content);
  const hasFAQ = /faq|frequently asked/i.test(content);

  let score = 0;
  const signals: string[] = [];
  const missing: string[] = [];

  switch (intent) {
    case 'transactional': {
      // CTA language
      if (/apply now|get started|sign up|claim|order now|buy now|start today/i.test(text)) {
        score += 4; signals.push('CTA language present');
      } else { missing.push('Add clear CTA language (Apply Now, Get Started, etc.)'); }
      // Feature/benefit list
      if (hasList) { score += 3; signals.push('Feature/benefit list'); }
      else { missing.push('Add bullet list of key benefits/features'); }
      // Focused word count (not too long)
      if (wordCount >= 600 && wordCount <= 1800) { score += 3; signals.push('Focused word count for transactional intent'); }
      else if (wordCount > 1800) { missing.push('Content may be too long for transactional intent — keep it focused (600-1800 words)'); }
      break;
    }
    case 'commercial': {
      // Comparison element
      if (hasTable || /pros.*cons|versus|vs\.|compared to/i.test(text)) {
        score += 4; signals.push('Comparison structure present');
      } else { missing.push('Add a comparison table or pros/cons section'); }
      // Review-style verdict
      if (/verdict|bottom line|our recommendation|who should|best for/i.test(text)) {
        score += 3; signals.push('Expert verdict / recommendation present');
      } else { missing.push('Add an expert verdict or "bottom line" section'); }
      // Adequate depth
      if (wordCount >= 1200) { score += 3; signals.push('Sufficient depth for commercial research'); }
      else { missing.push(`Expand content (${wordCount} words). Commercial queries need 1200+ words.`); }
      break;
    }
    case 'informational': {
      // FAQ for question keywords
      if (hasFAQ) { score += 3; signals.push('FAQ answers question keywords'); }
      else { missing.push('Add FAQ section to answer question keywords from GSC'); }
      // Comprehensive word count
      if (wordCount >= 1500) { score += 4; signals.push('Comprehensive depth for informational intent'); }
      else { missing.push(`Expand to 1500+ words (currently ${wordCount}). Informational queries need depth.`); }
      // Definition/intro clarity
      const firstParaWords = countWords((content.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [''])[0]);
      if (firstParaWords >= 30 && firstParaWords <= 100) { score += 3; signals.push('Clear intro paragraph'); }
      else { missing.push('Add a clear 40-80 word intro paragraph that directly answers the query'); }
      break;
    }
    case 'navigational': {
      // Concise, direct
      if (wordCount <= 1200) { score += 5; signals.push('Concise for navigational intent'); }
      else { missing.push('Content may be too long for navigational intent — be more concise'); }
      // Has clear heading structure
      if (countHeadings(content).h2 >= 2) { score += 5; signals.push('Clear section structure'); }
      else { missing.push('Add clear section headings for easy navigation'); }
      break;
    }
  }

  return {
    score,
    maxScore: 10,
    label: 'Search Intent Match',
    description: `Intent: ${intent.charAt(0).toUpperCase() + intent.slice(1)} — ${signals.length ? signals.join(', ') : 'Structure does not match intent'}`,
    recommendation: missing.length ? missing.slice(0, 2).join('. ') : undefined,
  };
}

// ─── Main Scorer ──────────────────────────────────────────────────────────────

export function scoreContent(content: string, keywords: string[] = []): ContentScoreBreakdown {
  const metrics = {
    keywordDensity: scoreKeywordDensity(content, keywords),
    readability: scoreReadability(content),
    headingStructure: scoreHeadingStructure(content),
    eeeatSignals: scoreEEAT(content),
    wordCount: scoreWordCount(content),
    faqPresence: scoreFAQPresence(content),
    internalLinks: scoreInternalLinks(content),
    paragraphStructure: scoreParagraphStructure(content),
    titleOptimization: scoreTitleOptimization(content, keywords),
    multimediaPresence: scoreMultimedia(content),
    // New advanced metrics
    semanticCoverage: scoreSemanticCoverage(content, keywords),
    keywordInPositions: scoreKeywordInPositions(content, keywords),
    featuredSnippetReady: scoreFeaturedSnippetReady(content),
    searchIntentMatch: scoreSearchIntentMatch(content, keywords),
  };

  const totalScore = Object.values(metrics).reduce((sum, m) => sum + m.score, 0);
  const maxPossible = Object.values(metrics).reduce((sum, m) => sum + m.maxScore, 0);

  // Normalize to 0-100
  const normalizedScore = Math.round((totalScore / maxPossible) * 100);

  return { total: normalizedScore, metrics };
}

export const contentScorer = { scoreContent };
