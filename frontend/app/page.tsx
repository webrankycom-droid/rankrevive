import Link from 'next/link';
import { TrendingUp, Zap, BarChart3, Globe, ArrowRight, CheckCircle } from 'lucide-react';

const features = [
  { icon: Zap, title: 'AI-Powered Optimization', desc: 'Claude AI analyzes your content and suggests targeted improvements to recover lost rankings.' },
  { icon: BarChart3, title: 'Google Search Console', desc: 'Connect your GSC account to see exactly which pages are losing traffic and why.' },
  { icon: Globe, title: 'WordPress Integration', desc: 'Apply AI-generated optimizations directly to your WordPress site with one click.' },
];

const plans = [
  { name: 'Starter', price: '$29', pages: '10 pages/mo', features: ['GSC Integration', 'AI Suggestions', 'Email Support'] },
  { name: 'Pro', price: '$79', pages: '50 pages/mo', features: ['Everything in Starter', 'Bulk Optimization', 'Priority Support'], popular: true },
  { name: 'Agency', price: '$199', pages: '200 pages/mo', features: ['Everything in Pro', 'Multiple Sites', 'API Access'] },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-dark-950 text-white">
      {/* Nav */}
      <nav className="border-b border-dark-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">
              Rank<span className="text-brand-400">Revive</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-dark-400 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 transition-colors text-white"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered SEO Recovery
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
            Recover Lost Rankings<br />
            <span className="text-brand-400">with AI Precision</span>
          </h1>
          <p className="text-dark-400 text-xl mb-10 leading-relaxed">
            RankRevive uses Claude AI to analyze your declining pages, identify why they lost traffic, and generate targeted optimizations that bring back your rankings.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 transition-colors font-semibold text-white shadow-lg shadow-brand-500/30"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 transition-colors font-semibold text-dark-200"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t border-dark-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Everything you need to recover rankings</h2>
          <p className="text-dark-400 text-center mb-14">Stop guessing why your traffic dropped. Let AI do the heavy lifting.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl bg-dark-900 border border-dark-700">
                <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-brand-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-dark-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 border-t border-dark-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Simple, transparent pricing</h2>
          <p className="text-dark-400 text-center mb-14">Start free, upgrade when you need more.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-6 rounded-2xl border ${
                  plan.popular
                    ? 'bg-brand-500/10 border-brand-500/40 shadow-lg shadow-brand-500/10'
                    : 'bg-dark-900 border-dark-700'
                }`}
              >
                {plan.popular && (
                  <div className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-3">Most Popular</div>
                )}
                <h3 className="font-bold text-xl text-white mb-1">{plan.name}</h3>
                <div className="text-3xl font-bold text-white mb-1">
                  {plan.price}<span className="text-dark-400 text-base font-normal">/mo</span>
                </div>
                <p className="text-dark-400 text-sm mb-5">{plan.pages}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-dark-300">
                      <CheckCircle className="w-4 h-4 text-brand-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`block text-center py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    plan.popular
                      ? 'bg-brand-500 hover:bg-brand-600 text-white'
                      : 'bg-dark-800 hover:bg-dark-700 border border-dark-600 text-dark-200'
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-800 px-6 py-8 text-center">
        <p className="text-dark-500 text-sm">
          © 2026 RankRevive. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
