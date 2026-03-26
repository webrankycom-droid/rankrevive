import Link from 'next/link';
import { TrendingUp, Sparkles, BarChart3, Globe, ArrowRight, Check, Zap, Shield, RefreshCw } from 'lucide-react';

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Google Search Console Integration',
    description:
      'Connect GSC in one click to automatically import all your declining pages, keywords, impressions, and ranking data.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Optimization',
    description:
      'Use Claude 3.5 or GPT-4o to rewrite and optimize your content for EEAT, readability, keyword density, and heading structure.',
  },
  {
    icon: Globe,
    title: 'WordPress Auto-Publish',
    description:
      'Push optimized content directly back to WordPress as a draft or live post — no copy-paste required.',
  },
  {
    icon: BarChart3,
    title: 'Content Score Engine',
    description:
      'Every page gets a 0–100 content quality score based on 10 SEO signals so you always know where to focus.',
  },
  {
    icon: Zap,
    title: 'Bulk Recovery',
    description:
      'See all your pages ranked 5–20 with high impression volume — your biggest quick-win opportunities — in one view.',
  },
  {
    icon: RefreshCw,
    title: 'Before & After Preview',
    description:
      'Side-by-side diff viewer shows exactly what changed so you can review AI suggestions before publishing.',
  },
];

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    description: 'Perfect for individual site owners and bloggers.',
    features: ['10 pages / month', 'Google Search Console sync', 'Claude AI optimization', 'Content score reports', 'WordPress publish'],
    cta: 'Get Started',
    highlight: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 79,
    description: 'For SEO professionals managing multiple projects.',
    features: ['100 pages / month', 'Everything in Starter', 'Claude + GPT-4o', 'Advanced analytics', 'Priority support'],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    key: 'agency',
    name: 'Agency',
    price: 249,
    description: 'For agencies running large-scale SEO recovery campaigns.',
    features: ['500 pages / month', 'Everything in Pro', 'Multiple sites', 'White-label reports', 'API access'],
    cta: 'Contact Sales',
    highlight: false,
  },
];

const TESTIMONIALS = [
  {
    quote: 'RankRevive helped us recover 40% of our lost traffic in just 2 months. The AI optimization is spot on.',
    author: 'Sarah K.',
    role: 'SEO Manager, TechBlog',
  },
  {
    quote: 'We went from position 18 to position 4 on our main keyword within 6 weeks. Incredible ROI.',
    author: 'Marcus T.',
    role: 'Founder, NutritionHub',
  },
  {
    quote: 'The WordPress auto-publish feature alone saves us 3 hours a week. It just works.',
    author: 'Priya M.',
    role: 'Content Director, AgencyX',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-dark-950 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-dark-800 bg-dark-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-xl tracking-tight">
              Rank<span className="text-brand-400">Revive</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-dark-400">
            <a href="#features" className="hover:text-dark-200 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-dark-200 transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-dark-200 transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-dark-400 hover:text-dark-200 transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-1.5 text-sm font-medium bg-brand-500 hover:bg-brand-400 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-brand-500/20"
            >
              Get Started Free
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6">
        {/* Glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-brand-500/10 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Powered by Claude 3.5 &amp; GPT-4o
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            Recover Lost Google{' '}
            <span className="text-brand-400">Rankings</span> with AI
          </h1>
          <p className="text-xl text-dark-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            RankRevive connects to your Google Search Console, finds declining pages, and uses AI to
            optimize your content — then publishes it directly to WordPress.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-2xl shadow-brand-500/30 text-sm"
            >
              Start Free — No Credit Card
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-dark-200 font-medium px-8 py-3.5 rounded-xl transition-colors text-sm"
            >
              Sign in to Dashboard
            </Link>
          </div>

          <p className="text-dark-500 text-xs mt-5">
            10 free optimizations on the Starter plan · No setup fees
          </p>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y border-dark-800 bg-dark-900/40 py-5 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-8 flex-wrap">
          {[
            { value: '12,000+', label: 'Pages Optimized' },
            { value: '3.4×', label: 'Avg. Traffic Recovery' },
            { value: '< 60s', label: 'Time Per Optimization' },
            { value: '98%', label: 'Customer Satisfaction' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-dark-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything you need to recover rankings
            </h2>
            <p className="text-dark-400 text-lg max-w-xl mx-auto">
              A complete SEO recovery workflow — from data import to AI optimization to publishing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl bg-dark-900 border border-dark-800 hover:border-dark-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-brand-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-dark-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-dark-900/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How it works</h2>
            <p className="text-dark-400 text-lg">Three steps from data to recovered traffic.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect Google Search Console',
                description:
                  'Authorize GSC access and we instantly import all your pages, keywords, impressions, clicks, and position data.',
              },
              {
                step: '02',
                title: 'Run AI Optimization',
                description:
                  'Choose a page, select Claude or GPT-4o, and get fully rewritten content optimized for your target keywords in under 60 seconds.',
              },
              {
                step: '03',
                title: 'Publish to WordPress',
                description:
                  'Review the content score improvement, edit if needed, then publish directly to WordPress as draft or live — one click.',
              },
            ].map((step) => (
              <div key={step.step} className="relative">
                <div className="text-5xl font-black text-dark-800 mb-4">{step.step}</div>
                <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-dark-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
            <p className="text-dark-400 text-lg">Start free. Upgrade as you grow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative p-7 rounded-2xl border transition-colors ${
                  plan.highlight
                    ? 'bg-brand-500/10 border-brand-500/40 shadow-2xl shadow-brand-500/10'
                    : 'bg-dark-900 border-dark-800'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-brand-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="font-bold text-white text-lg mb-1">{plan.name}</h3>
                <p className="text-dark-400 text-sm mb-5">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-black text-white">${plan.price}</span>
                  <span className="text-dark-500 text-sm">/month</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-dark-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`block w-full text-center text-sm font-semibold py-2.5 rounded-lg transition-colors ${
                    plan.highlight
                      ? 'bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/20'
                      : 'bg-dark-800 hover:bg-dark-700 border border-dark-700 text-dark-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-6 bg-dark-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">What our customers say</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.author} className="p-6 rounded-xl bg-dark-900 border border-dark-800">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-dark-300 text-sm leading-relaxed italic mb-5">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-sm font-medium text-white">{t.author}</p>
                  <p className="text-xs text-dark-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-500/30">
            <TrendingUp className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to recover your rankings?
          </h2>
          <p className="text-dark-400 text-lg mb-8">
            Join thousands of SEOs and site owners using RankRevive to get back to page one.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-2xl shadow-brand-500/30 text-sm"
          >
            Start for Free — 10 pages included
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-dark-600 text-xs mt-4">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-sm">
              Rank<span className="text-brand-400">Revive</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-dark-500">
            <a href="#" className="hover:text-dark-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-dark-300 transition-colors">Terms of Service</a>
            <Link href="/login" className="hover:text-dark-300 transition-colors">Sign in</Link>
          </div>
          <p className="text-xs text-dark-600">© 2026 RankRevive. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
