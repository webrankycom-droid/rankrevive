'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TrendingUp, Mail, Lock, User, AlertCircle, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

const PLAN_FEATURES = [
  '10 pages/month free',
  'Google Search Console integration',
  'AI-powered content optimization',
  'WordPress auto-publish',
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authApi.register(email, password, name);
      await signIn('credentials', { email, password, redirect: false });
      toast.success('Account created! Welcome to RankRevive.');
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-2xl tracking-tight">
              Rank<span className="text-brand-400">Revive</span>
            </span>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-2xl p-8 shadow-2xl">
            <h1 className="text-xl font-bold text-white mb-1">Create your account</h1>
            <p className="text-dark-400 text-sm mb-6">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
                Sign in
              </Link>
            </p>

            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-white/5 border border-dark-600 hover:bg-white/10 transition-colors text-sm font-medium text-dark-200 mb-5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-dark-700" />
              <span className="text-dark-500 text-xs">or</span>
              <div className="flex-1 h-px bg-dark-700" />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoComplete="name"
                leftIcon={<User className="w-4 h-4" />}
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                leftIcon={<Mail className="w-4 h-4" />}
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                leftIcon={<Lock className="w-4 h-4" />}
                hint="At least 8 characters"
              />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Create account — it&apos;s free
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Right: Feature highlights */}
      <div className="hidden lg:flex w-96 bg-dark-900 border-l border-dark-700 flex-col justify-center p-12">
        <h2 className="text-2xl font-bold text-white mb-3">
          Recover lost rankings with AI
        </h2>
        <p className="text-dark-400 text-sm mb-8 leading-relaxed">
          RankRevive analyzes your Google Search Console data and uses Claude AI to optimize your content for maximum recovery.
        </p>

        <ul className="space-y-3">
          {PLAN_FEATURES.map((feat) => (
            <li key={feat} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-dark-200 text-sm">{feat}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 p-4 rounded-xl bg-dark-800 border border-dark-700">
          <p className="text-dark-300 text-sm italic leading-relaxed">
            &ldquo;RankRevive helped us recover 40% of our lost traffic in just 2 months. The AI optimization is spot on.&rdquo;
          </p>
          <p className="text-dark-500 text-xs mt-2">— Sarah K., SEO Manager</p>
        </div>
      </div>
    </div>
  );
}
