import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'RankRevive — AI-Powered SEO Recovery',
    template: '%s | RankRevive',
  },
  description:
    'Recover lost Google rankings with AI-powered content optimization. Analyze, optimize, and publish SEO content directly from your Google Search Console data.',
  keywords: ['SEO', 'content optimization', 'Google rankings', 'AI', 'WordPress'],
  openGraph: {
    title: 'RankRevive — AI-Powered SEO Recovery',
    description: 'Recover lost Google rankings with AI-powered content optimization.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
